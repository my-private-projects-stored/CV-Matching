import { PUBSUB_CHANNELS } from "@cvm/shared";

/**
 * Subscribe to APPLICATION_SCORED, APPLICATION_STATUS_CHANGED, and JOB_STATUS_CHANGED
 * from Redis Pub/Sub and dispatch idempotent notifications + SSE + email tasks.
 */
export function createNotificationEventConsumer({ notificationService, subscriberClient = null }) {
  async function handleEvent(channel, payload = {}) {
    if (channel === PUBSUB_CHANNELS.APPLICATION_STATUS_CHANGED) {
      const candidateId = String(payload.candidate_id || payload.candidateId || "").trim();
      const applicationId = String(payload.application_id || payload.applicationId || "").trim();
      const toStatus = String(payload.to_status || payload.toStatus || "").trim();
      if (!candidateId || !applicationId || !toStatus) return null;

      return notificationService.createAndDispatch({
        userId: candidateId,
        type: "application_status_changed",
        title: `Application moved to ${toStatus}`,
        body: `Your application status changed from ${payload.from_status || "previous"} to ${toStatus}.`,
        payload,
        idempotencyKey: `app_status:${applicationId}:${toStatus}:${payload.changed_at || "1"}`,
        emailTask: {
          application_id: applicationId,
          recipient_email: payload.candidate_email || payload.recipient_email || "",
          recipient_name: payload.candidate_name || "Candidate",
          job_title: payload.job_title || "Target Role",
          job_location: payload.job_location || "",
          from_status: payload.from_status || null,
          to_status: toStatus,
        },
      });
    }

    if (channel === PUBSUB_CHANNELS.APPLICATION_SCORED) {
      const candidateId = String(payload.candidate_id || payload.candidateId || "").trim();
      const applicationId = String(payload.application_id || payload.applicationId || "").trim();
      if (!candidateId || !applicationId) return null;

      const hybridPct = Math.round(Number(payload.scores?.hybridScore || 0) * 100);
      const candidateResult = await notificationService.createAndDispatch({
        userId: candidateId,
        type: "ai_scoring_completed",
        title: "AI CV Scoring Completed",
        body: `Your application achieved a ${hybridPct}% match score.`,
        payload,
        idempotencyKey: `app_scored:${applicationId}:${payload.published_at || "1"}`,
        emailTask: {
          application_id: applicationId,
          recipient_email: payload.candidate_email || payload.recipient_email || "",
          recipient_name: payload.candidate_name || "Candidate",
          job_title: payload.job_title || "Target Role",
          ai_scores: payload.scores || {},
          ai_details: payload.ai_details || {},
        },
      });
      const recruiterId = String(payload.recruiter_id || payload.recruiterId || "").trim();
      if (recruiterId && recruiterId !== candidateId) {
        await notificationService.createAndDispatch({
          userId: recruiterId,
          type: "ai_scoring_completed",
          title: "New Scored Application",
          body: `A candidate application achieved a ${hybridPct}% match score.`,
          payload,
          idempotencyKey: `app_scored_recruiter:${applicationId}:${payload.published_at || "1"}`,
          emailTask: null,
        });
      }
      return candidateResult;
    }

    if (channel === PUBSUB_CHANNELS.JOB_STATUS_CHANGED) {
      const status = String(payload.status || "").toLowerCase();
      if (status !== "closed" && status !== "deleted") return null;

      const jobId = String(payload.jobId || payload.job_id || "").trim();
      const targetUsers = Array.isArray(payload.affected_candidates)
        ? payload.affected_candidates
        : payload.recruiterId
        ? [{ userId: String(payload.recruiterId), email: payload.recruiter_email || "" }]
        : [];

      const results = [];
      for (const target of targetUsers) {
        const uid = String(target.userId || target.id || "").trim();
        if (!uid) continue;
        results.push(
          await notificationService.createAndDispatch({
            userId: uid,
            type: "job_closed",
            title: `Job ${status}`,
            body: `Job ${payload.job_title || jobId} has been ${status}.`,
            payload,
            idempotencyKey: `job_${status}:${jobId}:${uid}`,
            emailTask: target.email
              ? {
                  job_id: jobId,
                  job_title: payload.job_title || "Target Role",
                  job_location: payload.job_location || "",
                  recipient_email: target.email,
                  recipient_name: target.name || "Candidate",
                }
              : null,
          })
        );
      }
      return results;
    }

    return null;
  }

  if (subscriberClient && typeof subscriberClient.subscribe === "function") {
    const channels = [
      PUBSUB_CHANNELS.APPLICATION_SCORED,
      PUBSUB_CHANNELS.APPLICATION_STATUS_CHANGED,
      PUBSUB_CHANNELS.JOB_STATUS_CHANGED,
    ];
    for (const ch of channels) {
      subscriberClient.subscribe(ch).catch(() => {});
    }

    subscriberClient.on("message", (channel, rawMessage) => {
      if (!channels.includes(channel)) return;
      try {
        const parsed = JSON.parse(rawMessage);
        handleEvent(channel, parsed).catch((err) => {
          console.error("[notification-service] event error:", err?.message || err);
        });
      } catch {
        // Ignore malformed payload
      }
    });
  }

  return { handleEvent };
}
