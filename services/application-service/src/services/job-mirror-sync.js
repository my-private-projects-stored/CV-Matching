import { PUBSUB_CHANNELS } from "@cvm/shared";

/**
 * Event-Carried State Transfer consumer maintaining local job_status_mirror
 * from JOB_STATUS_CHANGED Redis Pub/Sub events (zero cross-service HTTP calls).
 */
export function createJobMirrorSync({ JobStatusMirrorModel, subscriberClient = null }) {
  async function handleJobStatusEvent(payload = {}) {
    const jobId = String(payload?.jobId || "").trim();
    const status = String(payload?.status || "").trim().toLowerCase();
    if (!jobId || !status) return null;

    return JobStatusMirrorModel.findOneAndUpdate(
      { jobId },
      {
        $set: {
          jobId,
          status,
          ...(payload.recruiterId !== undefined ? { recruiterId: String(payload.recruiterId) } : {}),
          ...(payload.title !== undefined ? { title: String(payload.title) } : {}),
          ...(payload.category !== undefined ? { category: String(payload.category) } : {}),
          syncedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }

  if (subscriberClient && typeof subscriberClient.subscribe === "function") {
    subscriberClient.subscribe(PUBSUB_CHANNELS.JOB_STATUS_CHANGED).catch(() => {});
    subscriberClient.on("message", (channel, rawMessage) => {
      if (channel !== PUBSUB_CHANNELS.JOB_STATUS_CHANGED) return;
      try {
        const parsed = JSON.parse(rawMessage);
        handleJobStatusEvent(parsed).catch((err) => {
          console.error("[job-mirror-sync] failed to update mirror:", err?.message || err);
        });
      } catch {
        // Ignore malformed payload
      }
    });
  }

  return { handleJobStatusEvent };
}
