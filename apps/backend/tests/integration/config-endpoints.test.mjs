import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import Application from "../../src/models/Application.js";
import Job from "../../src/models/Job.js";
import Resume from "../../src/models/Resume.js";
import SystemConfig from "../../src/models/SystemConfig.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  url.pathname = "/cv_matching_config_integration";
  return url.toString();
}

async function requestJson(baseUrl, method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { status: response.status, json, text };
}

test(
  "settings endpoints contract: status + language + features + prompts + api-keys + reset",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = getTestMongoUri();
    await mongoose.connect(mongoUri);

    await Promise.all([
      Application.deleteMany({}),
      Job.deleteMany({}),
      Resume.deleteMany({}),
      SystemConfig.deleteMany({}),
    ]);

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const recruiterSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "recruiter.config@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Config",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterToken = recruiterSignup.json?.access_token;
      assert.ok(recruiterToken);

      const statusBefore = await requestJson(baseUrl, "GET", "/status");
      assert.equal(statusBefore.status, 200);
      assert.equal(statusBefore.json?.database_stats?.total_jobs, 0);

      const featureGet = await requestJson(baseUrl, "GET", "/config/features", undefined, recruiterToken);
      assert.equal(featureGet.status, 200);
      assert.equal(featureGet.json?.enable_cover_letter, false);

      const featurePut = await requestJson(baseUrl, "PUT", "/config/features", {
        enable_cover_letter: true,
        enable_outreach_message: true,
      }, recruiterToken);
      assert.equal(featurePut.status, 200);
      assert.equal(featurePut.json?.enable_cover_letter, true);

      const companyProfileGet = await requestJson(baseUrl, "GET", "/config/company-profile", undefined, recruiterToken);
      assert.equal(companyProfileGet.status, 200);
      assert.equal(companyProfileGet.json?.company_name, "");

      const companyProfilePut = await requestJson(baseUrl, "PUT", "/config/company-profile", {
        company_name: "Resume Labs",
        overview: "AI recruiting platform",
        industry: "Software",
        company_size: "51-200",
        address: "Hanoi",
        website: "resumelabs.example",
        brand_primary_color: "#1d4ed8",
        brand_logo_url: "https://resumelabs.example/logo.png",
      }, recruiterToken);
      assert.equal(companyProfilePut.status, 200);
      assert.equal(companyProfilePut.json?.company_name, "Resume Labs");
      assert.equal(companyProfilePut.json?.website, "https://resumelabs.example");
      assert.equal(companyProfilePut.json?.brand_primary_color, "#1D4ED8");

      const languagePut = await requestJson(baseUrl, "PUT", "/config/language", {
        ui_language: "vi",
        content_language: "en",
      }, recruiterToken);
      assert.equal(languagePut.status, 200);
      assert.equal(languagePut.json?.ui_language, "vi");

      const promptsPut = await requestJson(baseUrl, "PUT", "/config/prompts", {
        default_prompt_id: "full",
      }, recruiterToken);
      assert.equal(promptsPut.status, 200);
      assert.equal(promptsPut.json?.default_prompt_id, "full");

      const llmPut = await requestJson(baseUrl, "PUT", "/config/llm-api-key", {
        provider: "openai",
        model: "gpt-5-nano-2025-08-07",
        api_key: "sk-test-1234567890",
      }, recruiterToken);
      assert.equal(llmPut.status, 200);
      assert.match(llmPut.json?.api_key || "", /\*\*\*\*/);

      const privacyGet = await requestJson(baseUrl, "GET", "/config/privacy", undefined, recruiterToken);
      assert.equal(privacyGet.status, 200);
      assert.equal(privacyGet.json?.privacy_mode, "hybrid");

      const privacyPut = await requestJson(baseUrl, "PUT", "/config/privacy", {
        privacy_mode: "local_only",
      }, recruiterToken);
      assert.equal(privacyPut.status, 200);
      assert.equal(privacyPut.json?.privacy_mode, "local_only");

      const llmPutBlockedByPrivacy = await requestJson(baseUrl, "PUT", "/config/llm-api-key", {
        provider: "openai",
        model: "gpt-5-nano-2025-08-07",
      }, recruiterToken);
      assert.equal(llmPutBlockedByPrivacy.status, 400);
      assert.equal(llmPutBlockedByPrivacy.json?.error_code, "provider_blocked_by_privacy_mode");

      const llmTestBlockedByPrivacy = await requestJson(baseUrl, "POST", "/config/llm-test", {
        provider: "openai",
        model: "gpt-5-nano-2025-08-07",
      }, recruiterToken);
      assert.equal(llmTestBlockedByPrivacy.status, 200);
      assert.equal(llmTestBlockedByPrivacy.json?.healthy, false);
      assert.equal(llmTestBlockedByPrivacy.json?.error_code, "provider_blocked_by_privacy_mode");

      const llmPutOllama = await requestJson(baseUrl, "PUT", "/config/llm-api-key", {
        provider: "ollama",
        model: "gemma3:4b",
        api_base: "http://localhost:11434",
      }, recruiterToken);
      assert.equal(llmPutOllama.status, 200);
      assert.equal(llmPutOllama.json?.provider, "ollama");

      const llmTest = await requestJson(baseUrl, "POST", "/config/llm-test", {
        provider: "ollama",
        model: "gemma3:4b",
      }, recruiterToken);
      assert.equal(llmTest.status, 200);
      assert.equal(llmTest.json?.healthy, true);

      const apiKeysPost = await requestJson(baseUrl, "POST", "/config/api-keys", {
        openai: "sk-openai-123456",
        google: "gk-google-123456",
      }, recruiterToken);
      assert.equal(apiKeysPost.status, 200);
      assert.deepEqual(apiKeysPost.json?.updated_providers?.sort(), ["google", "openai"]);

      const apiKeysBadProvider = await requestJson(baseUrl, "POST", "/config/api-keys", {
        not_a_provider: "abc-123",
      }, recruiterToken);
      assert.equal(apiKeysBadProvider.status, 400);

      const apiKeysBlankValue = await requestJson(baseUrl, "POST", "/config/api-keys", {
        openai: "   ",
      }, recruiterToken);
      assert.equal(apiKeysBlankValue.status, 200);

      const apiKeysAfterBlank = await requestJson(baseUrl, "GET", "/config/api-keys", undefined, recruiterToken);
      assert.equal(apiKeysAfterBlank.status, 200);
      const openaiAfterBlank = apiKeysAfterBlank.json?.providers?.find(
        (p) => p.provider === "openai"
      );
      assert.equal(openaiAfterBlank?.configured, false);

      const apiKeysGet = await requestJson(baseUrl, "GET", "/config/api-keys", undefined, recruiterToken);
      assert.equal(apiKeysGet.status, 200);
      const openaiStatus = apiKeysGet.json?.providers?.find((p) => p.provider === "openai");
      assert.equal(openaiStatus?.configured, false);

      const deleteUnsupportedProvider = await requestJson(
        baseUrl,
        "DELETE",
        "/config/api-keys/not-a-provider",
        undefined,
        recruiterToken
      );
      assert.equal(deleteUnsupportedProvider.status, 400);

      const deleteNonexistentButValidProvider = await requestJson(
        baseUrl,
        "DELETE",
        "/config/api-keys/deepseek",
        undefined,
        recruiterToken
      );
      assert.equal(deleteNonexistentButValidProvider.status, 204);

      const deleteProvider = await requestJson(baseUrl, "DELETE", "/config/api-keys/google", undefined, recruiterToken);
      assert.equal(deleteProvider.status, 204);

      const clearAllMissingConfirm = await requestJson(baseUrl, "DELETE", "/config/api-keys", undefined, recruiterToken);
      assert.equal(clearAllMissingConfirm.status, 400);

      const clearAll = await requestJson(
        baseUrl,
        "DELETE",
        "/config/api-keys?confirm=CLEAR_ALL_KEYS",
        undefined,
        recruiterToken
      );
      assert.equal(clearAll.status, 204);

      await Job.create({
        recruiterId: new mongoose.Types.ObjectId(),
        title: "Test Job",
        description: "Description",
        requirements: "Requirements",
        cleanText: "Clean text",
        keywords: ["node"],
        category: "IT",
      });

      await Resume.create({
        candidateId: new mongoose.Types.ObjectId(),
        fileUrl: "https://example.com/cv.pdf",
        rawText: "resume raw text",
      });

      const statusWithData = await requestJson(baseUrl, "GET", "/status");
      assert.equal(statusWithData.status, 200);
      assert.equal(statusWithData.json?.database_stats?.total_jobs, 1);
      assert.equal(statusWithData.json?.database_stats?.total_resumes, 1);

      const resetBad = await requestJson(baseUrl, "POST", "/config/reset", {
        confirm: "INVALID",
      }, recruiterToken);
      assert.equal(resetBad.status, 400);

      const resetOk = await requestJson(baseUrl, "POST", "/config/reset", {
        confirm: "RESET_ALL_DATA",
      }, recruiterToken);
      assert.equal(resetOk.status, 200);
      assert.equal(resetOk.json?.message, "Database reset completed");

      const statusAfter = await requestJson(baseUrl, "GET", "/status");
      assert.equal(statusAfter.status, 200);
      assert.equal(statusAfter.json?.database_stats?.total_jobs, 0);
      assert.equal(statusAfter.json?.database_stats?.total_resumes, 0);
      assert.equal(statusAfter.json?.llm_configured, false);
      assert.equal(statusAfter.json?.privacy_mode, "hybrid");
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
);
