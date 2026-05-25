import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let connected = false;

export async function connectDb() {
  if (connected) return;

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("[worker-notification] MONGO_URI is not set — cannot connect to database");
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 30000,
  });

  connected = true;
  console.log("[worker-notification] MongoDB connected");

  mongoose.connection.on("disconnected", () => {
    connected = false;
    console.warn("[worker-notification] MongoDB disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    connected = true;
    console.log("[worker-notification] MongoDB reconnected");
  });
}

// ---------------------------------------------------------------------------
// Lightweight Schemas (read-only, no validation overhead)
// ---------------------------------------------------------------------------

const userSchema = new mongoose.Schema(
  {
    email: String,
    fullName: String,
    role: String,
  },
  { collection: "users", strict: false }
);

const jobSchema = new mongoose.Schema(
  {
    title: String,
    location: String,
    status: String,
    recruiterId: mongoose.Schema.Types.ObjectId,
  },
  { collection: "jobs", strict: false }
);

const resumeSchema = new mongoose.Schema(
  {
    candidateId: mongoose.Schema.Types.ObjectId,
  },
  { collection: "resumes", strict: false }
);

const applicationSchema = new mongoose.Schema(
  {
    jobId: mongoose.Schema.Types.ObjectId,
    resumeId: mongoose.Schema.Types.ObjectId,
    status: String,
    aiStatus: String,
    aiScores: {
      semanticScore: Number,
      keywordScore: Number,
      hybridScore: Number,
    },
    aiDetails: {
      matchedKeywords: [String],
      missingKeywords: [String],
    },
  },
  { collection: "applications", strict: false }
);

// Re-use existing models if already registered (prevents OverwriteModelError)
const User = mongoose.models.NotifUser || mongoose.model("NotifUser", userSchema);
const Job = mongoose.models.NotifJob || mongoose.model("NotifJob", jobSchema);
const Resume = mongoose.models.NotifResume || mongoose.model("NotifResume", resumeSchema);
const Application =
  mongoose.models.NotifApplication || mongoose.model("NotifApplication", applicationSchema);

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a user's email and display name by ObjectId string.
 * @returns {{ email: string, fullName: string } | null}
 */
export async function getUserById(userId) {
  if (!userId) return null;
  try {
    const user = await User.findById(userId).select("email fullName").lean();
    if (!user) return null;
    return { email: String(user.email || ""), fullName: String(user.fullName || "") };
  } catch (error) {
    console.error("[worker-notification] getUserById failed", { userId, error: error.message });
    return null;
  }
}

/**
 * Fetch full application context needed to build notification emails.
 * Returns candidate user, job details and AI scores.
 * @returns {{ candidateEmail, candidateName, jobTitle, jobLocation, status, aiScores, aiDetails } | null}
 */
export async function getApplicationContext(applicationId) {
  if (!applicationId) return null;

  try {
    const app = await Application.findById(applicationId).lean();
    if (!app) return null;

    const resume = await Resume.findById(app.resumeId).select("candidateId").lean();
    if (!resume) return null;

    const [candidate, job] = await Promise.all([
      User.findById(resume.candidateId).select("email fullName").lean(),
      Job.findById(app.jobId).select("title location recruiterId").lean(),
    ]);

    return {
      applicationId: String(app._id),
      candidateEmail: candidate ? String(candidate.email || "") : null,
      candidateName: candidate ? String(candidate.fullName || "Candidate") : "Candidate",
      jobId: app.jobId ? String(app.jobId) : null,
      jobTitle: job ? String(job.title || "the position") : "the position",
      jobLocation: job ? String(job.location || "") : "",
      status: String(app.status || ""),
      aiStatus: String(app.aiStatus || ""),
      aiScores: {
        hybridScore: Number(app.aiScores?.hybridScore || 0),
        semanticScore: Number(app.aiScores?.semanticScore || 0),
        keywordScore: Number(app.aiScores?.keywordScore || 0),
      },
      aiDetails: {
        matchedKeywords: Array.isArray(app.aiDetails?.matchedKeywords)
          ? app.aiDetails.matchedKeywords
          : [],
        missingKeywords: Array.isArray(app.aiDetails?.missingKeywords)
          ? app.aiDetails.missingKeywords
          : [],
      },
    };
  } catch (error) {
    console.error("[worker-notification] getApplicationContext failed", {
      applicationId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get candidate emails for all pending/new applications on a job.
 * Used for job_closed notifications.
 * @returns {Array<{ candidateEmail, candidateName, applicationId }>}
 */
export async function getCandidatesForJob(jobId) {
  if (!jobId) return [];

  try {
    const apps = await Application.find({
      jobId,
      status: { $in: ["new", "screening", "interview"] },
    })
      .select("_id resumeId")
      .lean();

    const results = [];
    for (const app of apps) {
      const resume = await Resume.findById(app.resumeId).select("candidateId").lean();
      if (!resume) continue;

      const candidate = await User.findById(resume.candidateId).select("email fullName").lean();
      if (!candidate?.email) continue;

      results.push({
        applicationId: String(app._id),
        candidateEmail: String(candidate.email),
        candidateName: String(candidate.fullName || "Candidate"),
      });
    }

    return results;
  } catch (error) {
    console.error("[worker-notification] getCandidatesForJob failed", {
      jobId,
      error: error.message,
    });
    return [];
  }
}

/**
 * Mark a persisted inbox notification as email-delivered.
 */
export async function markNotificationEmailSent(notificationId) {
  if (!notificationId) return;
  try {
    const notificationSchema = new mongoose.Schema(
      { emailSent: Boolean },
      { collection: "notifications", strict: false }
    );
    const Notification =
      mongoose.models.NotifInbox || mongoose.model("NotifInbox", notificationSchema);
    await Notification.findByIdAndUpdate(notificationId, { emailSent: true });
  } catch (error) {
    console.error("[worker-notification] markNotificationEmailSent failed", {
      notificationId,
      error: error.message,
    });
  }
}
