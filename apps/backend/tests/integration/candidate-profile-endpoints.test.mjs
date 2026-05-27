import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import User from "../../src/models/User.js";
import Job from "../../src/models/Job.js";
import Resume from "../../src/models/Resume.js";

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
    await Promise.all([User.deleteMany({}), Job.deleteMany({}), Resume.deleteMany({})]);

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

      await Resume.create({
        candidateId,
        fileUrl: "upload://r1",
        rawText: "candidate main text",
        processingStatus: "ready",
      });

      await Job.create({
        recruiterId: recruiterSignup.json.user.id,
        title: "Test Job",
        description: "Desc",
        requirements: "At least 2 years of experience with React and Node.js",
        cleanText: "Desc",
        category: "IT",
        status: "active",
      });

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

      // Guardrail: too many experience items should be rejected with explicit error_code
      const manyExperience = Array.from({ length: 30 }).map((_, i) => ({
        title: `Title ${i}`,
        company: `Co ${i}`,
        summary: 'Valid summary',
      }));

      const tooManyExp = await requestJson(
        baseUrl,
        "PUT",
        "/candidate-profile/me",
        { experience: manyExperience },
        candidateToken
      );
      assert.equal(tooManyExp.status, 400);
      assert.equal(tooManyExp.json?.error_code, 'candidate_profile_too_many_experience_items');

      // Guardrail: too long summary should be rejected with explicit error_code
      const longSummary = 'x'.repeat(6000);
      const tooLongSummary = await requestJson(
        baseUrl,
        "PUT",
        "/candidate-profile/me",
        { summary: longSummary },
        candidateToken
      );
      assert.equal(tooLongSummary.status, 400);
      assert.equal(tooLongSummary.json?.error_code, 'candidate_profile_summary_too_long');

      // Guardrail: too many education items should be rejected with explicit error_code
      const manyEducation = Array.from({ length: 30 }).map((_, i) => ({
        school: `School ${i}`,
        degree: `Degree ${i}`,
        field: `Field ${i}`,
      }));

      const tooManyEducation = await requestJson(
        baseUrl,
        "PUT",
        "/candidate-profile/me",
        { education: manyEducation },
        candidateToken
      );
      assert.equal(tooManyEducation.status, 400);
      assert.equal(
        tooManyEducation.json?.error_code,
        'candidate_profile_too_many_education_items'
      );

      // Guardrail: too many portfolio items should be rejected with explicit error_code
      const manyPortfolio = Array.from({ length: 60 }).map((_, i) => ({
        name: `Portfolio ${i}`,
        url: `https://example.com/${i}`,
      }));

      const tooManyPortfolio = await requestJson(
        baseUrl,
        "PUT",
        "/candidate-profile/me",
        { portfolio: manyPortfolio },
        candidateToken
      );
      assert.equal(tooManyPortfolio.status, 400);
      assert.equal(
        tooManyPortfolio.json?.error_code,
        'candidate_profile_too_many_portfolio_items'
      );

      // Guardrail: too long education summary should be rejected with explicit error_code
      const educationSummaryTooLong = await requestJson(
        baseUrl,
        "PUT",
        "/candidate-profile/me",
        {
          education: [
            {
              school: 'State University',
              degree: 'BSc',
              field: 'CS',
              summary: 'x'.repeat(6000),
            },
          ],
        },
        candidateToken
      );
      assert.equal(educationSummaryTooLong.status, 400);
      assert.equal(
        educationSummaryTooLong.json?.error_code,
        'candidate_profile_education_summary_too_long'
      );

      // Guardrail: too long portfolio description should be rejected with explicit error_code
      const portfolioDescriptionTooLong = await requestJson(
        baseUrl,
        "PUT",
        "/candidate-profile/me",
        {
          portfolio: [
            {
              name: 'Main Portfolio',
              url: 'https://portfolio.example.com',
              description: 'x'.repeat(1200),
            },
          ],
        },
        candidateToken
      );
      assert.equal(portfolioDescriptionTooLong.status, 400);
      assert.equal(
        portfolioDescriptionTooLong.json?.error_code,
        'candidate_profile_portfolio_description_too_long'
      );
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
