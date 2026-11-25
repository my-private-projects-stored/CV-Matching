export function createEmbeddingClient({
  baseUrl = process.env.EMBEDDING_SERVICE_URL || "http://localhost:8010",
  timeoutMs = Number.parseInt(process.env.EMBEDDING_TIMEOUT_MS || "10000", 10),
} = {}) {
  async function embedText(text) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: String(text || "") }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Embedding service failed (${response.status}): ${body}`);
      }

      const data = await response.json();
      if (!Array.isArray(data?.vector) || data.vector.length === 0) {
        throw new Error("Embedding service returned invalid vector");
      }
      return data.vector;
    } finally {
      clearTimeout(timer);
    }
  }

  return { embedText };
}
