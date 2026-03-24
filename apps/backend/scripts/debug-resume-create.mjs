import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Resume from "../src/models/Resume.js";

async function run() {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}/api`;

  await mongoose.connect(mongoUri);
  await Promise.all([User.deleteMany({}), Resume.deleteMany({})]);

  const signupRes = await fetch(`${base}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "cand500@example.com",
      password: "StrongPass123",
      full_name: "Cand 500",
      role: "candidate",
    }),
  });
  const signupJson = await signupRes.json();

  const resumeRes = await fetch(`${base}/resumes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${signupJson.access_token}`,
    },
    body: JSON.stringify({
      fileUrl: "upload://cand",
      rawText: "Candidate resume",
      parsedData: { personalInfo: { name: "Candidate" } },
    }),
  });

  const bodyText = await resumeRes.text();
  console.log(JSON.stringify({ status: resumeRes.status, bodyText }, null, 2));

  await mongoose.disconnect();
  await new Promise((resolve) => server.close(resolve));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
