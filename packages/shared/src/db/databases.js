/**
 * Logical database names for Database-per-Service on MongoDB 8 Replica Set (rs0).
 */
export const SERVICE_DATABASES = Object.freeze({
  auth: "cvm_auth",
  resume: "cvm_resume",
  job: "cvm_job",
  application: "cvm_application",
  recommendation: "cvm_recommendation",
  enrichment: "cvm_enrichment",
  notification: "cvm_notification",
  config: "cvm_config",
});

/**
 * Build a service-specific MongoDB URI pointing to `dbName` while preserving query params.
 */
export function buildServiceMongoUri(baseUri, dbName) {
  const rawBase = String(baseUri || "").trim();
  const targetDb = String(dbName || "").trim();

  if (!rawBase) {
    throw new Error("baseUri is required");
  }
  if (!targetDb) {
    throw new Error("dbName is required");
  }

  const parsed = new URL(rawBase);
  parsed.pathname = `/${targetDb.replace(/^\/+/, "")}`;
  return parsed.toString();
}
