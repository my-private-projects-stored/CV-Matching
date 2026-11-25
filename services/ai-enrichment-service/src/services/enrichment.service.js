import { REDIS_KEYS, ROLES, createHttpError, hasAnyRole } from "@cvm/shared";

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildTemplateInterviewQuestions({
  targetAudience = "recruiter",
  jobTitle = "Software Engineer",
  skills = [],
  missingKeywords = [],
  language = "vi",
} = {}) {
  const focusSkills = skills.length ? skills.slice(0, 3).join(", ") : "core domain skills";
  const gapSkill = missingKeywords.length ? missingKeywords[0] : "system scalability";
  const isVi = language === "vi";

  if (targetAudience === "recruiter") {
    return [
      {
        category: "technical",
        question: isVi
          ? `Hãy đề nghị ứng viên trình bày kiến trúc một dự án thực tế sử dụng ${focusSkills} cho vị trí ${jobTitle}.`
          : `Ask the candidate to walk through a real production architecture using ${focusSkills} for ${jobTitle}.`,
        expectedSignal: isVi
          ? "Nêu rõ trade-off, bottleneck, và cách xử lý lỗi."
          : "Clear trade-offs, bottlenecks, and failure handling.",
        difficulty: "medium",
      },
      {
        category: "gap_verification",
        question: isVi
          ? `Hồ sơ hiện chưa thể hiện rõ kinh nghiệm về ${gapSkill}; hãy hỏi tình huống ứng viên từng tiếp cận hoặc hướng giải quyết tương đương.`
          : `The CV shows limited evidence of ${gapSkill}; probe how the candidate has handled comparable requirements.`,
        expectedSignal: isVi
          ? "Khả năng học nhanh và chuyển đổi kiến thức nền tảng."
          : "Transferable fundamentals and honest self-assessment.",
        difficulty: "hard",
      },
      {
        category: "behavioral",
        question: isVi
          ? "Mô tả một sự cố production hoặc xung đột kỹ thuật nghiêm trọng và cách ứng viên phối hợp giải quyết."
          : "Describe a critical production incident or technical disagreement and how it was resolved.",
        expectedSignal: isVi
          ? "Trách nhiệm cá nhân, giao tiếp rõ ràng, bài học rút ra."
          : "Ownership, communication clarity, and postmortem mindset.",
        difficulty: "medium",
      },
    ];
  }

  return [
    {
      category: "practice_technical",
      question: isVi
        ? `Tự luyện trả lời: Bạn đã áp dụng ${focusSkills} như thế nào để giải quyết bài toán hiệu năng hoặc độ tin cậy?`
        : `Practice prompt: How have you applied ${focusSkills} to solve performance or reliability challenges?`,
      expectedSignal: isVi
        ? "Trả lời theo cấu trúc STAR kèm số liệu cụ thể."
        : "Answer using STAR structure with measurable metrics.",
      sampleAnswer: isVi
        ? `Situation: Hệ thống xử lý yêu cầu bằng ${focusSkills} gặp độ trễ cao vào giờ cao điểm.\nTask: Giảm p99 latency xuống dưới 150ms mà không tăng chi phí hạ tầng.\nAction: Tối ưu truy vấn, bổ sung cache và cơ chế xử lý bất đồng bộ.\nResult: Độ trễ giảm 45% và hệ thống ổn định ở mức tải gấp đôi.`
        : `Situation: Our production service using ${focusSkills} experienced high tail latency under peak load.\nTask: Reduce p99 latency below 150ms without scaling up infrastructure.\nAction: Profiled bottlenecks, added caching, and decoupled heavy work asynchronously.\nResult: Cut p99 latency by 45% while handling 2x traffic.`,
      difficulty: "medium",
    },
    {
      category: "practice_gap",
      question: isVi
        ? `Chuẩn bị câu trả lời bổ sung nếu nhà tuyển dụng hỏi về ${gapSkill}.`
        : `Prepare a concise explanation covering your familiarity with ${gapSkill}.`,
      expectedSignal: isVi
        ? "Liên hệ kinh nghiệm tương đồng và kế hoạch tự học."
        : "Connect adjacent experience and learning plan.",
      sampleAnswer: isVi
        ? `Dù chưa dùng trực tiếp ${gapSkill} ở quy mô lớn, tôi đã triển khai các bài toán tương đồng với ${focusSkills} và đã xây dựng prototype thử nghiệm ${gapSkill} để nắm rõ trade-off trước khi áp dụng.`
        : `While I have not used ${gapSkill} at large scale yet, I have solved comparable problems using ${focusSkills} and built a working prototype with ${gapSkill} to understand its operational trade-offs.`,
      difficulty: "easy",
    },
  ];
}

function buildTemplateCvOptimization({
  resumeText = "",
  jobDescription = "",
  missingKeywords = [],
} = {}) {
  const gaps = Array.isArray(missingKeywords) && missingKeywords.length
    ? missingKeywords.slice(0, 6)
    : ["quantifiable metrics", "system reliability"];

  return {
    summary:
      "Deterministic ATS optimization suggestions generated from resume and JD gap analysis.",
    missing_keywords: gaps,
    bullet_suggestions: gaps.map(
      (kw) => `Add a concrete achievement bullet demonstrating '${kw}' with measurable impact.`
    ),
    ats_readiness_notes: resumeText && jobDescription
      ? "Align section headings and exact technical keywords with the target JD."
      : "Provide both resume text and job description for deeper tailoring.",
  };
}

function buildTemplateCoverLetter({
  candidateName = "Candidate",
  jobTitle = "Target Position",
  companyName = "the company",
  skills = [],
} = {}) {
  const skillList = skills.length ? skills.slice(0, 5).join(", ") : "software engineering";
  return {
    subject: `Application for ${jobTitle} - ${candidateName}`,
    content: `Dear Hiring Team at ${companyName},\n\nI am writing to express my interest in the ${jobTitle} role. With hands-on experience in ${skillList}, I am confident I can contribute quickly to your engineering goals.\n\nSincerely,\n${candidateName}`,
  };
}

/**
 * AI Enrichment & Interview Assistant service.
 * Enforces 1-hour cv_opt cache, 10 LLM calls/day/candidate quota,
 * strict RBAC separation of recruiter vs candidate interview questions,
 * and deterministic template_fallback logging to ai_generation_events (TTL 30d).
 */
export function createEnrichmentService({
  AiGenerationEventModel,
  InterviewQuestionModel,
  redisClient = null,
  redisBus = null,
  llmProvider = null,
  dailyCandidateQuota = 10,
} = {}) {
  async function consumeCandidateQuota(userId) {
    if (!redisClient || typeof redisClient.incr !== "function" || !userId) {
      return { count: 1, remaining: dailyCandidateQuota - 1 };
    }
    const key = `llm_quota:${String(userId)}:${todayDateKey()}`;
    const count = Number(await redisClient.incr(key));
    if (count === 1 && typeof redisClient.expire === "function") {
      await redisClient.expire(key, 86400);
    }
    if (count > dailyCandidateQuota) {
      throw createHttpError(
        429,
        `Daily AI generation limit (${dailyCandidateQuota}/day) exceeded`,
        "llm_daily_quota_exceeded"
      );
    }
    return { count, remaining: Math.max(0, dailyCandidateQuota - count) };
  }

  async function runWithFallback({ feature, userId = null, requestId = "", llmCall, fallbackBuilder }) {
    if (typeof llmCall === "function" && llmProvider) {
      try {
        const llmData = await llmCall(llmProvider);
        await AiGenerationEventModel.create({
          feature,
          generation_mode: "llm",
          provider: llmProvider.providerName || "gemini",
          model: llmProvider.modelName || "gemini-2.0-flash",
          request_id: requestId || null,
          userId: userId ? String(userId) : null,
        });
        return { data: llmData, generation_mode: "llm" };
      } catch (err) {
        const fallbackData = fallbackBuilder();
        await AiGenerationEventModel.create({
          feature,
          generation_mode: "template_fallback",
          provider: llmProvider.providerName || "gemini",
          model: llmProvider.modelName || null,
          reason: String(err?.message || "llm_failed"),
          request_id: requestId || null,
          userId: userId ? String(userId) : null,
        });
        return { data: fallbackData, generation_mode: "template_fallback" };
      }
    }

    const fallbackData = fallbackBuilder();
    await AiGenerationEventModel.create({
      feature,
      generation_mode: "template_fallback",
      provider: null,
      model: null,
      reason: "llm_provider_not_configured",
      request_id: requestId || null,
      userId: userId ? String(userId) : null,
    });
    return { data: fallbackData, generation_mode: "template_fallback" };
  }

  async function generateInterviewQuestions({ viewer, payload = {}, requestId = "" }) {
    const isRecruiterOrOps = hasAnyRole(viewer.role, [ROLES.RECRUITER, ROLES.TECH_STAFF]);
    const requestedAudience = payload.targetAudience
      ? String(payload.targetAudience).trim().toLowerCase()
      : isRecruiterOrOps
      ? "recruiter"
      : "candidate";

    if (requestedAudience !== "candidate" && requestedAudience !== "recruiter") {
      throw createHttpError(400, "targetAudience must be 'candidate' or 'recruiter'", "invalid_target_audience");
    }

    // Candidates are strictly forbidden from generating or viewing recruiter evaluation questions
    if (requestedAudience === "recruiter" && !isRecruiterOrOps) {
      throw createHttpError(
        403,
        "Candidates cannot access recruiter interview evaluation questions",
        "forbidden_recruiter_questions"
      );
    }

    if (!isRecruiterOrOps) {
      await consumeCandidateQuota(viewer.id);
    }

    const language = payload.language === "en" ? "en" : "vi";
    const { data, generation_mode } = await runWithFallback({
      feature: "interview_questions",
      userId: viewer.id,
      requestId,
      llmCall: llmProvider?.generateInterviewQuestions
        ? (provider) =>
            provider.generateInterviewQuestions({
              ...payload,
              targetAudience: requestedAudience,
              language,
            })
        : null,
      fallbackBuilder: () =>
        buildTemplateInterviewQuestions({
          targetAudience: requestedAudience,
          jobTitle: payload.jobTitle,
          skills: payload.skills,
          missingKeywords: payload.missingKeywords,
          language,
        }),
    });

    const questions = Array.isArray(data) ? data : data?.questions || [];
    const saved = await InterviewQuestionModel.create({
      applicationId: String(payload.applicationId || payload.application_id || ""),
      jobId: String(payload.jobId || payload.job_id || ""),
      resumeId: String(payload.resumeId || payload.resume_id || ""),
      candidateId: String(payload.candidateId || (!isRecruiterOrOps ? viewer.id : "")),
      recruiterId: isRecruiterOrOps ? String(viewer.id) : "",
      targetAudience: requestedAudience,
      language,
      questions,
      generationMode: generation_mode,
      autoGenerated: false,
    });

    return { questionSet: saved, generation_mode };
  }

  async function getInterviewQuestionsByApplication({ applicationId, viewer, audience = null }) {
    const isRecruiterOrOps = hasAnyRole(viewer.role, [ROLES.RECRUITER, ROLES.TECH_STAFF]);
    const requestedAudience = audience ? String(audience).trim().toLowerCase() : null;

    if (!isRecruiterOrOps && requestedAudience === "recruiter") {
      throw createHttpError(
        403,
        "Candidates cannot read recruiter interview evaluation questions",
        "forbidden_recruiter_questions"
      );
    }

    const filter = { applicationId: String(applicationId) };
    if (!isRecruiterOrOps) {
      filter.targetAudience = "candidate";
    } else if (requestedAudience) {
      filter.targetAudience = requestedAudience;
    }

    const items = await InterviewQuestionModel.find(filter, null, { sort: { createdAt: -1 } });
    return { questionSets: items };
  }

  async function handleApplicationInterviewEvent(eventPayload = {}) {
    const toStatus = String(eventPayload?.to_status || eventPayload?.toStatus || "").toLowerCase();
    const applicationId = String(eventPayload?.application_id || eventPayload?.applicationId || "").trim();
    if (toStatus !== "interview" || !applicationId) {
      return null;
    }

    const existing = await InterviewQuestionModel.findOne({
      applicationId,
      targetAudience: "recruiter",
      autoGenerated: true,
    });
    if (existing) {
      return existing;
    }

    const { data, generation_mode } = await runWithFallback({
      feature: "interview_questions_auto",
      userId: eventPayload?.changed_by || null,
      requestId: "pubsub-auto",
      llmCall: llmProvider?.generateInterviewQuestions
        ? (provider) =>
            provider.generateInterviewQuestions({
              applicationId,
              jobId: eventPayload.job_id,
              resumeId: eventPayload.resume_id,
              targetAudience: "recruiter",
              language: "vi",
            })
        : null,
      fallbackBuilder: () =>
        buildTemplateInterviewQuestions({
          targetAudience: "recruiter",
          jobTitle: eventPayload.job_title || "Target Role",
          skills: eventPayload.skills || [],
          missingKeywords: eventPayload.missing_keywords || [],
          language: "vi",
        }),
    });

    return InterviewQuestionModel.create({
      applicationId,
      jobId: String(eventPayload.job_id || ""),
      resumeId: String(eventPayload.resume_id || ""),
      candidateId: String(eventPayload.candidate_id || ""),
      targetAudience: "recruiter",
      language: "vi",
      questions: Array.isArray(data) ? data : data?.questions || [],
      generationMode: generation_mode,
      autoGenerated: true,
    });
  }

  async function optimizeCvForJob({ viewer, payload = {}, requestId = "" }) {
    const resumeId = String(payload.resumeId || payload.resume_id || "").trim();
    const jobId = String(payload.jobId || payload.job_id || "").trim();

    if (resumeId && jobId && redisBus && typeof redisBus.cacheGetJson === "function") {
      const cacheKey = REDIS_KEYS.cvOptimizeCache(resumeId, jobId);
      const cached = await redisBus.cacheGetJson(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const isCandidate = hasAnyRole(viewer.role, [ROLES.CANDIDATE]) && !hasAnyRole(viewer.role, [ROLES.TECH_STAFF]);
    if (isCandidate) {
      await consumeCandidateQuota(viewer.id);
    }

    const { data, generation_mode } = await runWithFallback({
      feature: "cv_optimize",
      userId: viewer.id,
      requestId,
      llmCall: llmProvider?.optimizeCv
        ? (provider) => provider.optimizeCv(payload)
        : null,
      fallbackBuilder: () => buildTemplateCvOptimization(payload),
    });

    const result = {
      optimization: data,
      generation_mode,
      cached: false,
    };

    if (resumeId && jobId && redisBus && typeof redisBus.cacheSetJson === "function") {
      await redisBus.cacheSetJson(REDIS_KEYS.cvOptimizeCache(resumeId, jobId), result, 3600);
    }

    return result;
  }

  async function generateCoverLetter({ viewer, payload = {}, requestId = "" }) {
    const isCandidate = hasAnyRole(viewer.role, [ROLES.CANDIDATE]) && !hasAnyRole(viewer.role, [ROLES.TECH_STAFF]);
    if (isCandidate) {
      await consumeCandidateQuota(viewer.id);
    }

    const { data, generation_mode } = await runWithFallback({
      feature: "cover_letter",
      userId: viewer.id,
      requestId,
      llmCall: llmProvider?.generateCoverLetter
        ? (provider) => provider.generateCoverLetter(payload)
        : null,
      fallbackBuilder: () => buildTemplateCoverLetter(payload),
    });

    return { cover_letter: data, generation_mode };
  }

  async function generateOutreach({ viewer, payload = {}, requestId = "" }) {
    const { data, generation_mode } = await runWithFallback({
      feature: "recruiter_outreach",
      userId: viewer.id,
      requestId,
      llmCall: llmProvider?.generateOutreach
        ? (provider) => provider.generateOutreach(payload)
        : null,
      fallbackBuilder: () => ({
        subject: `Exciting opportunity: ${payload.jobTitle || "Engineering Role"}`,
        message: `Hi ${payload.candidateName || "there"},\n\nWe reviewed your profile and would love to invite you to discuss our ${payload.jobTitle || "open"} position.\n\nBest regards`,
      }),
    });

    return { outreach: data, generation_mode };
  }

  return {
    generateInterviewQuestions,
    getInterviewQuestionsByApplication,
    handleApplicationInterviewEvent,
    optimizeCvForJob,
    generateCoverLetter,
    generateOutreach,
  };
}
