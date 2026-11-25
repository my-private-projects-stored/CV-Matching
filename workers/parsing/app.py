from __future__ import annotations

import io
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from pypdf import PdfReader

app = FastAPI(title="cv-matching-parsing-worker")

_MONTH_RE = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Tháng\s*\d{1,2}|T\d{1,2})"
_DATE_TOKEN_RE = rf"(?:{_MONTH_RE}\s+\d{{4}}|\d{{1,2}}/\d{{4}}|\d{{4}})"
_DATE_RANGE_RE = re.compile(
    rf"({_DATE_TOKEN_RE}\s*(?:-|–|—|to|đến)\s*(?:{_DATE_TOKEN_RE}|Present|Current|Now|Hiện\s*tại))",
    re.I,
)
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")
_LINKEDIN_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/[^\s,|;]+", re.I)
_GITHUB_RE = re.compile(r"(?:https?://)?(?:www\.)?github\.com/[^\s,|;]+", re.I)
_URL_RE = re.compile(r"(?:https?://[^\s,|;]+|www\.[^\s,|;]+)", re.I)
_BULLET_RE = re.compile(r"^[•\-*▪–◦]\s*(.+)$")

_SECTION_ALIASES: dict[str, str] = {
    "summary": "summary",
    "professional summary": "summary",
    "profile": "summary",
    "about": "summary",
    "about me": "summary",
    "objective": "summary",
    "tóm tắt": "summary",
    "giới thiệu": "summary",
    "mục tiêu": "summary",
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "employment": "experience",
    "employment history": "experience",
    "kinh nghiệm": "experience",
    "kinh nghiệm làm việc": "experience",
    "education": "education",
    "academic background": "education",
    "học vấn": "education",
    "trình độ học vấn": "education",
    "projects": "projects",
    "personal projects": "projects",
    "selected projects": "projects",
    "dự án": "projects",
    "dự án cá nhân": "projects",
    "skills": "skills",
    "technical skills": "skills",
    "core skills": "skills",
    "skills & awards": "skills_awards",
    "skills and awards": "skills_awards",
    "additional": "skills_awards",
    "additional information": "skills_awards",
    "kỹ năng": "skills",
    "kỹ năng chuyên môn": "skills",
    "certifications": "certifications",
    "certificates": "certifications",
    "certifications & training": "certifications",
    "chứng chỉ": "certifications",
    "languages": "languages",
    "ngôn ngữ": "languages",
    "awards": "awards",
    "honors & awards": "awards",
    "giải thưởng": "awards",
}


def _extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    chunks: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            chunks.append(text)
    return "\n\n".join(chunks).strip()


def _extract_docx_text(file_bytes: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
        if "word/document.xml" not in zf.namelist():
            return ""
        xml_bytes = zf.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    paragraphs: list[str] = []
    for p in root.iter():
        if p.tag.endswith("}p") or p.tag == "p":
            texts = [t.text for t in p.iter() if (t.tag.endswith("}t") or t.tag == "t") and t.text]
            line = "".join(texts).strip()
            if line:
                paragraphs.append(line)
    return "\n".join(paragraphs).strip()


def _fallback_text_decode(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore").strip()


def _dedupe(items: list[str], limit: int = 50) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        normalized = re.sub(r"\s+", " ", item).strip(" \t\r\n,;|")
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
        if len(result) >= limit:
            break
    return result


def _detect_section_heading(line: str) -> str | None:
    cleaned = re.sub(r"[:\-–—]+$", "", line.strip()).strip().lower()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return _SECTION_ALIASES.get(cleaned)


def _split_top_level_items(text: str) -> list[str]:
    items: list[str] = []
    buf: list[str] = []
    depth = 0
    for ch in text:
        if ch in "([{":
            depth += 1
        elif ch in ")]}" and depth > 0:
            depth -= 1
        if depth == 0 and ch in ",;|":
            token = "".join(buf).strip(" \t\r\n•-*")
            if token:
                items.append(token)
            buf = []
        else:
            buf.append(ch)
    tail = "".join(buf).strip(" \t\r\n•-*")
    if tail:
        items.append(tail)
    return items


def _parse_personal_info(header_lines: list[str]) -> dict[str, Any]:
    joined = "\n".join(header_lines)
    email_match = _EMAIL_RE.search(joined)
    phone_match = _PHONE_RE.search(joined)
    linkedin_match = _LINKEDIN_RE.search(joined)
    github_match = _GITHUB_RE.search(joined)

    website = ""
    for url_match in _URL_RE.finditer(joined):
        candidate = url_match.group(0).rstrip(".,;)")
        low = candidate.lower()
        if "linkedin.com" not in low and "github.com" not in low:
            website = candidate
            break

    contact_lines_removed: list[str] = []
    non_contact_lines: list[str] = []
    for line in header_lines:
        has_contact = bool(
            _EMAIL_RE.search(line)
            or _PHONE_RE.search(line)
            or _LINKEDIN_RE.search(line)
            or _GITHUB_RE.search(line)
            or _URL_RE.search(line)
        )
        if not has_contact:
            non_contact_lines.append(line.strip())
        else:
            cleaned = line
            for rx in (_EMAIL_RE, _PHONE_RE, _LINKEDIN_RE, _GITHUB_RE, _URL_RE):
                cleaned = rx.sub(" ", cleaned)
            cleaned = re.sub(r"\s*[|•·]\s*", " ", cleaned)
            cleaned = re.sub(r"(?:^[\s,|•·]+|[\s,|•·]+$)", "", cleaned)
            cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
            if cleaned:
                contact_lines_removed.append(cleaned)

    name = non_contact_lines[0] if len(non_contact_lines) >= 1 else ""
    title = non_contact_lines[1] if len(non_contact_lines) >= 2 and len(non_contact_lines[1]) <= 80 else ""
    location = ""
    if contact_lines_removed:
        location = contact_lines_removed[0]
    elif len(non_contact_lines) >= 3:
        location = non_contact_lines[2]

    return {
        "name": name,
        "title": title,
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0).strip() if phone_match else "",
        "location": location,
        "website": website or None,
        "linkedin": linkedin_match.group(0).rstrip(".,;)") if linkedin_match else None,
        "github": github_match.group(0).rstrip(".,;)") if github_match else None,
    }


def _split_company_location(line: str) -> tuple[str, str | None]:
    for sep in (" | ", " — ", " – ", " - "):
        if sep in line:
            parts = line.split(sep, 1)
            return parts[0].strip(), parts[1].strip() or None

    loc_match = re.search(
        r"\s+((?:(?:San|Santa|Los|Las|New|Fort|Mount|St\.?|Salt\s+Lake|El|La|North|South|East|West|Palo|Mountain|Menlo|Redwood)\s+)?[A-Z][a-z.]+,\s*[A-Z]{2}(?:\s+\d{5})?|Remote|Hybrid|Onsite|Hanoi|Ho Chi Minh(?:\s+City)?|Da Nang|Singapore|London|Tokyo)\s*$",
        line,
    )
    if loc_match:
        company = line[: loc_match.start()].strip(" ,|-")
        location = loc_match.group(1).strip()
        if company:
            return company, location
    return line.strip(), None


def _collect_bullets(lines: list[str]) -> list[str]:
    bullets: list[str] = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        m = _BULLET_RE.match(line)
        if m:
            bullets.append(m.group(1).strip())
        elif bullets:
            bullets[-1] = f"{bullets[-1]} {line}".strip()
        else:
            bullets.append(line)
    return bullets


def _parse_experience(lines: list[str]) -> list[dict[str, Any]]:
    entries: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if _DATE_RANGE_RE.search(line) and not _BULLET_RE.match(line):
            if current:
                entries.append(current)
            current = [line]
        else:
            if not current:
                current = [line]
            else:
                current.append(line)
    if current:
        entries.append(current)

    parsed: list[dict[str, Any]] = []
    for idx, block in enumerate(entries, start=1):
        header = block[0]
        date_match = _DATE_RANGE_RE.search(header)
        years = date_match.group(1).strip() if date_match else ""
        title = _DATE_RANGE_RE.sub("", header).strip(" |,-–—") if date_match else header.strip()

        company = ""
        location: str | None = None
        bullet_start = 1
        if len(block) > 1 and not _BULLET_RE.match(block[1]):
            company, location = _split_company_location(block[1])
            bullet_start = 2

        description = _collect_bullets(block[bullet_start:])
        if title or company or description:
            parsed.append(
                {
                    "id": idx,
                    "title": title,
                    "company": company,
                    "location": location,
                    "years": years,
                    "description": description,
                }
            )
    return parsed


def _parse_education(lines: list[str]) -> list[dict[str, Any]]:
    entries: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if _DATE_RANGE_RE.search(line) and not _BULLET_RE.match(line):
            if current:
                entries.append(current)
            current = [line]
        else:
            if not current:
                current = [line]
            else:
                current.append(line)
    if current:
        entries.append(current)

    parsed: list[dict[str, Any]] = []
    for idx, block in enumerate(entries, start=1):
        header = block[0]
        date_match = _DATE_RANGE_RE.search(header)
        years = date_match.group(1).strip() if date_match else ""
        institution = _DATE_RANGE_RE.sub("", header).strip(" |,-–—") if date_match else header.strip()
        degree = block[1].strip() if len(block) > 1 else ""
        desc_lines = [l.strip() for l in block[2:] if l.strip()]
        description = " ".join(desc_lines) if desc_lines else None
        if institution or degree:
            parsed.append(
                {
                    "id": idx,
                    "institution": institution,
                    "degree": degree,
                    "years": years,
                    "description": description,
                }
            )
    return parsed


def _parse_projects(lines: list[str]) -> list[dict[str, Any]]:
    entries: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        is_header = (not _BULLET_RE.match(line)) and (
            bool(_DATE_RANGE_RE.search(line)) or bool(_GITHUB_RE.search(line)) or bool(_URL_RE.search(line))
        )
        if is_header:
            if current:
                entries.append(current)
            current = [line]
        else:
            if not current:
                current = [line]
            else:
                current.append(line)
    if current:
        entries.append(current)

    parsed: list[dict[str, Any]] = []
    for idx, block in enumerate(entries, start=1):
        header = block[0]
        date_match = _DATE_RANGE_RE.search(header)
        github_match = _GITHUB_RE.search(header)
        website_match = None if github_match else _URL_RE.search(header)

        years = date_match.group(1).strip() if date_match else ""
        github = github_match.group(0).rstrip(".,;)") if github_match else None
        website = website_match.group(0).rstrip(".,;)") if website_match else None

        name = header
        for rx in (_DATE_RANGE_RE, _GITHUB_RE, _URL_RE):
            name = rx.sub("", name)
        name = re.sub(r"\s{2,}", " ", name).strip(" |,-–—")

        role = ""
        bullet_start = 1
        if len(block) > 1 and not _BULLET_RE.match(block[1]):
            role = block[1].strip()
            bullet_start = 2

        description = _collect_bullets(block[bullet_start:])
        if name or role or description:
            parsed.append(
                {
                    "id": idx,
                    "name": name,
                    "role": role,
                    "years": years,
                    "github": github,
                    "website": website,
                    "description": description,
                }
            )
    return parsed


def _parse_additional(
    skills_lines: list[str],
    cert_lines: list[str],
    lang_lines: list[str],
    award_lines: list[str],
) -> dict[str, list[str]]:
    technical_skills: list[str] = []
    languages: list[str] = []
    certifications: list[str] = []
    awards: list[str] = []

    label_re = re.compile(
        r"^(technical\s+skills|skills|technologies|tools|languages|ngôn\s+ngữ|certifications(?:\s*&\s*training)?|certificates|chứng\s+chỉ|awards|honors(?:\s*&\s*awards)?|giải\s+thưởng)\s*:\s*(.*)$",
        re.I,
    )

    active_bucket = "technicalSkills"
    buckets: dict[str, list[str]] = {
        "technicalSkills": [],
        "languages": [],
        "certificationsTraining": [],
        "awards": [],
    }

    for line in skills_lines:
        m = label_re.match(line)
        if m:
            lbl = m.group(1).lower()
            rest = m.group(2).strip()
            if "language" in lbl or "ngôn ngữ" in lbl:
                active_bucket = "languages"
            elif "certif" in lbl or "chứng chỉ" in lbl:
                active_bucket = "certificationsTraining"
            elif "award" in lbl or "honor" in lbl or "giải thưởng" in lbl:
                active_bucket = "awards"
            else:
                active_bucket = "technicalSkills"
            if rest:
                buckets[active_bucket].append(rest)
        else:
            buckets[active_bucket].append(line)

    if buckets["technicalSkills"]:
        technical_skills.extend(_split_top_level_items(" ".join(buckets["technicalSkills"])))
    if buckets["languages"]:
        languages.extend(_split_top_level_items(" ".join(buckets["languages"])))
    if buckets["certificationsTraining"]:
        certifications.extend(_split_top_level_items(" ".join(buckets["certificationsTraining"])))
    if buckets["awards"]:
        awards.extend(_split_top_level_items(" ".join(buckets["awards"])))

    if cert_lines:
        certifications.extend(_split_top_level_items(" ".join(cert_lines)))
    if lang_lines:
        languages.extend(_split_top_level_items(" ".join(lang_lines)))
    if award_lines:
        awards.extend(_split_top_level_items(" ".join(award_lines)))

    return {
        "technicalSkills": _dedupe(technical_skills, limit=50),
        "languages": _dedupe(languages, limit=20),
        "certificationsTraining": _dedupe(certifications, limit=20),
        "awards": _dedupe(awards, limit=20),
    }


def _to_parsed_payload(raw_text: str) -> dict[str, Any]:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    sections: dict[str, list[str]] = {
        "header": [],
        "summary": [],
        "experience": [],
        "education": [],
        "projects": [],
        "skills_awards": [],
        "certifications": [],
        "languages": [],
        "awards": [],
    }

    current_section = "header"
    for line in lines:
        detected = _detect_section_heading(line)
        if detected:
            if detected == "skills":
                current_section = "skills_awards"
            else:
                current_section = detected
            continue
        sections[current_section].append(line)

    personal_info = _parse_personal_info(sections["header"])
    summary_text = " ".join(sections["summary"]).strip()
    if not summary_text and not sections["experience"] and sections["header"]:
        summary_text = " ".join(sections["header"][:5])[:700]

    work_experience = _parse_experience(sections["experience"])
    education = _parse_education(sections["education"])
    personal_projects = _parse_projects(sections["projects"])
    additional = _parse_additional(
        sections["skills_awards"],
        sections["certifications"],
        sections["languages"],
        sections["awards"],
    )

    return {
        "personalInfo": personal_info,
        "summary": summary_text,
        "skills": additional["technicalSkills"],
        "workExperience": work_experience,
        "education": education,
        "personalProjects": personal_projects,
        "additional": additional,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse")
async def parse_resume(file: UploadFile = File(...)) -> dict[str, Any]:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    mime_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()

    try:
        if mime_type == "application/pdf" or filename.endswith(".pdf"):
            raw_text = _extract_pdf_text(file_bytes)
        elif "wordprocessingml" in mime_type or filename.endswith(".docx"):
            raw_text = _extract_docx_text(file_bytes)
        else:
            raw_text = _fallback_text_decode(file_bytes)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=422, detail=f"Parsing failed: {exc}") from exc

    if not raw_text:
        raise HTTPException(status_code=422, detail="No textual content extracted from file")

    parsed_data = _to_parsed_payload(raw_text)

    return {
        "raw_text": raw_text,
        "parsed_data": parsed_data,
        "meta": {
            "filename": file.filename,
            "mime_type": mime_type,
            "text_length": len(raw_text),
        },
    }
