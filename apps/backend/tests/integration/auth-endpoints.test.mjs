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
  url.pathname = "/cv_matching_auth_integration";
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
  "auth endpoints contract: signup/login/me/change-password/forgot-reset",
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
      const signup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.auth@example.com",
        password: "StrongPass123",
        full_name: "Candidate Auth",
      });
      assert.equal(signup.status, 201);
      assert.equal(signup.json?.user?.email, "candidate.auth@example.com");
      assert.equal(signup.json?.user?.role, "candidate");
      assert.ok(signup.json?.access_token);

      const duplicateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.auth@example.com",
        password: "StrongPass123",
        full_name: "Candidate Auth",
      });
      assert.equal(duplicateSignup.status, 409);

      const badLogin = await requestJson(baseUrl, "POST", "/auth/login", {
        email: "candidate.auth@example.com",
        password: "WrongPass123",
      });
      assert.equal(badLogin.status, 401);

      const login = await requestJson(baseUrl, "POST", "/auth/login", {
        email: "candidate.auth@example.com",
        password: "StrongPass123",
      });
      assert.equal(login.status, 200);
      const accessToken = login.json?.access_token;
      assert.ok(accessToken);

      const me = await requestJson(baseUrl, "GET", "/auth/me", undefined, accessToken);
      assert.equal(me.status, 200);
      assert.equal(me.json?.user?.full_name, "Candidate Auth");

      const changePasswordNoToken = await requestJson(baseUrl, "POST", "/auth/change-password", {
        current_password: "StrongPass123",
        new_password: "NewStrongPass123",
      });
      assert.equal(changePasswordNoToken.status, 401);

      const changePassword = await requestJson(
        baseUrl,
        "POST",
        "/auth/change-password",
        {
          current_password: "StrongPass123",
          new_password: "NewStrongPass123",
        },
        accessToken
      );
      assert.equal(changePassword.status, 200);

      const loginOldPassword = await requestJson(baseUrl, "POST", "/auth/login", {
        email: "candidate.auth@example.com",
        password: "StrongPass123",
      });
      assert.equal(loginOldPassword.status, 401);

      const loginNewPassword = await requestJson(baseUrl, "POST", "/auth/login", {
        email: "candidate.auth@example.com",
        password: "NewStrongPass123",
      });
      assert.equal(loginNewPassword.status, 200);

      const forgotPassword = await requestJson(baseUrl, "POST", "/auth/forgot-password", {
        email: "candidate.auth@example.com",
      });
      assert.equal(forgotPassword.status, 200);
      assert.equal(
        forgotPassword.json?.message,
        "If the account exists, a reset instruction has been generated"
      );
      assert.ok(forgotPassword.json?.reset_token);

      const resetBadToken = await requestJson(baseUrl, "POST", "/auth/reset-password", {
        token: "invalid-token",
        new_password: "ResetPass123",
      });
      assert.equal(resetBadToken.status, 400);

      const resetPassword = await requestJson(baseUrl, "POST", "/auth/reset-password", {
        token: forgotPassword.json?.reset_token,
        new_password: "ResetPass123",
      });
      assert.equal(resetPassword.status, 200);

      const loginAfterReset = await requestJson(baseUrl, "POST", "/auth/login", {
        email: "candidate.auth@example.com",
        password: "ResetPass123",
      });
      assert.equal(loginAfterReset.status, 200);
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
