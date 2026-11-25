import "dotenv/config";
import { createRequire } from "node:module";
import { ROLES } from "../packages/shared/src/index.js";

const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const CONVERT_ADMIN = args.has("--convert-admin");
const SEED_ROLES = args.has("--seed-roles");

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://admin:admin123@localhost:27017/?authSource=admin";
  await mongoose.connect(mongoUri);

  const usersCol = mongoose.connection.db.collection("users");
  const counts = await usersCol
    .aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
    .toArray();

  console.log("[migrate-roles] Current role distribution:", counts);

  if (CONVERT_ADMIN) {
    const legacyCount = await usersCol.countDocuments({ role: ROLES.ADMIN_ALIAS });
    if (DRY_RUN) {
      console.log(`[migrate-roles][dry-run] Would convert ${legacyCount} 'admin' users -> '${ROLES.TECH_STAFF}'.`);
    } else if (legacyCount > 0) {
      const res = await usersCol.updateMany(
        { role: ROLES.ADMIN_ALIAS },
        { $set: { role: ROLES.TECH_STAFF, updatedAt: new Date() } }
      );
      console.log(`[migrate-roles] Converted ${res.modifiedCount} 'admin' users -> '${ROLES.TECH_STAFF}'.`);
    }
  }

  if (SEED_ROLES) {
    const demoPassword = process.env.DEMO_ROLE_PASSWORD || "StrongPass123!";
    const seedAccounts = [
      {
        email: "techstaff@cv-matching.local",
        role: ROLES.TECH_STAFF,
        fullName: "System Tech Staff",
      },
      {
        email: "owner@cv-matching.local",
        role: ROLES.PLATFORM_OWNER,
        fullName: "Platform Owner",
      },
    ];

    for (const acc of seedAccounts) {
      const exists = await usersCol.findOne({ email: acc.email });
      if (exists) {
        console.log(`[migrate-roles] Account already exists: ${acc.email} (role=${exists.role})`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`[migrate-roles][dry-run] Would seed ${acc.email} (role=${acc.role}).`);
        continue;
      }
      const passwordHash = await bcrypt.hash(demoPassword, 12);
      const now = new Date();
      await usersCol.insertOne({
        email: acc.email,
        password: passwordHash,
        role: acc.role,
        fullName: acc.fullName,
        avatar: null,
        candidateProfile: {},
        passwordResetVersion: 0,
        disabled: false,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[migrate-roles] Seeded ${acc.email} (role=${acc.role}).`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[migrate-roles] Failed:", err);
  process.exitCode = 1;
});
