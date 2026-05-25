'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, StatCard, CandidateRow, ErrorBanner, SkeletonRow } from '@/components/ui';
import { getList, getPath } from '@/lib/api';
import type { Application, Job } from '@/types';

export default function RecruiterDashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getList<Job>('jobs', { limit: 20 }).then(async (jobsRes) => {
      if (!active) return;

      if (jobsRes.error) {
        setError(jobsRes.error);
        setApplications([]);
        setJobs([]);
        setLoading(false);
        return;
      }

      const loadedJobs = jobsRes.data ?? [];
      const firstActiveJob = loadedJobs.find((job) => job.status === 'active') ?? loadedJobs[0];
      const appsRes = firstActiveJob
        ? await getPath<Application[]>(`jobs/${firstActiveJob._id}/applications`, { limit: 5 })
        : { data: [] as Application[] };

      if (!active) return;
      if (appsRes.error) {
        setError(appsRes.error);
        setApplications([]);
        setJobs(loadedJobs);
      } else {
        setError(null);
        setApplications(appsRes.data ?? []);
        setJobs(loadedJobs);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const avgScore = useMemo(() => {
    if (applications.length === 0) return 0;
    return Math.round(
      (applications.reduce((acc, item) => acc + (item.aiScores?.hybridScore ?? 0), 0) /
        applications.length) *
        100
    );
  }, [applications]);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Recruiter activity at a glance." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Jobs"
          value={String(jobs.filter((job) => job.status === 'active').length)}
        />
        <StatCard
          label="Total Applicants"
          value={String(jobs.reduce((acc, job) => acc + (job.applications_count ?? 0), 0))}
        />
        <StatCard label="Avg Match Score" value={`${avgScore}%`} />
        <StatCard
          label="Hired This Month"
          value={String(applications.filter((app) => app.status === 'hired').length)}
        />
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-semibold">Recent applications</h2>
        {loading ? (
          <div className="mt-4 space-y-3">
            <SkeletonRow />
          </div>
        ) : null}
        {error ? <ErrorBanner message={error} /> : null}
        {!loading && !error && applications.length > 0 ? (
          <div className="mt-4">
            <CandidateRow
              application={{
                ...applications[0],
                name: applications[0]._id,
                role: applications[0].jobId,
                location: applications[0].status,
              }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
