import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

process.env.NODE_ENV = "test";

import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import app from "../../src/app.js";
import User from "../../src/models/User.js";
import { installMockMailer } from "../helpers/mock-mailer.mjs";

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
    const mailerHarness = installMockMailer();
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
      assert.equal(mailerHarness.mockMailer.sentMessages.length, 1);
      assert.equal(mailerHarness.mockMailer.sentMessages[0].to, "candidate.auth@example.com");
      assert.equal(mailerHarness.mockMailer.sentMessages[0].subject, "Reset your password");
      assert.match(mailerHarness.mockMailer.sentMessages[0].reset_link, /\/reset-password\?token=/);
      const resetTokenFromEmail = new URL(mailerHarness.mockMailer.sentMessages[0].reset_link).searchParams.get("token");
      assert.ok(resetTokenFromEmail);

      const forgotPasswordUnknownAccount = await requestJson(baseUrl, "POST", "/auth/forgot-password", {
        email: "unknown.candidate.auth@example.com",
      });
      assert.equal(forgotPasswordUnknownAccount.status, 200);
      assert.equal(
        forgotPasswordUnknownAccount.json?.message,
        "If the account exists, a reset instruction has been generated"
      );
      assert.equal(mailerHarness.mockMailer.sentMessages.length, 1);

      const changePasswordAfterForgot = await requestJson(
        baseUrl,
        "POST",
        "/auth/change-password",
        {
          current_password: "NewStrongPass123",
          new_password: "AnotherStrongPass123",
        },
        accessToken
      );
      assert.equal(changePasswordAfterForgot.status, 200);

      const resetAfterPasswordChange = await requestJson(baseUrl, "POST", "/auth/reset-password", {
        token: resetTokenFromEmail,
        new_password: "ResetPass123",
      });
      assert.equal(resetAfterPasswordChange.status, 400);

      const forgotPasswordAfterPasswordChange = await requestJson(baseUrl, "POST", "/auth/forgot-password", {
        email: "candidate.auth@example.com",
      });
      assert.equal(forgotPasswordAfterPasswordChange.status, 200);
      assert.equal(mailerHarness.mockMailer.sentMessages.length, 2);
      const resetTokenAfterPasswordChange = new URL(
        mailerHarness.mockMailer.sentMessages[1].reset_link
      ).searchParams.get("token");
      assert.ok(resetTokenAfterPasswordChange);

      const resetBadToken = await requestJson(baseUrl, "POST", "/auth/reset-password", {
        token: "invalid-token",
        new_password: "ResetPass123",
      });
      assert.equal(resetBadToken.status, 400);

      const resetPassword = await requestJson(baseUrl, "POST", "/auth/reset-password", {
        token: resetTokenAfterPasswordChange,
        new_password: "ResetPass123",
      });
      assert.equal(resetPassword.status, 200);

      const resetReuse = await requestJson(baseUrl, "POST", "/auth/reset-password", {
        token: resetTokenAfterPasswordChange,
        new_password: "ResetPass456",
      });
      assert.equal(resetReuse.status, 400);

      const expiredToken = jwt.sign(
        {
          sub: String(signup.json?.user?.id),
          email: "candidate.auth@example.com",
          type: "reset-password",
          prv: 999,
        },
        process.env.JWT_SECRET || "dev-only-jwt-secret-change-me",
        { expiresIn: -10 }
      );

      const resetExpiredToken = await requestJson(baseUrl, "POST", "/auth/reset-password", {
        token: expiredToken,
        new_password: "ResetPass789",
      });
      assert.equal(resetExpiredToken.status, 400);

      const loginAfterReset = await requestJson(baseUrl, "POST", "/auth/login", {
        email: "candidate.auth@example.com",
        password: "ResetPass123",
      });
      assert.equal(loginAfterReset.status, 200);
    } finally {
      mailerHarness.reset();
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
