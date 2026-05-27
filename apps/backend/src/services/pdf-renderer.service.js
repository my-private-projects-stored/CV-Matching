function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function formatLines(value) {
  if (Array.isArray(value)) {
    return value.map((line) => String(line || "").trim()).filter(Boolean);
  }
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function renderBullets(lines) {
  const safeLines = formatLines(lines);
  if (!safeLines.length) return "";
  return `<ul>${safeLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
}

function renderSection(title, body, visible = true) {
  if (!visible || !String(body || "").trim()) return "";
  return `<section class="section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function getVisibleMeta(builderData) {
  const sections = asObject(builderData.sections);
  const provided = asArray(builderData.sectionMeta);
  if (provided.length) {
    return provided
      .filter((meta) => meta?.isVisible !== false)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }

  return Object.keys(sections).map((key, index) => ({
    id: key,
    key,
    displayName: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
    order: index,
    isVisible: true,
  }));
}

function renderExperience(items) {
  return asArray(items)
    .map((item) => {
      const title = [item?.title, item?.company].map((part) => String(part || "").trim()).filter(Boolean).join(" - ");
      const dates = [item?.startDate, item?.endDate].map((part) => String(part || "").trim()).filter(Boolean).join(" to ");
      return `<article class="item"><h3>${escapeHtml(title || "Experience")}</h3>${dates ? `<p class="muted">${escapeHtml(dates)}</p>` : ""}${renderBullets(item?.description)}</article>`;
    })
    .join("");
}

function renderEducation(items) {
  return asArray(items)
    .map((item) => {
      const title = [item?.degree, item?.institution || item?.school].map((part) => String(part || "").trim()).filter(Boolean).join(" - ");
      return `<article class="item"><h3>${escapeHtml(title || "Education")}</h3>${item?.year ? `<p class="muted">${escapeHtml(item.year)}</p>` : ""}</article>`;
    })
    .join("");
}

function renderProjects(items) {
  return asArray(items)
    .map((item) => `<article class="item"><h3>${escapeHtml(item?.name || "Project")}</h3>${renderBullets(item?.description)}</article>`)
    .join("");
}

function renderAdditional(additional) {
  const data = asObject(additional);
  const parts = [];
  for (const [key, value] of Object.entries(data)) {
    const lines = formatLines(value);
    if (!lines.length) continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
    parts.push(`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(lines.join(", "))}</p>`);
  }
  return parts.join("");
}

function renderCustom(value) {
  if (Array.isArray(value)) return renderBullets(value);
  if (value && typeof value === "object") return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
  const text = String(value || "").trim();
  return text ? `<p>${escapeHtml(text)}</p>` : "";
}

function renderSectionBody(key, value) {
  if (key === "summary") return String(value || "").trim() ? `<p>${escapeHtml(value)}</p>` : "";
  if (key === "workExperience") return renderExperience(value);
  if (key === "education") return renderEducation(value);
  if (key === "personalProjects") return renderProjects(value);
  if (key === "additional") return renderAdditional(value);
  if (key === "personalInfo") return "";
  return renderCustom(value);
}

function buildHtml({ title, builderData }) {
  const sections = asObject(builderData.sections);
  const personalInfo = asObject(sections.personalInfo);
  const settings = asObject(builderData.formatSettings);
  const fontSize = Number(asObject(settings.fontSize).base || settings.baseFontSize || 10);
  const spacing = asObject(settings.spacing);
  const lineHeight = Number(spacing.lineHeight || settings.lineHeight || 1.4);
  const sectionSpacing = Number(spacing.section || settings.sectionSpacing || 12);
  const template = String(builderData.template || "classic-single");
  const isTwoColumn = template.includes("two-column");
  const isModern = template.includes("modern");
  const accent = String(settings.accentColor || (isModern ? "#2457a6" : "#111827"));
  const body = getVisibleMeta(builderData)
    .map((meta) => {
      const key = String(meta.key || meta.id || "");
      return renderSection(meta.displayName || key, renderSectionBody(key, sections[key]), meta.isVisible !== false);
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, sans-serif; font-size: ${fontSize}pt; line-height: ${lineHeight}; }
    .page { display: grid; grid-template-columns: ${isTwoColumn ? "34% 1fr" : "1fr"}; gap: ${isTwoColumn ? "22px" : "0"}; }
    header { ${isTwoColumn ? "" : "border-bottom: 2px solid " + accent + "; padding-bottom: 12px; margin-bottom: 16px;"} }
    h1 { margin: 0; font-size: ${fontSize * 2.2}pt; color: ${accent}; letter-spacing: 0; }
    .role { margin: 4px 0 0; color: #4b5563; font-size: ${fontSize * 1.1}pt; }
    .contact { margin-top: 8px; color: #4b5563; }
    .content { ${isTwoColumn ? "display: contents;" : ""} }
    .main { ${isTwoColumn ? "" : "display: block;"} }
    .side { ${isTwoColumn ? "border-right: 1px solid #d1d5db; padding-right: 16px;" : "display: none;"} }
    .section { break-inside: avoid; margin-bottom: ${settings.compactMode ? Math.max(6, sectionSpacing - 4) : sectionSpacing}px; }
    h2 { margin: 0 0 6px; color: ${accent}; font-size: ${fontSize * 1.15}pt; text-transform: uppercase; letter-spacing: 0; }
    h3 { margin: 0 0 2px; font-size: ${fontSize * 1.02}pt; }
    p { margin: 0 0 5px; }
    ul { margin: 4px 0 0 16px; padding: 0; }
    li { margin-bottom: 3px; }
    .item { margin-bottom: ${Number(spacing.item || 8)}px; }
    .muted { color: #6b7280; }
    pre { white-space: pre-wrap; font: inherit; margin: 0; }
  </style>
</head>
<body>
  <main class="page">
    <div class="${isTwoColumn ? "side" : "main"}">
      <header>
        <h1>${escapeHtml(personalInfo.name || title || "Resume")}</h1>
        ${personalInfo.title ? `<p class="role">${escapeHtml(personalInfo.title)}</p>` : ""}
        <p class="contact">${[personalInfo.email, personalInfo.phone, personalInfo.location, personalInfo.website].filter(Boolean).map(escapeHtml).join(" | ")}</p>
      </header>
    </div>
    <div class="main">${body}</div>
  </main>
</body>
</html>`;
}

export async function renderResumePdf({ title, builderData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (error) {
    const unavailable = new Error("PDF renderer is unavailable. Install Playwright and its Chromium browser.");
    unavailable.statusCode = 503;
    unavailable.error_code = "pdf_renderer_unavailable";
    unavailable.cause = error;
    throw unavailable;
  }

  const settings = asObject(builderData.formatSettings);
  const margins = asObject(settings.margins);
  let browser;
  try {
    const launchOptions = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    };

    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    } else {
      // Fallback detection
      const fs = await import("fs");
      if (fs.existsSync("/usr/bin/chromium-browser")) {
        launchOptions.executablePath = "/usr/bin/chromium-browser";
      }
    }

    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage();
    await page.setContent(buildHtml({ title, builderData }), { waitUntil: "networkidle" });
    return await page.pdf({
      format: String(settings.pageSize || "A4").toUpperCase() === "LETTER" ? "Letter" : "A4",
      printBackground: true,
      margin: {
        top: `${Number(margins.top ?? 16)}mm`,
        right: `${Number(margins.right ?? 16)}mm`,
        bottom: `${Number(margins.bottom ?? 16)}mm`,
        left: `${Number(margins.left ?? 16)}mm`,
      },
    });
  } catch (error) {
    const unavailable = new Error("PDF renderer is unavailable. Playwright could not render the document.");
    unavailable.statusCode = 503;
    unavailable.error_code = "pdf_renderer_unavailable";
    unavailable.cause = error;
    throw unavailable;
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
