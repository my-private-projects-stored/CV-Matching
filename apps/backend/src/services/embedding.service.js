function getEmbeddingServiceUrl() {
  return process.env.EMBEDDING_SERVICE_URL || "http://localhost:8010";
}

export async function generateEmbedding(text) {
  const safeText = String(text || "").trim();
  if (!safeText) {
    throw new Error("Text is required to generate embedding");
  }

  const response = await fetch(`${getEmbeddingServiceUrl()}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: safeText }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding service failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.vector) || data.vector.length === 0) {
    throw new Error("Embedding service returned an invalid vector");
  }

  return data.vector;
}

export async function generateEmbeddings(texts = []) {
  const normalized = texts.map((item) => String(item || "").trim()).filter(Boolean);
  if (normalized.length === 0) {
    return [];
  }

  const response = await fetch(`${getEmbeddingServiceUrl()}/embed/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ texts: normalized }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding service batch failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.vectors)) {
    throw new Error("Embedding service returned invalid batch vectors");
  }

  return data.vectors;
}
