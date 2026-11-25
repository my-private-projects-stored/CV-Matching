/**
 * HTTP client for worker-parsing (/parse).
 */
export function createParsingClient({
  baseUrl = process.env.PARSING_SERVICE_URL || "http://localhost:8020",
  timeoutMs = Number.parseInt(process.env.PARSING_TIMEOUT_MS || "15000", 10),
} = {}) {
  async function extractRawTextFromFile({ buffer, originalname = "resume.pdf", mimetype = "application/pdf" }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: mimetype || "application/octet-stream" });
      formData.append("file", blob, originalname);

      const response = await fetch(`${baseUrl}/parse`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Parsing service failed (${response.status}): ${body}`);
      }

      const data = await response.json();
      const rawText = String(data?.raw_text || "").trim();
      if (!rawText) {
        throw new Error("Parsing service returned empty text");
      }
      return rawText;
    } finally {
      clearTimeout(timer);
    }
  }

  return { extractRawTextFromFile };
}
