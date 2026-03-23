function escapePdfText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function normalizeLines(lines = []) {
  const normalized = [];
  for (const line of lines) {
    const text = String(line || "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    const chunks = text.match(/.{1,100}(\s|$)/g) || [text];
    for (const chunk of chunks) {
      normalized.push(chunk.trim());
    }
  }

  return normalized.slice(0, 80);
}

export function createSimplePdf(lines = []) {
  const contentLines = normalizeLines(lines);
  const streamBody = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL"];

  if (!contentLines.length) {
    streamBody.push("(No content available.) Tj");
  } else {
    streamBody.push(`(${escapePdfText(contentLines[0])}) Tj`);
    for (const line of contentLines.slice(1)) {
      streamBody.push("T*");
      streamBody.push(`(${escapePdfText(line)}) Tj`);
    }
  }

  streamBody.push("ET");
  const streamText = streamBody.join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(streamText, "utf8")} >>\nstream\n${streamText}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += "trailer\n";
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF\n";

  return Buffer.from(pdf, "utf8");
}
