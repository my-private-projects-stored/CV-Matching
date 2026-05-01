import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import User from "../../src/models/User.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
   url.pathname = "/cv_matching_candidate_profile_integration";
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
  "candidate profile endpoints contract: get/update for candidate only",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = getTestMongoUri();
    await mongoose.connect(mongoUri);
    await User.deleteMany({});

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.profile@example.com",
        password: "StrongPass123",
        full_name: "Candidate Profile",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateToken = candidateSignup.json?.access_token;
      const candidateId = candidateSignup.json?.user?.id;
      assert.ok(candidateToken);
      assert.ok(candidateId);

      const recruiterSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "recruiter.profile@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Profile",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterToken = recruiterSignup.json?.access_token;
      assert.ok(recruiterToken);

      const getCandidateProfile = await requestJson(
        baseUrl,
        "GET",
        "/candidate-profile/me",
        undefined,
        candidateToken
      );
      assert.equal(getCandidateProfile.status, 200);
      assert.equal(getCandidateProfile.json?.data?.role, "candidate");

      const updateCandidateProfile = await requestJson(
        baseUrl,
        "PUT",
        "/candidate-profile/me",
        {
          headline: "Frontend Engineer",
          summary: "  Build scalable web UI.  ",
          location: "Hanoi",
          website: "portfolio.example",
          skills: ["React", "TypeScript", "Node.js"],
          portfolio_links: ["portfolio.example"],
          experience: [
            {
              title: "  Senior Engineer  ",
              company: "Example Co",
              location: "Remote",
              start_date: "2022-01",
              end_date: "2024-01",
              summary: " Led core UI work. ",
            },
          ],
        },
        candidateToken
      );
      assert.equal(updateCandidateProfile.status, 200);
      assert.equal(updateCandidateProfile.json?.data?.profile?.headline, "Frontend Engineer");
      assert.equal(updateCandidateProfile.json?.data?.profile?.summary, "Build scalable web UI.");
      assert.equal(updateCandidateProfile.json?.data?.profile?.website, "https://portfolio.example");
      assert.equal(
        updateCandidateProfile.json?.data?.profile?.experience?.[0]?.title,
        "Senior Engineer"
      );
      assert.deepEqual(updateCandidateProfile.json?.data?.profile?.skills, [
        "React",
        "TypeScript",
        "Node.js",
      ]);
      assert.equal(
        updateCandidateProfile.json?.data?.profile?.portfolio_links?.[0],
        "portfolio.example"
      );

      const recruiterGetProfile = await requestJson(
        baseUrl,
        "GET",
        `/candidate-profile/${candidateId}`,
        undefined,
        recruiterToken
      );
      assert.equal(recruiterGetProfile.status, 200);
      assert.equal(recruiterGetProfile.json?.data?.user_id, candidateId);

      const invalidProfile = await requestJson(
        baseUrl,
        "GET",
        "/candidate-profile/not-a-valid-id",
        undefined,
        recruiterToken
      );
      assert.equal(invalidProfile.status, 400);
      assert.equal(invalidProfile.json?.error_code, "candidate_profile_invalid_user_id");

      const recruiterForbidden = await requestJson(
        baseUrl,
        "GET",
        "/candidate-profile/me",
        undefined,
        recruiterToken
      );
      assert.equal(recruiterForbidden.status, 403);
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
