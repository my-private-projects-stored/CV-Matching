from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

app = FastAPI(title="SBERT Embedding Worker", version="1.0.0")
model = SentenceTransformer(MODEL_NAME)


class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1)


class BatchEmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/embed")
def embed(payload: EmbeddingRequest) -> dict:
    try:
        vector = model.encode(payload.text, normalize_embeddings=True).tolist()
        return {"vector": vector, "model": MODEL_NAME, "dimension": len(vector)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/embed/batch")
def embed_batch(payload: BatchEmbeddingRequest) -> dict:
    try:
        vectors = model.encode(payload.texts, normalize_embeddings=True).tolist()
        return {"vectors": vectors, "model": MODEL_NAME, "dimension": len(vectors[0])}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
