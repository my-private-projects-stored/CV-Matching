import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const BASE_URL = process.env.LIVE_BASE_URL || "http://localhost";
const MONGO_USER = process.env.MONGO_ROOT_USERNAME || "admin";
const MONGO_PASS = process.env.MONGO_ROOT_PASSWORD || "admin123";

function runMongoEval(dbName, jsExpr) {
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASS}@127.0.0.1:27017/${dbName}?authSource=admin`;
  return execFileSync(
    "docker",
    ["exec", "cvm-mongo", "mongosh", "--quiet", uri, "--eval", jsExpr],
    { encoding: "utf8" }
  ).trim();
}

function runRedisCli(...args) {
  return execFileSync("docker", ["exec", "cvm-redis", "redis-cli", ...args], {
    encoding: "utf8",
  }).trim();
}

function clearAuthRateLimits() {
  const keysRaw = runRedisCli("--scan", "--pattern", "ratelimit:*");
  const keys = keysRaw
    .split(/\r?\n/)
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length > 0) {
    runRedisCli("DEL", ...keys);
  }
}

async function apiJson(path, { method = "GET", token = null, headers = {}, body = undefined } = {}) {
  const mergedHeaders = { ...headers };
  if (token) mergedHeaders.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined && !(body instanceof FormData) && typeof body !== "string") {
    mergedHeaders["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: mergedHeaders,
    body: payload,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

function extractRefreshCookie(res) {
  const raw = res.headers.get("set-cookie") || "";
  const match = raw.match(/cvm_refresh_token=([^;]+)/);
  return { raw, value: match ? match[1] : null };
}

function buildValidPdfBuffer(title = "Candidate Resume", lines = []) {
  const safe = [title, ...lines]
    .map((line) => String(line || "").replace(/[^\x20-\x7E]/g, " ").replace(/[()\\]/g, "").slice(0, 90))
    .filter(Boolean)
    .slice(0, 20);
  const ops = safe.map((line, idx) => `BT /F1 11 Tf 50 ${740 - idx * 18} Td (${line}) Tj ET`).join("\n");
  const objs = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(ops, "utf8")} >>\nstream\n${ops}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function buildMinimalDocxBuffer() {
  // Minimal valid ZIP local-file-header magic bytes (PK\x03\x04) for DOCX signature check
  const header = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  const text = Buffer.from("word/document.xml Senior Node.js MongoDB Docker Engineer");
  return Buffer.concat([header, text]);
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

test("Wave T2 Live Contract: Public/Auth & Candidate Portal (T2.1 - T2.7) on 19-container Docker stack", async (t) => {
  clearAuthRateLimits();

  const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const candEmail = `t2-cand-${runId}@example.com`;
  const recEmail = `t2-rec-${runId}@example.com`;
  const lockEmail = `t2-lock-${runId}@example.com`;
  const quotaEmail = `t2-quota-${runId}@example.com`;
  const password = "Password123!";
  const newPassword = "NewPassword456!";

  let candToken = "";
  let candId = "";
  let candRefreshCookie = "";
  let recToken = "";
  let masterResumeId = "";
  let blankResumeId = "";
  let jobId = "";
  let job2Id = "";
  let applicationId = "";
  let draftAppId = "";

  // ── T2.1: Public & Auth ──────────────────────────────────────────────────────
  await t.test("T2.1 Signup, HttpOnly SameSite=Strict cookie, Silent Refresh, Forgot/Reset Password, Lockout 429", async () => {
    const candSignup = await apiJson("/api/auth/signup", {
      method: "POST",
      body: { email: candEmail, password, full_name: "T2 Candidate User", role: "candidate" },
    });
    assert.equal(candSignup.res.status, 201, candSignup.text);
    const cookie = extractRefreshCookie(candSignup.res);
    assert.ok(cookie.value, "cvm_refresh_token cookie should be set");
    assert.ok(cookie.raw.toLowerCase().includes("httponly"), "cookie must be HttpOnly");
    assert.ok(cookie.raw.toLowerCase().includes("samesite=strict"), "cookie must be SameSite=Strict");
    assert.ok(candSignup.json?.access_token);
    assert.equal(candSignup.json?.user?.full_name, "T2 Candidate User");
    assert.equal(candSignup.json?.user?.role, "candidate");
    candToken = candSignup.json.access_token;
    candId = candSignup.json.user.id;
    candRefreshCookie = cookie.value;

    const recSignup = await apiJson("/api/auth/signup", {
      method: "POST",
      body: { email: recEmail, password, full_name: "T2 Recruiter User", role: "recruiter" },
    });
    assert.equal(recSignup.res.status, 201, recSignup.text);
    assert.equal(recSignup.json?.user?.role, "recruiter");
    recToken = recSignup.json.access_token;

    // Silent refresh using ONLY Cookie header (no JSON body token)
    const refreshResp = await apiJson("/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: `cvm_refresh_token=${candRefreshCookie}` },
      body: {},
    });
    assert.equal(refreshResp.res.status, 200, refreshResp.text);
    assert.ok(refreshResp.json?.access_token);
    candToken = refreshResp.json.access_token;

    // Forgot password returns non-empty message and stores resetPasswordTokenHash in MongoDB
    const lockSignup = await apiJson("/api/auth/signup", {
      method: "POST",
      body: { email: lockEmail, password, full_name: "T2 Lockout User", role: "candidate" },
    });
    assert.equal(lockSignup.res.status, 201, lockSignup.text);

    const forgotResp = await apiJson("/api/auth/forgot-password", {
      method: "POST",
      body: { email: lockEmail },
    });
    assert.equal(forgotResp.res.status, 200, forgotResp.text);
    assert.ok(forgotResp.json?.message, "forgot-password must return message");

    // Set known reset token hash in cvm_auth.users and test /api/auth/reset-password
    const knownResetToken = `reset-${runId}`;
    const knownHash = crypto.createHash("sha256").update(knownResetToken).digest("hex");
    runMongoEval(
      "cvm_auth",
      `db.users.updateOne({ email: ${JSON.stringify(lockEmail)} }, { $set: { resetPasswordTokenHash: ${JSON.stringify(knownHash)}, resetPasswordExpiresAt: new Date(Date.now() + 600000) } })`
    );

    const resetResp = await apiJson("/api/auth/reset-password", {
      method: "POST",
      body: { token: knownResetToken, new_password: newPassword },
    });
    assert.equal(resetResp.res.status, 200, resetResp.text);
    assert.ok(resetResp.json?.message);

    // Old password fails (401), new password succeeds (200)
    clearAuthRateLimits();
    const oldLogin = await apiJson("/api/auth/login", {
      method: "POST",
      body: { email: lockEmail, password },
    });
    assert.equal(oldLogin.res.status, 401);

    const newLogin = await apiJson("/api/auth/login", {
      method: "POST",
      body: { email: lockEmail, password: newPassword },
    });
    assert.equal(newLogin.res.status, 200, newLogin.text);

    // 5 consecutive wrong password attempts -> 5th returns 429
    clearAuthRateLimits();
    for (let i = 1; i <= 4; i += 1) {
      clearAuthRateLimits();
      const fail = await apiJson("/api/auth/login", {
        method: "POST",
        body: { email: lockEmail, password: "WrongPassword999!" },
      });
      assert.equal(fail.res.status, 401, `Attempt ${i} should be 401`);
    }
    clearAuthRateLimits();
    const fail5 = await apiJson("/api/auth/login", {
      method: "POST",
      body: { email: lockEmail, password: "WrongPassword999!" },
    });
    assert.equal(fail5.res.status, 429, fail5.text);
    assert.ok(
      fail5.json?.error_code === "account_locked_temporarily" ||
        fail5.json?.error_code === "rate_limit_exceeded"
    );

    clearAuthRateLimits();
  });

  // ── T2.2: Resumes & Upload Security ──────────────────────────────────────────
  await t.test("T2.2 Upload PDF/TXT/DOCX, Magic Bytes 400, >4MB 413, Blank CV, Master, Rename, Download, Delete", async () => {
    // 1. Spoofed .exe disguised as .pdf -> 400
    const spoofForm = new FormData();
    spoofForm.append(
      "file",
      new Blob([Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03])], { type: "application/pdf" }),
      "malware.pdf"
    );
    const spoofRes = await apiJson("/api/resumes/upload", {
      method: "POST",
      token: candToken,
      body: spoofForm,
    });
    assert.equal(spoofRes.res.status, 400, spoofRes.text);
    assert.equal(spoofRes.json?.error_code, "invalid_file_signature");

    // 2. Oversized > 4MB -> 413
    const bigForm = new FormData();
    const bigBuf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(4 * 1024 * 1024 + 1024, 0x41)]);
    bigForm.append("file", new Blob([bigBuf], { type: "application/pdf" }), "oversized.pdf");
    const bigRes = await apiJson("/api/resumes/upload", {
      method: "POST",
      token: candToken,
      body: bigForm,
    });
    assert.equal(bigRes.res.status, 413, bigRes.text);

    // 3. Valid PDF upload -> 201
    const pdfContent = buildValidPdfBuffer("T2 Candidate Resume", [
      "Senior Node.js TypeScript MongoDB Redis Docker Engineer",
      "Experienced in microservices, Qdrant vector search, and distributed systems.",
    ]);
    const pdfForm = new FormData();
    pdfForm.append("file", new Blob([pdfContent], { type: "application/pdf" }), "candidate-cv.pdf");
    pdfForm.append("title", "Primary Backend CV");
    const pdfRes = await apiJson("/api/resumes/upload", {
      method: "POST",
      token: candToken,
      body: pdfForm,
    });
    assert.equal(pdfRes.res.status, 201, pdfRes.text);
    assert.ok(pdfRes.json?.resume_id);
    assert.equal(pdfRes.json?.processing_status, "ready");
    masterResumeId = pdfRes.json.resume_id;

    // 4. Valid TXT upload -> 201
    const txtForm = new FormData();
    txtForm.append(
      "file",
      new Blob([Buffer.from("Backend Engineer experienced in Node.js, MongoDB, Redis, Qdrant.")], {
        type: "text/plain",
      }),
      "resume.txt"
    );
    const txtRes = await apiJson("/api/resumes/upload", {
      method: "POST",
      token: candToken,
      body: txtForm,
    });
    assert.equal(txtRes.res.status, 201, txtRes.text);
    const txtResumeId = txtRes.json.resume_id;

    // 5. Valid DOCX (ZIP signature) upload -> 201
    const docxForm = new FormData();
    docxForm.append(
      "file",
      new Blob([buildMinimalDocxBuffer()], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "resume.docx"
    );
    const docxRes = await apiJson("/api/resumes/upload", {
      method: "POST",
      token: candToken,
      body: docxForm,
    });
    assert.equal(docxRes.res.status, 201, docxRes.text);
    const docxResumeId = docxRes.json.resume_id;

    // 6. Create blank resume, set-as-master, rename, download URL + stream, delete temp resumes
    const blankRes = await apiJson("/api/resumes", {
      method: "POST",
      token: candToken,
      body: { title: "Blank Builder CV" },
    });
    assert.equal(blankRes.res.status, 201, blankRes.text);
    blankResumeId = blankRes.json?.data?.resume_id;
    assert.ok(blankResumeId);

    const setMasterRes = await apiJson(`/api/resumes/${masterResumeId}/set-as-master`, {
      method: "POST",
      token: candToken,
      body: {},
    });
    assert.equal(setMasterRes.res.status, 200, setMasterRes.text);
    assert.equal(setMasterRes.json?.data?.is_master, true);

    const renameRes = await apiJson(`/api/resumes/${masterResumeId}/title`, {
      method: "PATCH",
      token: candToken,
      body: { title: "Renamed Master CV" },
    });
    assert.equal(renameRes.res.status, 200, renameRes.text);
    assert.equal(renameRes.json?.data?.title, "Renamed Master CV");

    const presignedRes = await apiJson(`/api/resumes/${masterResumeId}/download`, {
      token: candToken,
    });
    assert.equal(presignedRes.res.status, 200, presignedRes.text);
    assert.ok(presignedRes.json?.downloadUrl);

    const streamRes = await fetch(`${BASE_URL}/api/resumes/${masterResumeId}/download?mode=stream`, {
      headers: { Authorization: `Bearer ${candToken}` },
    });
    assert.equal(streamRes.status, 200);
    const streamBytes = Buffer.from(await streamRes.arrayBuffer());
    assert.ok(streamBytes.toString("utf8", 0, 5).startsWith("%PDF-"));

    // Delete temporary TXT & DOCX resumes
    const delTxt = await apiJson(`/api/resumes/${txtResumeId}`, { method: "DELETE", token: candToken });
    assert.equal(delTxt.res.status, 200, delTxt.text);
    const delDocx = await apiJson(`/api/resumes/${docxResumeId}`, { method: "DELETE", token: candToken });
    assert.equal(delDocx.res.status, 200, delDocx.text);
  });

  // ── T2.3: Builder, Version History & Cover Letter ────────────────────────────
  await t.test("T2.3 Builder save & reload, section reorder, version history & restore, cover letter & PDF", async () => {
    const v1Builder = {
      sections: {
        personalInfo: { name: "T2 Candidate User", title: "Senior Node.js Engineer", email: candEmail },
        summary: "Senior Node.js Engineer v1 with MongoDB and Redis expertise.",
        workExperience: [
          { id: 1, title: "Backend Engineer", company: "TechCorp", years: "2022-2025", description: ["Built microservices"] },
        ],
        education: [{ id: 1, institution: "HCMUT", degree: "BSc CS", years: "2018-2022" }],
        personalProjects: [],
        additional: { technicalSkills: ["Node.js", "TypeScript", "MongoDB", "Redis", "Docker"] },
      },
      sectionMeta: [
        { id: "summary", key: "summary", order: 0 },
        { id: "workExperience", key: "workExperience", order: 1 },
      ],
    };

    const patchV1 = await apiJson(`/api/resumes/${blankResumeId}`, {
      method: "PATCH",
      token: candToken,
      body: { builderData: v1Builder },
    });
    assert.equal(patchV1.res.status, 200, patchV1.text);

    const detailV1 = await apiJson(`/api/resumes?resume_id=${blankResumeId}`, { token: candToken });
    assert.equal(detailV1.res.status, 200, detailV1.text);
    assert.equal(
      detailV1.json?.data?.processed_resume?.summary,
      "Senior Node.js Engineer v1 with MongoDB and Redis expertise."
    );

    // Reorder sections + save v2
    const reorderRes = await apiJson(`/api/resumes/${blankResumeId}/sections/reorder`, {
      method: "PATCH",
      token: candToken,
      body: { section_ids: ["workExperience", "summary"] },
    });
    assert.equal(reorderRes.res.status, 200, reorderRes.text);

    const v2Builder = {
      ...v1Builder,
      sections: {
        ...v1Builder.sections,
        summary: "Principal Distributed Systems Engineer v2.",
      },
    };
    const patchV2 = await apiJson(`/api/resumes/${blankResumeId}`, {
      method: "PATCH",
      token: candToken,
      body: { builderData: v2Builder },
    });
    assert.equal(patchV2.res.status, 200, patchV2.text);

    const historyRes = await apiJson(`/api/resumes/${blankResumeId}/history`, { token: candToken });
    assert.equal(historyRes.res.status, 200, historyRes.text);
    const versions = historyRes.json?.data?.versions || [];
    assert.ok(versions.length >= 2, `Expected >=2 versions, got ${versions.length}`);
    for (const v of versions) {
      assert.ok(v.resume_id);
      assert.ok(v.updated_at);
      assert.ok(v.processing_status);
    }

    const v1Snapshot = versions.find((v) => v.resume_id !== blankResumeId && v.parent_id === blankResumeId);
    assert.ok(v1Snapshot, "Expected a historical snapshot to restore");
    const restoreRes = await apiJson(`/api/resumes/${blankResumeId}/restore/${v1Snapshot.resume_id}`, {
      method: "PUT",
      token: candToken,
      body: {},
    });
    assert.equal(restoreRes.res.status, 200, restoreRes.text);

    // Generate cover letter, update it, verify persistence, download PDF
    const genCover = await apiJson(`/api/resumes/${blankResumeId}/generate-cover-letter`, {
      method: "POST",
      token: candToken,
      body: {},
    });
    assert.equal(genCover.res.status, 200, genCover.text);
    assert.ok(genCover.json?.content);

    const updatedCoverText = `Edited Cover Letter ${runId}`;
    const saveCover = await apiJson(`/api/resumes/${blankResumeId}/cover-letter`, {
      method: "PATCH",
      token: candToken,
      body: { content: updatedCoverText },
    });
    assert.equal(saveCover.res.status, 200, saveCover.text);

    const detailAfterCover = await apiJson(`/api/resumes?resume_id=${blankResumeId}`, { token: candToken });
    assert.equal(detailAfterCover.res.status, 200);
    assert.equal(detailAfterCover.json?.data?.cover_letter, updatedCoverText);
    assert.equal(detailAfterCover.json?.data?.coverLetter, updatedCoverText);

    const coverPdfRes = await fetch(`${BASE_URL}/api/resumes/${blankResumeId}/cover-letter/pdf`, {
      headers: { Authorization: `Bearer ${candToken}` },
    });
    assert.equal(coverPdfRes.status, 200);
    assert.ok((coverPdfRes.headers.get("content-type") || "").includes("application/pdf"));
    const coverPdfBytes = Buffer.from(await coverPdfRes.arrayBuffer());
    assert.ok(coverPdfBytes.toString("utf8", 0, 5).startsWith("%PDF-"));
  });

  // ── T2.4: Jobs Search (Redis Cache-Aside) & Qdrant HNSW Recommendations ───────
  await t.test("T2.4 Active Job creation, Redis Cache-Aside miss->hit, Apply 201 & duplicate 409, Qdrant HNSW recommendations", async () => {
    const uniqueTerm = `T2Vector${runId}`;
    const createJob1 = await apiJson("/api/jobs", {
      method: "POST",
      token: recToken,
      body: {
        title: `Senior Node.js Engineer ${uniqueTerm}`,
        description: "Build scalable microservices using Node.js, TypeScript, MongoDB, Redis, Docker, Qdrant.",
        requirements: "Node.js TypeScript MongoDB Redis Docker",
        skills: ["Node.js", "TypeScript", "MongoDB", "Redis", "Docker"],
        category: "IT",
        location: "Ho Chi Minh City",
        experienceLevel: "Senior",
        status: "active",
      },
    });
    assert.equal(createJob1.res.status, 201, createJob1.text);
    jobId = createJob1.json?._id || createJob1.json?.data?._id;
    assert.ok(jobId);

    const createJob2 = await apiJson("/api/jobs", {
      method: "POST",
      token: recToken,
      body: {
        title: `Platform Engineer ${uniqueTerm}`,
        description: "Work with Docker, Redis, Node.js, and MongoDB clusters.",
        requirements: "Docker Redis Node.js MongoDB",
        skills: ["Docker", "Redis", "Node.js", "MongoDB"],
        category: "IT",
        location: "Ha Noi",
        experienceLevel: "Mid",
        status: "active",
      },
    });
    assert.equal(createJob2.res.status, 201, createJob2.text);
    job2Id = createJob2.json?._id || createJob2.json?.data?._id;

    // Cache-Aside miss -> hit
    const search1 = await apiJson(`/api/recommendations/search?q=${encodeURIComponent(uniqueTerm)}`, {
      token: candToken,
    });
    assert.equal(search1.res.status, 200, search1.text);
    assert.equal(search1.json?.cache_hit, false);
    assert.ok((search1.json?.jobs || []).length >= 1);

    const search2 = await apiJson(`/api/recommendations/search?q=${encodeURIComponent(uniqueTerm)}`, {
      token: candToken,
    });
    assert.equal(search2.res.status, 200, search2.text);
    assert.equal(search2.json?.cache_hit, true);

    const jobDetail = await apiJson(`/api/jobs/${jobId}`, { token: candToken });
    assert.equal(jobDetail.res.status, 200, jobDetail.text);

    // Apply -> 201, Duplicate apply -> 409
    const applyRes = await apiJson("/api/applications", {
      method: "POST",
      token: candToken,
      body: { job_id: jobId, resume_id: masterResumeId },
    });
    assert.equal(applyRes.res.status, 201, applyRes.text);
    applicationId = applyRes.json?.data?.application_id;
    assert.ok(applicationId);

    const dupRes = await apiJson("/api/applications", {
      method: "POST",
      token: candToken,
      body: { job_id: jobId, resume_id: masterResumeId },
    });
    assert.equal(dupRes.res.status, 409, dupRes.text);

    // Qdrant HNSW Recommendations
    const recRes = await apiJson(
      `/api/recommendations/jobs?resume_id=${encodeURIComponent(masterResumeId)}&score_threshold=0.1`,
      { token: candToken }
    );
    assert.equal(recRes.res.status, 200, recRes.text);
    assert.equal(recRes.json?.source, "qdrant_hnsw", recRes.text);
    assert.ok(Array.isArray(recRes.json?.data) && recRes.json.data.length >= 1);
    const firstRec = recRes.json.data[0];
    assert.ok(typeof firstRec.scores?.semantic_score === "number");
    assert.ok(typeof firstRec.scores?.keyword_score === "number");
    assert.ok(typeof firstRec.scores?.hybrid_score === "number");
    assert.ok(Array.isArray(firstRec.matched_keywords));
  });

  // ── T2.5: Applications History, Draft, OCC Withdraw & Feedback ───────────────
  await t.test("T2.5 Worker AI scoring completed, feedback, status-history, filtered history, draft OCC withdraw", async () => {
    let feedbackJson = null;
    for (let i = 0; i < 30; i += 1) {
      const fb = await apiJson(`/api/applications/${applicationId}/feedback`, { token: candToken });
      assert.equal(fb.res.status, 200, fb.text);
      if (fb.json?.data?.ai_status === "completed") {
        feedbackJson = fb.json;
        break;
      }
      await sleep(500);
    }
    assert.ok(feedbackJson, "Expected worker-scoring to complete within 15s");
    assert.equal(feedbackJson.data.job_id, jobId);
    assert.equal(feedbackJson.data.resume_id, masterResumeId);
    assert.equal(feedbackJson.data.status, "new");
    assert.ok(feedbackJson.data.scores.hybrid_score > 0);

    const statusHist = await apiJson(`/api/applications/${applicationId}/status-history`, {
      token: candToken,
    });
    assert.equal(statusHist.res.status, 200, statusHist.text);
    assert.ok(Array.isArray(statusHist.json?.data?.history) && statusHist.json.data.history.length >= 1);

    const histFiltered = await apiJson(`/api/applications/history?status=new&search=${encodeURIComponent(jobId.slice(-6))}`, {
      token: candToken,
    });
    assert.equal(histFiltered.res.status, 200, histFiltered.text);
    assert.ok((histFiltered.json?.data?.applications || []).length >= 1);
    assert.ok(histFiltered.json?.data?.pagination);

    // Draft + OCC 409 + Withdraw 200
    const draftRes = await apiJson("/api/applications", {
      method: "POST",
      token: candToken,
      body: { job_id: job2Id, resume_id: masterResumeId, status: "draft" },
    });
    assert.equal(draftRes.res.status, 201, draftRes.text);
    draftAppId = draftRes.json?.data?.application_id;

    const staleWithdraw = await apiJson(`/api/applications/${draftAppId}/withdraw`, {
      method: "POST",
      token: candToken,
      body: { __v: 999, reason: "Stale test" },
    });
    assert.equal(staleWithdraw.res.status, 409, staleWithdraw.text);
    assert.equal(staleWithdraw.json?.error_code, "optimistic_concurrency_conflict");

    const okWithdraw = await apiJson(`/api/applications/${draftAppId}/withdraw`, {
      method: "POST",
      token: candToken,
      body: { __v: 0, reason: "Candidate withdrew draft" },
    });
    assert.equal(okWithdraw.res.status, 200, okWithdraw.text);
    assert.equal(okWithdraw.json?.application?.status, "withdrawn");
  });

  // ── T2.6: Optimize CV, Enrichment, Quota 10/day & Practice Interview ─────────
  await t.test("T2.6 JD match, enrichment analyze/enhance/apply, 10/day quota 429, practice interview STAR & RBAC 403", async () => {
    const jdMatch = await apiJson(`/api/resumes/${masterResumeId}/jd-match`, {
      method: "POST",
      token: candToken,
      body: {
        job_description: "Looking for Node.js, TypeScript, MongoDB, Redis, Kubernetes engineer.",
        resume_text: "Experienced Node.js, TypeScript, MongoDB, Redis engineer.",
        include_highlights: true,
      },
    });
    assert.equal(jdMatch.res.status, 200, jdMatch.text);
    assert.ok(typeof jdMatch.json?.data?.match_percentage === "number");
    assert.ok(Array.isArray(jdMatch.json?.data?.jd_highlights));
    assert.ok(Array.isArray(jdMatch.json?.data?.resume_highlights));

    const analyze = await apiJson(`/api/enrichment/analyze/${masterResumeId}`, {
      method: "POST",
      token: candToken,
      body: {},
    });
    assert.equal(analyze.res.status, 200, analyze.text);
    assert.ok((analyze.json?.questions || []).length >= 1);

    const enhance = await apiJson("/api/enrichment/enhance", {
      method: "POST",
      token: candToken,
      body: {
        resume_id: masterResumeId,
        answers: [{ question_id: analyze.json.questions[0].question_id, answer: "Reduced latency by 45%" }],
      },
    });
    assert.equal(enhance.res.status, 200, enhance.text);
    assert.ok((enhance.json?.enhancements || []).length >= 1);

    const applyEnh = await apiJson(`/api/enrichment/apply/${masterResumeId}`, {
      method: "POST",
      token: candToken,
      body: { enhancements: enhance.json.enhancements },
    });
    assert.equal(applyEnh.res.status, 200, applyEnh.text);

    // Quota 10/day on dedicated throwaway candidate
    const quotaSignup = await apiJson("/api/auth/signup", {
      method: "POST",
      body: { email: quotaEmail, password, full_name: "T2 Quota User", role: "candidate" },
    });
    assert.equal(quotaSignup.res.status, 201, quotaSignup.text);
    const quotaToken = quotaSignup.json.access_token;

    for (let i = 1; i <= 10; i += 1) {
      const qRes = await apiJson("/api/enrichment/optimize-cv", {
        method: "POST",
        token: quotaToken,
        body: {
          resumeId: `res-q-${runId}-${i}`,
          jobId: `job-q-${runId}-${i}`,
          resumeText: "Node.js developer",
          jobDescription: "Node.js MongoDB engineer",
        },
      });
      assert.equal(qRes.res.status, 200, `Quota call ${i} failed: ${qRes.text}`);
    }
    const q11 = await apiJson("/api/enrichment/optimize-cv", {
      method: "POST",
      token: quotaToken,
      body: {
        resumeId: `res-q-${runId}-11`,
        jobId: `job-q-${runId}-11`,
        resumeText: "Node.js developer",
        jobDescription: "Node.js MongoDB engineer",
      },
    });
    assert.equal(q11.res.status, 429, q11.text);
    assert.equal(q11.json?.error_code, "llm_daily_quota_exceeded");

    // Practice interview STAR + Recruiter audience forbidden (403) for candidate
    const practice = await apiJson("/api/interviews/questions", {
      method: "POST",
      token: candToken,
      body: {
        jobTitle: "Backend Node.js Engineer",
        skills: ["Node.js", "MongoDB", "Redis"],
        language: "en",
        targetAudience: "candidate",
      },
    });
    assert.ok(practice.res.status === 200 || practice.res.status === 201, practice.text);
    assert.ok((practice.json?.questionSet?.questions || []).length >= 1);
    assert.ok(
      practice.json.questionSet.questions.some((q) =>
        String(q.expectedSignal || "").toUpperCase().includes("STAR")
      ),
      "Expected STAR guidance in practice interview questions"
    );

    const forbiddenRecQ = await apiJson("/api/interviews/questions", {
      method: "POST",
      token: candToken,
      body: {
        jobTitle: "Backend Node.js Engineer",
        skills: ["Node.js"],
        language: "en",
        targetAudience: "recruiter",
      },
    });
    assert.equal(forbiddenRecQ.res.status, 403, forbiddenRecQ.text);
  });

  // ── T2.7: SSE Notifications, Encrypted PII in MongoDB & Settings ─────────────
  await t.test("T2.7 Live SSE stream, notifications read, encrypted profile PII in MongoDB, language & password change, 0 DLQ", async () => {
    // 1. Open SSE stream and trigger a real status transition by recruiter to receive live SSE event
    const sseController = new AbortController();
    const sseRes = await fetch(
      `${BASE_URL}/api/notifications/stream?token=${encodeURIComponent(candToken)}`,
      { signal: sseController.signal }
    );
    let sseBuffer = "";
    try {
      assert.equal(sseRes.status, 200);
      assert.ok((sseRes.headers.get("content-type") || "").includes("text/event-stream"));

      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();

      // Wait for initial ": connected"
      const firstChunk = await Promise.race([
        reader.read(),
        sleep(3000).then(() => ({ value: null, done: true })),
      ]);
      if (firstChunk.value) {
        sseBuffer += decoder.decode(firstChunk.value, { stream: true });
      }
      assert.ok(sseBuffer.includes(": connected"), `Expected SSE connected frame, got: ${sseBuffer}`);

      // Trigger real status change by recruiter -> Outbox -> Redis Pub/Sub -> notification-service -> SSE
      const statusPatch = await apiJson(`/api/applications/${applicationId}/status`, {
        method: "PATCH",
        token: recToken,
        body: { status: "screening", reason: "Strong Node.js match" },
      });
      assert.equal(statusPatch.res.status, 200, statusPatch.text);

      const deadline = Date.now() + 8000;
      while (!sseBuffer.includes("event: notification") && Date.now() < deadline) {
        const next = await Promise.race([
          reader.read(),
          sleep(1000).then(() => ({ value: null, done: false })),
        ]);
        if (next.value) {
          sseBuffer += decoder.decode(next.value, { stream: true });
        }
      }
    } finally {
      sseController.abort();
    }
    assert.ok(sseBuffer.includes("event: notification"), `Expected live SSE notification frame, got: ${sseBuffer}`);

    // Notifications list, unread-count, mark read-all
    const notifList = await apiJson("/api/notifications", { token: candToken });
    assert.equal(notifList.res.status, 200, notifList.text);
    assert.ok((notifList.json?.data || []).length >= 1);

    const readAll = await apiJson("/api/notifications/read-all", { method: "PATCH", token: candToken, body: {} });
    assert.equal(readAll.res.status, 200, readAll.text);

    const unreadAfter = await apiJson("/api/notifications/unread-count", { token: candToken });
    assert.equal(unreadAfter.res.status, 200);
    assert.equal(unreadAfter.json?.data?.count, 0);

    // 2. Encrypted Profile PII in MongoDB + partial update preservation
    const putProfile = await apiJson("/api/candidate-profile/me", {
      method: "PUT",
      token: candToken,
      body: {
        phone: "+84901234567",
        location: "Thu Dau Mot, Binh Duong",
        summary: "Senior Distributed Systems Engineer",
        skills: ["Node.js", "MongoDB", "Redis"],
        experience: [{ title: "Engineer", company: "Acme", location: "HCM", start_date: "2022", end_date: "2025", summary: "Built APIs" }],
        education: [{ school: "HCMUT", degree: "BSc", field: "CS", start_date: "2018", end_date: "2022", summary: "" }],
      },
    });
    assert.equal(putProfile.res.status, 200, putProfile.text);
    assert.equal(putProfile.json?.data?.profile?.phone, "+84901234567");
    assert.equal(putProfile.json?.data?.profile?.location, "Thu Dau Mot, Binh Duong");

    // Partial update of headline must preserve encrypted phone & location
    const partialPut = await apiJson("/api/candidate-profile/me", {
      method: "PUT",
      token: candToken,
      body: { headline: "Principal Node.js Architect" },
    });
    assert.equal(partialPut.res.status, 200, partialPut.text);
    assert.equal(partialPut.json?.data?.profile?.phone, "+84901234567");
    assert.equal(partialPut.json?.data?.profile?.location, "Thu Dau Mot, Binh Duong");

    const rawMongoProfile = runMongoEval(
      "cvm_auth",
      `JSON.stringify(db.users.findOne({ _id: ObjectId(${JSON.stringify(candId)}) }).candidateProfile)`
    );
    const parsedRaw = JSON.parse(rawMongoProfile);
    assert.ok(String(parsedRaw.phone || "").startsWith("enc:v1:"), `Expected enc:v1: phone, got ${parsedRaw.phone}`);
    assert.ok(String(parsedRaw.location || "").startsWith("enc:v1:"), `Expected enc:v1: location, got ${parsedRaw.location}`);

    // 3. Language config, feature flags & Change password
    const langRes = await apiJson("/api/config/language", { token: candToken });
    assert.equal(langRes.res.status, 200, langRes.text);

    const featRes = await apiJson("/api/config/features", { token: candToken });
    assert.equal(featRes.res.status, 200, featRes.text);
    assert.equal(featRes.json?.enable_cover_letter, true);

    const chPass = await apiJson("/api/auth/change-password", {
      method: "POST",
      token: candToken,
      body: { current_password: password, new_password: newPassword },
    });
    assert.equal(chPass.res.status, 200, chPass.text);

    // Old token must be revoked (401)
    const meOld = await apiJson("/api/auth/me", { token: candToken });
    assert.equal(meOld.res.status, 401);

    // New password logs in (200)
    clearAuthRateLimits();
    const relogin = await apiJson("/api/auth/login", {
      method: "POST",
      body: { email: candEmail, password: newPassword },
    });
    assert.equal(relogin.res.status, 200, relogin.text);

    // 4. DLQ length == 0
    const scoringDlq = Number(runRedisCli("LLEN", "application_scoring_queue_dlq") || "0");
    const notifDlq = Number(runRedisCli("LLEN", "notification_queue_dlq") || "0");
    assert.equal(scoringDlq, 0, "application_scoring_queue_dlq should be empty");
    assert.equal(notifDlq, 0, "notification_queue_dlq should be empty");
  });
});

test("Wave T3 Live Contract: Recruiter Portal (T3.1 - T3.5) on 19-container Docker stack", async (t) => {
  clearAuthRateLimits();

  const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const recAEmail = `t3-reca-${runId}@example.com`;
  const recBEmail = `t3-recb-${runId}@example.com`;
  const cand1Email = `t3-cand1-${runId}@example.com`;
  const cand2Email = `t3-cand2-${runId}@example.com`;
  const password = "Password123!";
  const newPassword = "NewPassword456!";
  const taxCode = `370${String(Date.now()).slice(-7)}`;

  let recAToken = "";
  let recBToken = "";
  let cand1Token = "";
  let cand1Id = "";
  let cand1ResumeId = "";
  let cand2Token = "";
  let cand2ResumeId = "";
  let jobId = "";
  let job2Id = "";
  let app1Id = "";
  let app2Id = "";
  let app3Id = "";

  // ── T3.1: Company Profile & MST ──────────────────────────────────────────────
  await t.test("T3.1 Company profile save & reload, pending verification, duplicate taxCode 409", async () => {
    const recA = await apiJson("/api/auth/signup", {
      method: "POST",
      body: { email: recAEmail, password, full_name: "T3 Recruiter A", role: "recruiter" },
    });
    assert.equal(recA.res.status, 201, recA.text);
    recAToken = recA.json.access_token;

    const recB = await apiJson("/api/auth/signup", {
      method: "POST",
      body: { email: recBEmail, password, full_name: "T3 Recruiter B", role: "recruiter" },
    });
    assert.equal(recB.res.status, 201, recB.text);
    recBToken = recB.json.access_token;

    const putComp = await apiJson("/api/company/me", {
      method: "PUT",
      token: recAToken,
      body: {
        name: `TDMU Tech ${runId}`,
        taxCode,
        industry: "Software",
        website: "https://tdmu-tech.example.com",
        size: "50-200",
        location: "Thu Dau Mot",
        description: "AI Recruitment Engineering",
        brand_primary_color: "#1D4ED8",
      },
    });
    assert.equal(putComp.res.status, 200, putComp.text);
    assert.equal(putComp.json?.company?.verificationStatus, "pending");
    assert.equal(putComp.json?.company?.taxCode, taxCode);
    assert.equal(putComp.json?.company?.size, "50-200");
    assert.equal(putComp.json?.company?.location, "Thu Dau Mot");

    const getComp = await apiJson("/api/company/me", { token: recAToken });
    assert.equal(getComp.res.status, 200, getComp.text);
    assert.equal(getComp.json?.company?.taxCode, taxCode);
    assert.equal(getComp.json?.company?.brandPrimaryColor, "#1D4ED8");

    const dupComp = await apiJson("/api/company/me", {
      method: "PUT",
      token: recBToken,
      body: { name: `Copycat ${runId}`, taxCode },
    });
    assert.equal(dupComp.res.status, 409, dupComp.text);
    assert.equal(dupComp.json?.error_code, "duplicate_tax_code");
  });

  // ── T3.2: Job Lifecycle, Qdrant jobs_vectors & JobStatusMirror ───────────────
  await t.test("T3.2 Create active job, Qdrant sync, edit, close/reopen with JobStatusMirror & recruiter visibility, soft delete", async () => {
    const createJob = await apiJson("/api/jobs", {
      method: "POST",
      token: recAToken,
      body: {
        title: `T3 Senior Node.js Engineer ${runId}`,
        description: "Build distributed microservices with Node.js, TypeScript, MongoDB, Redis, Docker.",
        requirements: "Node.js TypeScript MongoDB Redis Docker",
        benefits: "13th month salary, hybrid work",
        applicationDeadline: "2027-06-30",
        skills: ["Node.js", "TypeScript", "MongoDB", "Redis", "Docker"],
        category: "IT",
        location: "Ho Chi Minh City",
        experienceLevel: "Senior",
        status: "active",
      },
    });
    assert.equal(createJob.res.status, 201, createJob.text);
    jobId = createJob.json?._id || createJob.json?.data?._id;
    assert.ok(jobId);
    assert.equal(createJob.json?.benefits, "13th month salary, hybrid work");

    const editJob = await apiJson(`/api/jobs/${jobId}`, {
      method: "PATCH",
      token: recAToken,
      body: { benefits: "13th month salary, hybrid work, health insurance" },
    });
    assert.equal(editJob.res.status, 200, editJob.text);

    // Close job -> JobStatusMirror becomes closed, Recruiter can still list it with status=closed
    const closeJob = await apiJson(`/api/jobs/${jobId}`, {
      method: "PATCH",
      token: recAToken,
      body: { status: "closed" },
    });
    assert.equal(closeJob.res.status, 200, closeJob.text);
    await sleep(400);

    const mirrorClosed = runMongoEval(
      "cvm_application",
      `JSON.stringify(db.job_status_mirror.findOne({ jobId: ${JSON.stringify(jobId)} }))`
    );
    assert.equal(JSON.parse(mirrorClosed)?.status, "closed");

    const listClosed = await apiJson("/api/jobs?status=closed", { token: recAToken });
    assert.equal(listClosed.res.status, 200, listClosed.text);
    assert.ok((listClosed.json?.data || []).some((j) => String(j._id) === jobId));

    // Reopen job -> JobStatusMirror becomes active
    const reopenJob = await apiJson(`/api/jobs/${jobId}`, {
      method: "PATCH",
      token: recAToken,
      body: { status: "active" },
    });
    assert.equal(reopenJob.res.status, 200, reopenJob.text);
    await sleep(400);

    const mirrorActive = runMongoEval(
      "cvm_application",
      `JSON.stringify(db.job_status_mirror.findOne({ jobId: ${JSON.stringify(jobId)} }))`
    );
    assert.equal(JSON.parse(mirrorActive)?.status, "active");

    // Soft-delete 2nd job
    const createJob2 = await apiJson("/api/jobs", {
      method: "POST",
      token: recAToken,
      body: {
        title: `T3 Temp Job ${runId}`,
        description: "Temporary job to delete",
        requirements: "Node.js",
        category: "IT",
        status: "active",
      },
    });
    assert.equal(createJob2.res.status, 201, createJob2.text);
    job2Id = createJob2.json?._id || createJob2.json?.data?._id;

    const delJob = await apiJson(`/api/jobs/${job2Id}`, { method: "DELETE", token: recAToken });
    assert.equal(delJob.res.status, 200, delJob.text);

    const getDeleted = await apiJson(`/api/jobs/${job2Id}`, { token: recAToken });
    assert.equal(getDeleted.res.status, 404);
  });

  // ── T3.3: Ranked Candidates, Bulk, MANUAL_SCREENING, Retry AI & Full OCC ─────
  await t.test("T3.3 Ranked candidates, filters, bulk update, retry-scoring, MANUAL_SCREENING, OCC 409 & terminal hired", async () => {
    clearAuthRateLimits();
    const c1 = await apiJson("/api/auth/signup", {
      method: "POST",
      body: { email: cand1Email, password, full_name: "T3 Candidate One", role: "candidate" },
    });
    assert.equal(c1.res.status, 201, c1.text);
    cand1Token = c1.json.access_token;
    cand1Id = c1.json.user.id;

    const c2 = await apiJson("/api/auth/signup", {
      method: "POST",
      body: { email: cand2Email, password, full_name: "T3 Candidate Two", role: "candidate" },
    });
    assert.equal(c2.res.status, 201, c2.text);
    cand2Token = c2.json.access_token;

    const form1 = new FormData();
    form1.append(
      "file",
      new Blob(
        [buildValidPdfBuffer("T3 Candidate One", ["Senior Node.js TypeScript MongoDB Redis Docker microservices"])],
        { type: "application/pdf" }
      ),
      "t3-cand1.pdf"
    );
    const up1 = await apiJson("/api/resumes/upload", { method: "POST", token: cand1Token, body: form1 });
    assert.equal(up1.res.status, 201, up1.text);
    cand1ResumeId = up1.json.resume_id;

    const form2 = new FormData();
    form2.append(
      "file",
      new Blob([buildValidPdfBuffer("T3 Candidate Two", ["Junior Marketing Content"])], { type: "application/pdf" }),
      "t3-cand2.pdf"
    );
    const up2 = await apiJson("/api/resumes/upload", { method: "POST", token: cand2Token, body: form2 });
    assert.equal(up2.res.status, 201, up2.text);
    cand2ResumeId = up2.json.resume_id;

    const sub1 = await apiJson("/api/applications", {
      method: "POST",
      token: cand1Token,
      body: { job_id: jobId, resume_id: cand1ResumeId },
    });
    assert.equal(sub1.res.status, 201, sub1.text);
    app1Id = sub1.json.data.application_id;

    const sub2 = await apiJson("/api/applications", {
      method: "POST",
      token: cand2Token,
      body: { job_id: jobId, resume_id: cand2ResumeId },
    });
    assert.equal(sub2.res.status, 201, sub2.text);
    app2Id = sub2.json.data.application_id;

    // 3rd application using a blank resume to test failed AI -> retry-scoring + MANUAL_SCREENING
    const blankRes = await apiJson("/api/resumes", {
      method: "POST",
      token: cand1Token,
      body: { title: "T3 Failed AI Test CV" },
    });
    assert.equal(blankRes.res.status, 201, blankRes.text);
    const sub3 = await apiJson("/api/applications", {
      method: "POST",
      token: cand1Token,
      body: { job_id: jobId, resume_id: blankRes.json.data.resume_id },
    });
    assert.equal(sub3.res.status, 201, sub3.text);
    app3Id = sub3.json.data.application_id;

    // Wait for worker-scoring on app1 & app2
    for (let i = 0; i < 30; i += 1) {
      const fb = await apiJson(`/api/applications/${app1Id}/feedback`, { token: recAToken });
      if (fb.json?.data?.ai_status === "completed") break;
      await sleep(500);
    }

    const ranked = await apiJson(`/api/applications/ranked?job_id=${encodeURIComponent(jobId)}`, {
      token: recAToken,
    });
    assert.equal(ranked.res.status, 200, ranked.text);
    assert.ok((ranked.json?.data?.candidates || []).length >= 2);

    const minFiltered = await apiJson(
      `/api/applications/ranked?job_id=${encodeURIComponent(jobId)}&min_score=0.01`,
      { token: recAToken }
    );
    assert.equal(minFiltered.res.status, 200, minFiltered.text);

    // Bulk update app2 -> screening
    const bulkRes = await apiJson("/api/applications/status/bulk", {
      method: "PATCH",
      token: recAToken,
      body: { application_ids: [app2Id], status: "screening" },
    });
    assert.equal(bulkRes.res.status, 200, bulkRes.text);
    assert.equal(bulkRes.json?.data?.updated_count, 1);

    // Mark app3 failed via internal endpoint, test retry-scoring, then mark failed again and test MANUAL_SCREENING
    const markFail1 = await fetch(`http://127.0.0.1:5004/internal/applications/${app3Id}/mark-failed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": "dev-worker-token" },
      body: JSON.stringify({ error: "Simulated AI failure" }),
    });
    assert.equal(markFail1.status, 200);

    const retryRes = await apiJson(`/api/applications/${app3Id}/retry-scoring`, {
      method: "POST",
      token: recAToken,
      body: {},
    });
    assert.equal(retryRes.res.status, 200, retryRes.text);
    assert.equal(retryRes.json?.application?.aiStatus, "pending");

    await sleep(600);
    const markFail2 = await fetch(`http://127.0.0.1:5004/internal/applications/${app3Id}/mark-failed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": "dev-worker-token" },
      body: JSON.stringify({ error: "Simulated AI failure 2" }),
    });
    assert.equal(markFail2.status, 200);

    const manualScreen = await apiJson(`/api/applications/${app3Id}/status`, {
      method: "PATCH",
      token: recAToken,
      body: { status: "screening", action: "MANUAL_SCREENING", reason: "HR manual review" },
    });
    assert.equal(manualScreen.res.status, 200, manualScreen.text);
    assert.equal(manualScreen.json?.application?.manualScreeningOverride, true);

    // OCC 409 + full pipeline new -> screening -> interview -> offer -> hired -> terminal 409
    const stalePatch = await apiJson(`/api/applications/${app1Id}/status`, {
      method: "PATCH",
      token: recAToken,
      body: { status: "screening", __v: 999 },
    });
    assert.equal(stalePatch.res.status, 409, stalePatch.text);

    for (const nextStatus of ["screening", "interview", "offer", "hired"]) {
      const stepRes = await apiJson(`/api/applications/${app1Id}/status`, {
        method: "PATCH",
        token: recAToken,
        body: { status: nextStatus, reason: `Move to ${nextStatus}` },
      });
      assert.equal(stepRes.res.status, 200, `Transition to ${nextStatus} failed: ${stepRes.text}`);
    }

    const terminalPatch = await apiJson(`/api/applications/${app1Id}/status`, {
      method: "PATCH",
      token: recAToken,
      body: { status: "rejected" },
    });
    assert.equal(terminalPatch.res.status, 409, terminalPatch.text);
  });

  // ── T3.4: Qdrant HNSW Find Candidates, HR Questions & Cross-Company Anti-IDOR ─
  await t.test("T3.4 Qdrant HNSW find-candidates, HR interview questions & 403 RBAC, cross-company anti-IDOR 200 vs 403", async () => {
    const findRes = await apiJson(
      `/api/recommendations/resumes?job_id=${encodeURIComponent(jobId)}&score_threshold=0.05`,
      { token: recAToken }
    );
    assert.equal(findRes.res.status, 200, findRes.text);
    assert.equal(findRes.json?.source, "qdrant_hnsw", findRes.text);
    assert.ok(Array.isArray(findRes.json?.data) && findRes.json.data.length >= 1);
    assert.ok(Array.isArray(findRes.json.data[0].top_skills));

    const hrQ = await apiJson("/api/interviews/questions", {
      method: "POST",
      token: recAToken,
      body: {
        resume_id: cand1ResumeId,
        job_id: jobId,
        jobTitle: "Senior Node.js Engineer",
        skills: ["Node.js", "MongoDB"],
        language: "vi",
        targetAudience: "recruiter",
      },
    });
    assert.ok(hrQ.res.status === 200 || hrQ.res.status === 201, hrQ.text);
    assert.ok(Array.isArray(hrQ.json?.data?.question_groups));

    const candBlocked = await apiJson("/api/interviews/questions", {
      method: "POST",
      token: cand1Token,
      body: { resume_id: cand1ResumeId, job_id: jobId, targetAudience: "recruiter" },
    });
    assert.equal(candBlocked.res.status, 403, candBlocked.text);

    // Owning Recruiter A can download candidate CV and view candidate profile
    const dlA = await fetch(`${BASE_URL}/api/resumes/${cand1ResumeId}/download?mode=stream`, {
      headers: { Authorization: `Bearer ${recAToken}` },
    });
    assert.equal(dlA.status, 200);
    const dlBytes = Buffer.from(await dlA.arrayBuffer());
    assert.ok(dlBytes.toString("utf8", 0, 5).startsWith("%PDF-"));

    const profA = await apiJson(`/api/candidate-profile/${cand1Id}`, { token: recAToken });
    assert.equal(profA.res.status, 200, profA.text);

    // Other-company Recruiter B is blocked (403 Anti-IDOR)
    const dlB = await fetch(`${BASE_URL}/api/resumes/${cand1ResumeId}/download?mode=stream`, {
      headers: { Authorization: `Bearer ${recBToken}` },
    });
    assert.equal(dlB.status, 403);

    const profB = await apiJson(`/api/candidate-profile/${cand1Id}`, { token: recBToken });
    assert.equal(profB.res.status, 403, profB.text);
  });

  // ── T3.5: Recruiter SSE Notifications, Password Change & 0 DLQ ───────────────
  await t.test("T3.5 Recruiter SSE notification on scored application, mark read-all, change password, 0 DLQ", async () => {
    const sseController = new AbortController();
    const sseRes = await fetch(
      `${BASE_URL}/api/notifications/stream?token=${encodeURIComponent(recAToken)}`,
      { signal: sseController.signal }
    );
    let sseBuffer = "";
    try {
      assert.equal(sseRes.status, 200);
      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();

      const firstChunk = await Promise.race([
        reader.read(),
        sleep(3000).then(() => ({ value: null, done: true })),
      ]);
      if (firstChunk.value) {
        sseBuffer += decoder.decode(firstChunk.value, { stream: true });
      }
      assert.ok(sseBuffer.includes(": connected"));

      // Submit a fresh application from Candidate 2 using a fresh PDF so worker-scoring scores it & notifies Recruiter A
      const form3 = new FormData();
      form3.append(
        "file",
        new Blob([buildValidPdfBuffer("T3 SSE Candidate", ["Node.js Redis"])], { type: "application/pdf" }),
        "t3-sse.pdf"
      );
      const up3 = await apiJson("/api/resumes/upload", { method: "POST", token: cand2Token, body: form3 });
      assert.equal(up3.res.status, 201, up3.text);

      const subSse = await apiJson("/api/applications", {
        method: "POST",
        token: cand2Token,
        body: { job_id: jobId, resume_id: up3.json.resume_id },
      });
      assert.equal(subSse.res.status, 201, subSse.text);

      const deadline = Date.now() + 10000;
      while (!sseBuffer.includes("event: notification") && Date.now() < deadline) {
        const next = await Promise.race([
          reader.read(),
          sleep(1000).then(() => ({ value: null, done: false })),
        ]);
        if (next.value) {
          sseBuffer += decoder.decode(next.value, { stream: true });
        }
      }
    } finally {
      sseController.abort();
    }
    assert.ok(sseBuffer.includes("event: notification"), `Expected Recruiter SSE notification, got: ${sseBuffer}`);

    const readAll = await apiJson("/api/notifications/read-all", { method: "PATCH", token: recAToken, body: {} });
    assert.equal(readAll.res.status, 200, readAll.text);

    const unread = await apiJson("/api/notifications/unread-count", { token: recAToken });
    assert.equal(unread.res.status, 200);
    assert.equal(unread.json?.data?.count, 0);

    // Recruiter B password change
    const chPass = await apiJson("/api/auth/change-password", {
      method: "POST",
      token: recBToken,
      body: { current_password: password, new_password: newPassword },
    });
    assert.equal(chPass.res.status, 200, chPass.text);

    const meOld = await apiJson("/api/auth/me", { token: recBToken });
    assert.equal(meOld.res.status, 401);

    clearAuthRateLimits();
    const relogin = await apiJson("/api/auth/login", {
      method: "POST",
      body: { email: recBEmail, password: newPassword },
    });
    assert.equal(relogin.res.status, 200, relogin.text);

    const scoringDlq = Number(runRedisCli("LLEN", "application_scoring_queue_dlq") || "0");
    const notifDlq = Number(runRedisCli("LLEN", "notification_queue_dlq") || "0");
    assert.equal(scoringDlq, 0, "application_scoring_queue_dlq should be empty");
    assert.equal(notifDlq, 0, "notification_queue_dlq should be empty");
  });
});


test("Wave T4 Live Contract: Tech Staff / Admin Portal (T4.1 - T4.3) on 19-container Docker stack", async (t) => {
  clearAuthRateLimits();
  const ts = Date.now();
  const staffEmail = `live-t4-staff-${ts}@example.com`;
  const candEmail = `live-t4-cand-${ts}@example.com`;
  const recEmail = `live-t4-rec-${ts}@example.com`;
  const password = "Password123!";
  const taxCode = `440${String(ts).slice(-7)}`;

  // Seed tech_staff user (signup + promote in cvm_auth + fresh login)
  const staffSignup = await apiJson("/api/auth/signup", {
    method: "POST",
    body: { email: staffEmail, password, full_name: "T4 Tech Staff", role: "candidate" },
  });
  assert.equal(staffSignup.res.status, 201, staffSignup.text);
  runMongoEval(
    "cvm_auth",
    `db.users.updateOne({ email: ${JSON.stringify(staffEmail)} }, { $set: { role: "tech_staff" } })`
  );
  clearAuthRateLimits();
  const staffLogin = await apiJson("/api/auth/login", {
    method: "POST",
    body: { email: staffEmail, password },
  });
  assert.equal(staffLogin.res.status, 200, staffLogin.text);
  const staffToken = staffLogin.json?.access_token;
  assert.ok(staffToken);

  // Seed target candidate + master CV
  const candSignup = await apiJson("/api/auth/signup", {
    method: "POST",
    body: { email: candEmail, password, full_name: "T4 Target Candidate", role: "candidate" },
  });
  assert.equal(candSignup.res.status, 201, candSignup.text);
  let candToken = candSignup.json?.access_token;
  const candId = String(candSignup.json?.user?.id || "");

  const pdfForm = new FormData();
  pdfForm.append(
    "file",
    new Blob([buildValidPdfBuffer("T4 Target Candidate", ["Node.js TypeScript MongoDB Redis Docker"])], {
      type: "application/pdf",
    }),
    "t4-cand.pdf"
  );
  pdfForm.append("title", "T4 Candidate CV");
  const upRes = await fetch(`${BASE_URL}/api/resumes/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${candToken}` },
    body: pdfForm,
  });
  const upJson = await upRes.json();
  assert.equal(upRes.status, 201, JSON.stringify(upJson));
  const resumeId = String(upJson.resume_id);

  // Seed recruiter + pending company MST + active job
  const recSignup = await apiJson("/api/auth/signup", {
    method: "POST",
    body: { email: recEmail, password, full_name: "T4 Recruiter", role: "recruiter" },
  });
  assert.equal(recSignup.res.status, 201, recSignup.text);
  const recToken = recSignup.json?.access_token;

  const compRes = await apiJson("/api/company/me", {
    method: "PUT",
    token: recToken,
    body: {
      name: `T4 Company ${ts}`,
      taxCode,
      industry: "Software",
      company_size: "50-100",
    },
  });
  assert.equal(compRes.res.status, 200, compRes.text);
  const companyId = String(compRes.json?.company?._id || compRes.json?.company?.id || "");
  assert.ok(companyId);

  const jobRes = await apiJson("/api/jobs", {
    method: "POST",
    token: recToken,
    body: {
      title: `T4 Backend Engineer ${ts}`,
      description: "Node.js TypeScript MongoDB Redis Docker",
      requirements: "Node.js TypeScript MongoDB",
      skills: ["Node.js", "TypeScript", "MongoDB"],
      category: "IT",
      location: "Ho Chi Minh City",
      status: "active",
    },
  });
  assert.equal(jobRes.res.status, 201, jobRes.text);
  const jobId = String(jobRes.json?._id || "");
  assert.ok(jobId);

  await t.test("T4.1 Cluster health, Redis queues & DLQ retry, Audit logs", async () => {
    const forbidden = await apiJson("/api/config-analytics/health/cluster", { token: candToken });
    assert.equal(forbidden.res.status, 403);

    const health = await apiJson("/api/config-analytics/health/cluster", { token: staffToken });
    assert.equal(health.res.status, 200, health.text);
    assert.equal(health.json?.status, "healthy", health.text);
    assert.ok((health.json?.services || []).length >= 8);
    assert.ok((health.json?.workers || []).length >= 4);
    assert.ok((health.json?.datastores || []).length >= 4);
    assert.ok(health.json?.total_latency_ms < 5000);

    runRedisCli("LPUSH", "notification_queue_dlq", JSON.stringify({ type: "t4_dlq_probe", retry_count: 4 }));
    const queues = await apiJson("/api/config-analytics/queues", { token: staffToken });
    assert.equal(queues.res.status, 200, queues.text);
    assert.ok(Number(queues.json?.depths?.notification_queue_dlq || 0) >= 1);

    const retry = await apiJson("/api/config-analytics/queues/retry", {
      method: "POST",
      token: staffToken,
      body: { dlqName: "notification_queue_dlq", count: 5 },
    });
    assert.equal(retry.res.status, 200, retry.text);
    assert.ok(Number(retry.json?.retriedCount || 0) >= 1);

    const logs = await apiJson("/api/config-analytics/audit-logs?action=RETRY_DLQ&limit=10", { token: staffToken });
    assert.equal(logs.res.status, 200, logs.text);
    assert.ok((logs.json?.logs || []).some((l) => l.action === "RETRY_DLQ"));
  });

  await t.test("T4.2 Dynamic System Config: scoringWeights hot-reload, maintenance 503, flat PUT", async () => {
    try {
      const badW = await apiJson("/api/config/scoring-weights", {
        method: "PUT",
        token: staffToken,
        body: { semanticWeight: 0.7, keywordWeight: 0.7 },
      });
      assert.equal(badW.res.status, 400);

      const okW = await apiJson("/api/config/scoring-weights", {
        method: "PUT",
        token: staffToken,
        body: { semanticWeight: 0.7, keywordWeight: 0.3 },
      });
      assert.equal(okW.res.status, 200, okW.text);
      await sleep(350);

      const metrics70 = await fetch("http://localhost:9101/metrics").then((r) => r.json());
      assert.equal(metrics70?.weights?.semanticWeight, 0.7);
      assert.equal(metrics70?.weights?.keywordWeight, 0.3);

      const maintOn = await apiJson("/api/config/maintenance", {
        method: "PUT",
        token: staffToken,
        body: {
          global: false,
          modules: { auth: false, resumes: false, jobs: true, applications: false, recommendations: false, enrichment: false, notifications: false },
        },
      });
      assert.equal(maintOn.res.status, 200, maintOn.text);
      await sleep(350);

      const blockedJobs = await apiJson("/api/jobs", { token: candToken });
      assert.equal(blockedJobs.res.status, 503, blockedJobs.text);
      assert.equal(blockedJobs.json?.error_code, "service_in_maintenance");
      assert.equal(blockedJobs.json?.module, "jobs");

      const bypassJobs = await apiJson("/api/jobs", { token: staffToken });
      assert.equal(bypassJobs.res.status, 200, bypassJobs.text);

      const priv = await apiJson("/api/config/privacy", {
        method: "PUT",
        token: staffToken,
        body: { privacy_mode: "hybrid" },
      });
      assert.equal(priv.res.status, 200, priv.text);
      assert.equal(priv.json?.privacy_mode, "hybrid");

      const logs = await apiJson("/api/config-analytics/audit-logs?action=UPDATE_CONFIG&limit=10", { token: staffToken });
      assert.equal(logs.res.status, 200, logs.text);
      assert.ok((logs.json?.logs || []).some((l) => l.action === "UPDATE_CONFIG"));
    } finally {
      await apiJson("/api/config/scoring-weights", {
        method: "PUT",
        token: staffToken,
        body: { semanticWeight: 0.65, keywordWeight: 0.35 },
      });
      await apiJson("/api/config/maintenance", {
        method: "PUT",
        token: staffToken,
        body: {
          global: false,
          modules: { auth: false, resumes: false, jobs: false, applications: false, recommendations: false, enrichment: false, notifications: false },
        },
      });
      await sleep(350);
    }

    const metricsRestored = await fetch("http://localhost:9101/metrics").then((r) => r.json());
    assert.equal(metricsRestored?.weights?.semanticWeight, 0.65);
    const jobsRestored = await apiJson("/api/jobs", { token: candToken });
    assert.equal(jobsRestored.res.status, 200, jobsRestored.text);
  });

  await t.test("T4.3 Users RBAC/Suspend, Company MST verify, Vectors scorePair & Zero-Downtime Alias Swap", async () => {
    const usersRes = await apiJson("/api/users?limit=50", { token: staffToken });
    assert.equal(usersRes.res.status, 200, usersRes.text);
    assert.ok((usersRes.json?.users || usersRes.json?.data || []).some((u) => String(u._id || u.id) === candId));

    const roleRec = await apiJson(`/api/users/${candId}/role`, {
      method: "PATCH",
      token: staffToken,
      body: { role: "recruiter", reason: "T4 RBAC test" },
    });
    assert.equal(roleRec.res.status, 200, roleRec.text);

    const roleCand = await apiJson(`/api/users/${candId}/role`, {
      method: "PATCH",
      token: staffToken,
      body: { role: "candidate", reason: "T4 RBAC restore" },
    });
    assert.equal(roleCand.res.status, 200, roleCand.text);

    // Re-login to get fresh candToken after role change blacklisted old token
    clearAuthRateLimits();
    const candRelogin = await apiJson("/api/auth/login", {
      method: "POST",
      body: { email: candEmail, password },
    });
    assert.equal(candRelogin.res.status, 200, candRelogin.text);
    candToken = candRelogin.json?.access_token;

    const suspendNoReason = await apiJson(`/api/users/${candId}/suspend`, {
      method: "POST",
      token: staffToken,
      body: { reason: "" },
    });
    assert.equal(suspendNoReason.res.status, 400);

    const suspendOk = await apiJson(`/api/users/${candId}/suspend`, {
      method: "POST",
      token: staffToken,
      body: { reason: "T4 compliance check" },
    });
    assert.equal(suspendOk.res.status, 200, suspendOk.text);
    assert.equal(suspendOk.json?.user?.disabled, true);

    const revokedMe = await apiJson("/api/auth/me", { token: candToken });
    assert.equal(revokedMe.res.status, 401);

    const unsuspendOk = await apiJson(`/api/users/${candId}/unsuspend`, {
      method: "POST",
      token: staffToken,
      body: {},
    });
    assert.equal(unsuspendOk.res.status, 200, unsuspendOk.text);
    assert.equal(unsuspendOk.json?.user?.disabled, false);

    // Company MST verification
    const verifyRes = await apiJson(`/api/company/${companyId}/verify`, {
      method: "PATCH",
      token: staffToken,
      body: { status: "verified", note: "MST verified in T4" },
    });
    assert.equal(verifyRes.res.status, 200, verifyRes.text);
    assert.equal(verifyRes.json?.company?.verificationStatus, "verified");

    const recCompany = await apiJson("/api/company/me", { token: recToken });
    assert.equal(recCompany.res.status, 200, recCompany.text);
    assert.equal(recCompany.json?.company?.verificationStatus, "verified");

    // Score pair & Zero-Downtime Qdrant Alias Swap (twice to test collection->alias AND alias->alias)
    const pair = await apiJson("/api/vectors/score/pair", {
      method: "POST",
      token: staffToken,
      body: { job_id: jobId, resume_id: resumeId },
    });
    assert.equal(pair.res.status, 200, pair.text);
    assert.equal(typeof pair.json?.hybrid_score, "number");

    const reindex1 = await apiJson("/api/config-analytics/vector/reindex", {
      method: "POST",
      token: staffToken,
      body: { target: "jobs", batchSize: 100 },
    });
    assert.equal(reindex1.res.status, 200, reindex1.text);
    assert.equal(reindex1.json?.alias, "jobs_vectors");
    assert.ok(String(reindex1.json?.newCollection || "").startsWith("jobs_vectors_v"));
    assert.ok(Number(reindex1.json?.reindexedCount || 0) >= 1);
    assert.equal(typeof reindex1.json?.alias_swap_ms, "number");

    const reindex2 = await apiJson("/api/config-analytics/vector/reindex", {
      method: "POST",
      token: staffToken,
      body: { target: "jobs", batchSize: 100 },
    });
    assert.equal(reindex2.res.status, 200, reindex2.text);
    assert.notEqual(reindex2.json?.newCollection, reindex1.json?.newCollection);

    const recs = await apiJson(`/api/recommendations/resumes?job_id=${jobId}&limit=5`, { token: recToken });
    assert.equal(recs.res.status, 200, recs.text);
    assert.equal(recs.json?.source, "qdrant_hnsw");

    const logs = await apiJson("/api/config-analytics/audit-logs?action=REINDEX_VECTORS&limit=10", { token: staffToken });
    assert.equal(logs.res.status, 200, logs.text);
    assert.ok((logs.json?.logs || []).some((l) => l.action === "REINDEX_VECTORS"));
  });
});


test("Wave T5 Live Contract: Platform Owner Portal (T5.1 - T5.2) on 19-container Docker stack", async (t) => {
  clearAuthRateLimits();
  const ts = Date.now();
  const ownerEmail = `live-t5-owner-${ts}@example.com`;
  const candEmail = `live-t5-cand-${ts}@example.com`;
  const recEmail = `live-t5-rec-${ts}@example.com`;
  const password = "Password123!";

  const ownerSignup = await apiJson("/api/auth/signup", {
    method: "POST",
    body: { email: ownerEmail, password, full_name: "T5 Platform Owner", role: "candidate" },
  });
  assert.equal(ownerSignup.res.status, 201, ownerSignup.text);
  runMongoEval(
    "cvm_auth",
    `db.users.updateOne({ email: ${JSON.stringify(ownerEmail)} }, { $set: { role: "platform_owner" } })`
  );
  clearAuthRateLimits();
  const ownerLogin = await apiJson("/api/auth/login", {
    method: "POST",
    body: { email: ownerEmail, password },
  });
  assert.equal(ownerLogin.res.status, 200, ownerLogin.text);
  const ownerToken = ownerLogin.json?.access_token;
  assert.ok(ownerToken);

  const candSignup = await apiJson("/api/auth/signup", {
    method: "POST",
    body: { email: candEmail, password, full_name: "T5 Candidate", role: "candidate" },
  });
  assert.equal(candSignup.res.status, 201, candSignup.text);
  const candToken = candSignup.json?.access_token;

  const recSignup = await apiJson("/api/auth/signup", {
    method: "POST",
    body: { email: recEmail, password, full_name: "T5 Recruiter", role: "recruiter" },
  });
  assert.equal(recSignup.res.status, 201, recSignup.text);
  const recToken = recSignup.json?.access_token;

  await t.test("T5.1 Growth Dashboard (/analytics/overview), cross-DB MongoDB accuracy & RBAC", async () => {
    for (const badToken of [candToken, recToken]) {
      const ov403 = await apiJson("/api/config-analytics/analytics/overview?range=30d", { token: badToken });
      assert.equal(ov403.res.status, 403);
      const fn403 = await apiJson("/api/config-analytics/analytics/funnel?range=30d", { token: badToken });
      assert.equal(fn403.res.status, 403);
      const ex403 = await apiJson("/api/config-analytics/analytics/export?range=30d", { token: badToken });
      assert.equal(ex403.res.status, 403);
    }

    const opsHealth403 = await apiJson("/api/config-analytics/health/cluster", { token: ownerToken });
    assert.equal(opsHealth403.res.status, 403);
    const opsQueues403 = await apiJson("/api/config-analytics/queues", { token: ownerToken });
    assert.equal(opsQueues403.res.status, 403);

    for (const range of ["7d", "30d", "90d"]) {
      const ov = await apiJson(`/api/config-analytics/analytics/overview?range=${range}`, { token: ownerToken });
      assert.equal(ov.res.status, 200, ov.text);
      assert.equal(ov.json?.range, range);
      assert.equal(typeof ov.json?.kpis?.totalUsers, "number");
      assert.equal(typeof ov.json?.kpis?.totalResumes, "number");
      assert.equal(typeof ov.json?.kpis?.totalJobs, "number");
      assert.equal(typeof ov.json?.kpis?.activeJobs, "number");
      assert.equal(typeof ov.json?.kpis?.totalApplications, "number");
      assert.ok(Number(ov.json?.kpis?.usersByRole?.platform_owner || 0) >= 1);
      assert.ok(Object.keys(ov.json?.categoryBreakdown || {}).length >= 1);
      assert.ok(Array.isArray(ov.json?.series) && ov.json.series.length >= 1);
    }

    const ov30 = await apiJson("/api/config-analytics/analytics/overview?range=30d", { token: ownerToken });
    assert.equal(ov30.res.status, 200);
    const sinceIso = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const mongoUsers = Number(
      runMongoEval("cvm_auth", `db.users.countDocuments({ createdAt: { $gte: new Date(${JSON.stringify(sinceIso)}) } })`)
    );
    const mongoResumes = Number(
      runMongoEval("cvm_resume", `db.resumes.countDocuments({ createdAt: { $gte: new Date(${JSON.stringify(sinceIso)}) } })`)
    );
    const mongoJobs = Number(
      runMongoEval("cvm_job", `db.jobs.countDocuments({ createdAt: { $gte: new Date(${JSON.stringify(sinceIso)}) } })`)
    );
    const mongoApps = Number(
      runMongoEval("cvm_application", `db.applications.countDocuments({ createdAt: { $gte: new Date(${JSON.stringify(sinceIso)}) } })`)
    );
    assert.equal(ov30.json?.kpis?.totalUsers, mongoUsers);
    assert.equal(ov30.json?.kpis?.totalResumes, mongoResumes);
    assert.equal(ov30.json?.kpis?.totalJobs, mongoJobs);
    assert.equal(ov30.json?.kpis?.totalApplications, mongoApps);
  });

  await t.test("T5.2 Recruitment Funnel (/analytics/funnel) & CSV Export (/analytics/export)", async () => {
    for (const range of ["7d", "30d", "90d"]) {
      const fn = await apiJson(`/api/config-analytics/analytics/funnel?range=${range}`, { token: ownerToken });
      assert.equal(fn.res.status, 200, fn.text);
      for (const stage of ["new", "screening", "interview", "offer", "hired", "rejected", "withdrawn"]) {
        assert.equal(typeof fn.json?.stageCounts?.[stage], "number");
      }
      for (const rateKey of ["screeningRate", "interviewRate", "offerRate", "hireRate"]) {
        assert.equal(typeof fn.json?.conversionRates?.[rateKey], "number");
      }
      for (const grp of ["highScoreGroup", "lowScoreGroup"]) {
        assert.equal(typeof fn.json?.aiCorrelation?.[grp]?.count, "number");
        assert.equal(typeof fn.json?.aiCorrelation?.[grp]?.interviewed, "number");
        assert.equal(typeof fn.json?.aiCorrelation?.[grp]?.hired, "number");
        assert.equal(typeof fn.json?.aiCorrelation?.[grp]?.interviewRate, "number");
        assert.equal(typeof fn.json?.aiCorrelation?.[grp]?.hireRate, "number");
      }
    }

    const csvRes = await fetch(`${BASE_URL}/api/config-analytics/analytics/export?range=30d`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(csvRes.status, 200);
    assert.ok(String(csvRes.headers.get("content-type") || "").includes("text/csv"));
    assert.ok(String(csvRes.headers.get("content-disposition") || "").includes("platform-analytics.csv"));
    const csvText = await csvRes.text();
    assert.ok(csvText.startsWith("section,metric,value"));
    assert.ok(csvText.includes("overview,total_users,"));
    assert.ok(csvText.includes("funnel,hired,"));
    assert.ok(csvText.includes("ai_correlation,high_score_hire_rate_pct,"));
    assert.ok(csvText.includes("ai_correlation,low_score_hire_rate_pct,"));
  });
});
