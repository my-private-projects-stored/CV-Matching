function getParsingServiceUrl() {
  return process.env.PARSING_SERVICE_URL || "http://localhost:8020";
}

function getParsingServiceTimeoutMs() {
  return Number.parseInt(process.env.PARSING_SERVICE_TIMEOUT_MS || "12000", 10);
}

function toAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000;
  const timer = setTimeout(() => controller.abort(), timeout);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function parseAsStructuredObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value;
}

export async function parseUploadedResume(file) {
  if (!file || !file.buffer || Number(file.size || 0) <= 0) {
    throw new Error("Uploaded file content is missing");
  }

  const formData = new FormData();
  const blob = new Blob([file.buffer], {
    type: String(file.mimetype || "application/octet-stream"),
  });
  formData.append("file", blob, String(file.originalname || "resume"));

  const { signal, clear } = toAbortSignal(getParsingServiceTimeoutMs());

  let response;
  try {
    response = await fetch(`${getParsingServiceUrl()}/parse`, {
      method: "POST",
      body: formData,
      signal,
    });
  } catch (error) {
    clear();
    if (error?.name === "AbortError") {
      throw new Error("Resume parsing service timed out");
    }
    throw new Error(`Resume parsing service unreachable: ${error?.message || "unknown error"}`);
  }

  clear();

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resume parsing service failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const rawText = String(data?.raw_text || "").trim();
  const parsedData = parseAsStructuredObject(data?.parsed_data);

  if (!rawText) {
    throw new Error("Resume parsing service returned empty text");
  }

  return {
    rawText,
    parsedData,
  };
}
