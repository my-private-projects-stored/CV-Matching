import { SERVICE_DATABASES, canonicalizeRole } from "@cvm/shared";

function parseRangeDays(range = "30d") {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 30;
}

/**
 * MongoDB Secondary-Replica data provider for PLATFORM_OWNER BI analytics.
 */
export function createMongoAnalyticsProvider(mongooseConnection) {
  return {
    async loadSnapshot({ sinceDate }) {
      const authDb = mongooseConnection.useDb(SERVICE_DATABASES.auth, { useCache: true });
      const resumeDb = mongooseConnection.useDb(SERVICE_DATABASES.resume, { useCache: true });
      const jobDb = mongooseConnection.useDb(SERVICE_DATABASES.job, { useCache: true });
      const appDb = mongooseConnection.useDb(SERVICE_DATABASES.application, { useCache: true });

      const readOpts = { readPreference: "secondaryPreferred" };
      const dateFilter = sinceDate ? { createdAt: { $gte: sinceDate } } : {};

      const [users, resumes, jobs, applications] = await Promise.all([
        authDb.collection("users").find(dateFilter, readOpts).toArray(),
        resumeDb.collection("resumes").find(dateFilter, readOpts).toArray(),
        jobDb.collection("jobs").find(dateFilter, readOpts).toArray(),
        appDb.collection("applications").find(dateFilter, readOpts).toArray(),
      ]);

      return { users, resumes, jobs, applications };
    },
  };
}

/**
 * Business Intelligence analytics service for PLATFORM_OWNER.
 */
export function createAnalyticsService({ dataProvider }) {
  async function getOverview({ range = "30d", from = null, to = null } = {}) {
    const days = parseRangeDays(range);
    const sinceDate = from ? new Date(from) : new Date(Date.now() - days * 86400 * 1000);
    const untilDate = to ? new Date(to) : new Date();

    const snapshot = await dataProvider.loadSnapshot({ sinceDate, untilDate });
    const users = snapshot.users || [];
    const resumes = snapshot.resumes || [];
    const jobs = snapshot.jobs || [];
    const applications = snapshot.applications || [];

    const usersByRole = { candidate: 0, recruiter: 0, tech_staff: 0, platform_owner: 0 };
    for (const u of users) {
      const r = canonicalizeRole(u.role) || u.role;
      if (usersByRole[r] !== undefined) usersByRole[r] += 1;
    }

    const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "open").length;
    const categoryBreakdown = {};
    for (const j of jobs) {
      const cat = String(j.category || "general");
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    }

    const dailyMap = new Map();
    const bumpDay = (dateVal, field) => {
      const day = new Date(dateVal || Date.now()).toISOString().slice(0, 10);
      const entry = dailyMap.get(day) || { date: day, users: 0, resumes: 0, jobs: 0, applications: 0 };
      entry[field] += 1;
      dailyMap.set(day, entry);
    };

    users.forEach((u) => bumpDay(u.createdAt, "users"));
    resumes.forEach((r) => bumpDay(r.createdAt, "resumes"));
    jobs.forEach((j) => bumpDay(j.createdAt, "jobs"));
    applications.forEach((a) => bumpDay(a.createdAt, "applications"));

    const series = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      range,
      kpis: {
        totalUsers: users.length,
        usersByRole,
        totalResumes: resumes.length,
        totalJobs: jobs.length,
        activeJobs,
        totalApplications: applications.length,
      },
      categoryBreakdown,
      series,
    };
  }

  async function getFunnel({ range = "30d" } = {}) {
    const days = parseRangeDays(range);
    const sinceDate = new Date(Date.now() - days * 86400 * 1000);
    const snapshot = await dataProvider.loadSnapshot({ sinceDate, untilDate: new Date() });
    const applications = snapshot.applications || [];

    const stageCounts = {
      new: 0,
      screening: 0,
      interview: 0,
      offer: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0,
    };

    const highScoreGroup = { count: 0, interviewed: 0, hired: 0 };
    const lowScoreGroup = { count: 0, interviewed: 0, hired: 0 };

    for (const app of applications) {
      const st = String(app.status || "new");
      if (stageCounts[st] !== undefined) stageCounts[st] += 1;

      const hybrid = Number(app.aiScores?.hybridScore ?? 0);
      const reachedInterview = ["interview", "offer", "hired"].includes(st);
      const isHired = st === "hired";

      if (hybrid >= 0.8) {
        highScoreGroup.count += 1;
        if (reachedInterview) highScoreGroup.interviewed += 1;
        if (isHired) highScoreGroup.hired += 1;
      } else if (hybrid < 0.5) {
        lowScoreGroup.count += 1;
        if (reachedInterview) lowScoreGroup.interviewed += 1;
        if (isHired) lowScoreGroup.hired += 1;
      }
    }

    const total = applications.length || 1;
    const rate = (n, d) => Number(((n / (d || 1)) * 100).toFixed(2));

    return {
      range,
      totalApplications: applications.length,
      stageCounts,
      conversionRates: {
        screeningRate: rate(stageCounts.screening + stageCounts.interview + stageCounts.offer + stageCounts.hired, total),
        interviewRate: rate(stageCounts.interview + stageCounts.offer + stageCounts.hired, total),
        offerRate: rate(stageCounts.offer + stageCounts.hired, total),
        hireRate: rate(stageCounts.hired, total),
      },
      aiCorrelation: {
        highScoreGroup: {
          ...highScoreGroup,
          interviewRate: rate(highScoreGroup.interviewed, highScoreGroup.count),
          hireRate: rate(highScoreGroup.hired, highScoreGroup.count),
        },
        lowScoreGroup: {
          ...lowScoreGroup,
          interviewRate: rate(lowScoreGroup.interviewed, lowScoreGroup.count),
          hireRate: rate(lowScoreGroup.hired, lowScoreGroup.count),
        },
      },
    };
  }

  async function exportCsv({ range = "30d" } = {}) {
    const [overview, funnel] = await Promise.all([getOverview({ range }), getFunnel({ range })]);
    const rows = [
      ["section", "metric", "value"],
      ["overview", "total_users", overview.kpis.totalUsers],
      ["overview", "total_resumes", overview.kpis.totalResumes],
      ["overview", "active_jobs", overview.kpis.activeJobs],
      ["overview", "total_applications", overview.kpis.totalApplications],
      ["funnel", "new", funnel.stageCounts.new],
      ["funnel", "screening", funnel.stageCounts.screening],
      ["funnel", "interview", funnel.stageCounts.interview],
      ["funnel", "offer", funnel.stageCounts.offer],
      ["funnel", "hired", funnel.stageCounts.hired],
      ["ai_correlation", "high_score_hire_rate_pct", funnel.aiCorrelation.highScoreGroup.hireRate],
      ["ai_correlation", "low_score_hire_rate_pct", funnel.aiCorrelation.lowScoreGroup.hireRate],
    ];
    return rows.map((r) => r.join(",")).join("\n");
  }

  return {
    getOverview,
    getFunnel,
    exportCsv,
  };
}
