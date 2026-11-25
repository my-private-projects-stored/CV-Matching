import { PUBSUB_CHANNELS } from "@cvm/shared";

/**
 * Subscribe to APPLICATION_STATUS_CHANGED and auto-generate recruiter interview questions
 * whenever an application moves into 'interview'.
 */
export function createEnrichmentEventConsumer({ enrichmentService, subscriberClient = null }) {
  if (subscriberClient && typeof subscriberClient.subscribe === "function") {
    subscriberClient.subscribe(PUBSUB_CHANNELS.APPLICATION_STATUS_CHANGED).catch(() => {});
    subscriberClient.on("message", (channel, rawMessage) => {
      if (channel !== PUBSUB_CHANNELS.APPLICATION_STATUS_CHANGED) return;
      try {
        const parsed = JSON.parse(rawMessage);
        enrichmentService.handleApplicationInterviewEvent(parsed).catch((err) => {
          console.error("[ai-enrichment] Failed handling interview event:", err?.message || err);
        });
      } catch {
        // Ignore malformed payload
      }
    });
  }
}
