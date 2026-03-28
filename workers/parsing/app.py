from __future__ import annotations

import io
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


def _to_parsed_payload(raw_text: str) -> dict[str, Any]:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    top_lines = lines[:5]
    return {
        "summary": " ".join(top_lines)[:700],
        "skills": [],
        "workExperience": [],
        "education": [],
        "personalProjects": [],
        "additional": {
            "technicalSkills": [],
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
