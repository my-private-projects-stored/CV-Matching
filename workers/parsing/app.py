from __future__ import annotations

import io
import re
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from pypdf import PdfReader

app = FastAPI(title="cv-matching-parsing-worker")


def _extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    chunks: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            chunks.append(text)
    return "\n\n".join(chunks).strip()


def _fallback_text_decode(file_bytes: bytes) -> str:
    text = file_bytes.decode("utf-8", errors="ignore").strip()
    return text


def _dedupe(items: list[str], limit: int = 40) -> list[str]:
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


def _extract_skills(raw_text: str) -> list[str]:
    lines = [line.strip() for line in raw_text.splitlines()]
    heading_pattern = re.compile(r"^(technical\s+skills|skills|core\s+skills|technologies|tools)\s*:?\s*$", re.I)
    next_heading_pattern = re.compile(r"^[A-Z][A-Za-z /&-]{2,40}:?$")
    collected: list[str] = []

    for index, line in enumerate(lines):
        if not heading_pattern.match(line):
            continue

        for following in lines[index + 1 : index + 8]:
            if not following:
                if collected:
                    break
                continue
            if next_heading_pattern.match(following) and not re.search(r"[,;|/]", following):
                break
            collected.append(following)

        break

    if not collected:
        inline = re.search(
            r"(?:technical\s+skills|skills|technologies|tools)\s*:\s*(.+)",
            raw_text,
            re.I,
        )
        if inline:
            collected.append(inline.group(1))

    tokens: list[str] = []
    for chunk in collected:
        cleaned = re.sub(r"^[\-*\u2022]\s*", "", chunk)
        parts = re.split(r"[,;|/]| {2,}", cleaned)
        for part in parts:
            value = part.strip(" \t\r\n-\u2022")
            if 1 < len(value) <= 40:
                tokens.append(value)

    return _dedupe(tokens)


def _to_parsed_payload(raw_text: str) -> dict[str, Any]:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    top_lines = lines[:5]
    skills = _extract_skills(raw_text)
    return {
        "summary": " ".join(top_lines)[:700],
        "skills": skills,
        "workExperience": [],
        "education": [],
        "personalProjects": [],
        "additional": {
            "technicalSkills": skills,
            "languages": [],
            "certificationsTraining": [],
            "awards": [],
        },
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

    try:
        if mime_type == "application/pdf" or (file.filename or "").lower().endswith(".pdf"):
            raw_text = _extract_pdf_text(file_bytes)
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
