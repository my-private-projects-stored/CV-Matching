// ---------------------------------------------------------------------------
// Shared layout
// ---------------------------------------------------------------------------

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const BRAND_COLOR = process.env.BRAND_PRIMARY_COLOR || "#1D4ED8";

function wrapLayout(content, previewText = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  ${previewText ? `<meta name="description" content="${esc(previewText)}" />` : ""}
  <title>CV Matching Platform</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: ${BRAND_COLOR}; padding: 28px 32px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 4px 0 0; color: rgba(255,255,255,0.75); font-size: 13px; }
    .body { padding: 32px; }
    .greeting { font-size: 15px; color: #1e293b; margin: 0 0 20px; }
    .card { background: #f8faff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 24px; margin: 20px 0; }
    .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
    .card .value { font-size: 15px; color: #0f172a; font-weight: 600; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; text-transform: capitalize; }
    .status-new { background: #dbeafe; color: #1d4ed8; }
    .status-screening { background: #fef9c3; color: #854d0e; }
    .status-interview { background: #dcfce7; color: #166534; }
    .status-offer { background: #f3e8ff; color: #6b21a8; }
    .status-hired { background: #dcfce7; color: #14532d; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    .score-row { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
    .score-bar-bg { flex: 1; height: 8px; background: #e2e8f0; border-radius: 100px; overflow: hidden; }
    .score-bar-fill { height: 100%; border-radius: 100px; background: ${BRAND_COLOR}; }
    .score-pct { font-size: 14px; font-weight: 700; color: ${BRAND_COLOR}; min-width: 40px; text-align: right; }
    .keywords { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
    .kw-match { background: #dcfce7; color: #166534; padding: 3px 10px; border-radius: 100px; font-size: 12px; font-weight: 600; }
    .kw-miss { background: #fee2e2; color: #991b1b; padding: 3px 10px; border-radius: 100px; font-size: 12px; font-weight: 600; }
    .cta { text-align: center; margin: 28px 0 8px; }
    .cta a { display: inline-block; background: ${BRAND_COLOR}; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
    .footer { padding: 20px 32px; border-top: 1px solid #f1f5f9; background: #f8faff; }
    .footer p { margin: 0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6; }
    .footer a { color: #64748b; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>CV Matching Platform</h1>
      <p>Smart Recruitment · AI-Powered</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>You received this email because you have an active account on <strong>CV Matching Platform</strong>.<br/>
      If this was unexpected, please <a href="${APP_BASE_URL}">visit your dashboard</a>.</p>
    </div>
  </div>
</body>
</html>`;
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadge(status) {
  const cls = `status-${String(status || "new").toLowerCase()}`;
  return `<span class="status-badge ${cls}">${esc(status)}</span>`;
}

function scoreBar(pct) {
  const clamped = Math.min(100, Math.max(0, Math.round(Number(pct || 0) * 100)));
  return `
    <div class="score-row">
      <div class="score-bar-bg">
        <div class="score-bar-fill" style="width:${clamped}%"></div>
      </div>
      <span class="score-pct">${clamped}%</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// Template: application_status_changed
// ---------------------------------------------------------------------------

/**
 * @param {{ candidateName, jobTitle, jobLocation, fromStatus, toStatus, applicationId }} data
 */
export function buildStatusChangedEmail(data) {
  const {
    candidateName = "Candidate",
    jobTitle = "the position",
    jobLocation = "",
    fromStatus,
    toStatus = "new",
    applicationId,
  } = data;

  const ctaUrl = `${APP_BASE_URL}/applications`;
  const locationLine = jobLocation ? `<br/><small style="color:#64748b">${esc(jobLocation)}</small>` : "";

  const fromLine = fromStatus
    ? `<div style="display:flex;align-items:center;gap:8px;margin:12px 0;">
        ${statusBadge(fromStatus)}
        <span style="color:#64748b;font-size:13px;">→</span>
        ${statusBadge(toStatus)}
       </div>`
    : `<div style="margin:12px 0;">${statusBadge(toStatus)}</div>`;

  const subject = `Your application status has been updated — ${jobTitle}`;

  const content = `
    <p class="greeting">Hi <strong>${esc(candidateName)}</strong>,</p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      Your application for the following position has been updated:
    </p>
    <div class="card">
      <div class="label">Position</div>
      <div class="value">${esc(jobTitle)}${locationLine}</div>
      <div style="margin-top:16px;">
        <div class="label">Status Update</div>
        ${fromLine}
      </div>
    </div>
    <p style="font-size:13px;color:#64748b;margin:16px 0;">
      Log in to your dashboard to view details and track your application progress.
    </p>
    <div class="cta">
      <a href="${ctaUrl}">View My Applications</a>
    </div>
  `;

  return { subject, html: wrapLayout(content, `Your application for ${jobTitle} has been updated to: ${toStatus}`) };
}

// ---------------------------------------------------------------------------
// Template: ai_scoring_completed
// ---------------------------------------------------------------------------

/**
 * @param {{ candidateName, jobTitle, applicationId, aiScores, aiDetails }} data
 */
export function buildAiScoringCompletedEmail(data) {
  const {
    candidateName = "Candidate",
    jobTitle = "the position",
    applicationId,
    aiScores = {},
    aiDetails = {},
  } = data;

  const hybridScore = Number(aiScores.hybridScore || 0);
  const matchedKws = Array.isArray(aiDetails.matchedKeywords) ? aiDetails.matchedKeywords.slice(0, 8) : [];
  const missingKws = Array.isArray(aiDetails.missingKeywords) ? aiDetails.missingKeywords.slice(0, 5) : [];
  const pct = Math.round(hybridScore * 100);
  const ctaUrl = `${APP_BASE_URL}/applications`;

  const matchedSection = matchedKws.length
    ? `<div style="margin-top:12px;"><div class="label">✅ Matched Keywords</div>
       <div class="keywords">${matchedKws.map((k) => `<span class="kw-match">${esc(k)}</span>`).join("")}</div></div>`
    : "";

  const missingSection = missingKws.length
    ? `<div style="margin-top:12px;"><div class="label">⚠️ Missing Keywords to improve</div>
       <div class="keywords">${missingKws.map((k) => `<span class="kw-miss">${esc(k)}</span>`).join("")}</div></div>`
    : "";

  const subject = `Your AI match score is ready — ${jobTitle}`;

  const content = `
    <p class="greeting">Hi <strong>${esc(candidateName)}</strong>,</p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      Our AI has finished analyzing your resume against <strong>${esc(jobTitle)}</strong>.
      Here is your match report:
    </p>
    <div class="card">
      <div class="label">AI Match Score</div>
      <div style="margin-top:8px;">${scoreBar(hybridScore)}</div>
      <div style="font-size:13px;color:#64748b;margin-top:4px;">
        ${pct >= 70 ? "🎉 Great match! Your profile strongly aligns with this role." :
          pct >= 45 ? "👍 Good match with room to improve." :
          "📝 Consider tailoring your resume to better match this role."}
      </div>
      ${matchedSection}
      ${missingSection}
    </div>
    <p style="font-size:13px;color:#64748b;margin:16px 0;">
      Log in to view your full feedback and get personalized improvement tips.
    </p>
    <div class="cta">
      <a href="${ctaUrl}">View Full Feedback</a>
    </div>
  `;

  return { subject, html: wrapLayout(content, `Your match score for ${jobTitle} is ${pct}%`) };
}

// ---------------------------------------------------------------------------
// Template: job_closed
// ---------------------------------------------------------------------------

/**
 * @param {{ candidateName, jobTitle, jobLocation }} data
 */
export function buildJobClosedEmail(data) {
  const {
    candidateName = "Candidate",
    jobTitle = "the position",
    jobLocation = "",
  } = data;

  const locationLine = jobLocation ? ` in <em>${esc(jobLocation)}</em>` : "";
  const ctaUrl = `${APP_BASE_URL}/jobs`;

  const subject = `Update on your application — ${jobTitle}`;

  const content = `
    <p class="greeting">Hi <strong>${esc(candidateName)}</strong>,</p>
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      We wanted to let you know that the following position has been closed:
    </p>
    <div class="card">
      <div class="label">Position</div>
      <div class="value">${esc(jobTitle)}${locationLine}</div>
      <div style="margin-top:12px;font-size:13px;color:#64748b;">
        Your application has been kept on file. We encourage you to explore other open positions
        that match your profile.
      </div>
    </div>
    <p style="font-size:13px;color:#64748b;margin:16px 0;">
      Thank you for your interest. We wish you the best in your job search.
    </p>
    <div class="cta">
      <a href="${ctaUrl}">Browse Open Jobs</a>
    </div>
  `;

  return { subject, html: wrapLayout(content, `The position ${jobTitle} has been closed`) };
}
