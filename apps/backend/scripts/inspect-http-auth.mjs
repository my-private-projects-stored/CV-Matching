import jwt from "jsonwebtoken";
import fs from "fs";

const JWT_SECRET = "dev-only-jwt-secret-change-me";

// Sign access token for recruiter@gmail.com (ID: 6a168b5c9bac2a2e23f598e7)
const token = jwt.sign(
  {
    sub: "6a168b5c9bac2a2e23f598e7",
    email: "recruiter@gmail.com",
    role: "recruiter",
    type: "access",
  },
  JWT_SECRET,
  { expiresIn: "7d" }
);

async function run() {
  const url = "http://localhost:3000/recruiter/jobs/6a1852be270f3cb9d56e87a9/candidates/6a18658569dd7f88829775a3";
  try {
    const res = await fetch(url, {
      headers: {
        "Cookie": `cvm_token=${token}`,
        "Accept": "text/html"
      },
      redirect: "manual"
    });
    console.log("Status:", res.status);
    console.log("Status text:", res.statusText);
    console.log("Location header:", res.headers.get("location"));
    const text = await res.text();
    fs.writeFileSync("apps/backend/scripts/response.html", text);
    console.log("Wrote response to response.html, length:", text.length);
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

run();
