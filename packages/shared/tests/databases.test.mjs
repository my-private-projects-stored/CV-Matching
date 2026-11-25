import test from "node:test";
import assert from "node:assert/strict";

import { SERVICE_DATABASES, buildServiceMongoUri } from "../src/db/databases.js";

test("SERVICE_DATABASES defines all 8 logical Microservice databases", () => {
  assert.equal(Object.keys(SERVICE_DATABASES).length, 8);
  assert.equal(SERVICE_DATABASES.auth, "cvm_auth");
  assert.equal(SERVICE_DATABASES.resume, "cvm_resume");
  assert.equal(SERVICE_DATABASES.job, "cvm_job");
  assert.equal(SERVICE_DATABASES.application, "cvm_application");
  assert.equal(SERVICE_DATABASES.recommendation, "cvm_recommendation");
  assert.equal(SERVICE_DATABASES.enrichment, "cvm_enrichment");
  assert.equal(SERVICE_DATABASES.notification, "cvm_notification");
  assert.equal(SERVICE_DATABASES.config, "cvm_config");
});

test("buildServiceMongoUri replaces database path and preserves replicaSet & authSource", () => {
  const uri = buildServiceMongoUri(
    "mongodb://admin:admin123@mongo:27017/?authSource=admin&replicaSet=rs0",
    SERVICE_DATABASES.application
  );
  assert.equal(
    uri,
    "mongodb://admin:admin123@mongo:27017/cvm_application?authSource=admin&replicaSet=rs0"
  );
});

test("buildServiceMongoUri throws on missing baseUri or dbName", () => {
  assert.throws(() => buildServiceMongoUri("", "cvm_auth"), /baseUri is required/);
  assert.throws(() => buildServiceMongoUri("mongodb://localhost:27017", ""), /dbName is required/);
});
