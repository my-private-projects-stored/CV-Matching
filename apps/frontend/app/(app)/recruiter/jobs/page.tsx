'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader, EmptyState, ErrorBanner, SkeletonRow } from '@/components/ui';
import { getList } from '@/lib/api';
import { apiDelete } from '@/lib/api/client';
import type { Job } from '@/types';

export default function RecruiterJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadJobs(active = true) {
    setLoading(true);
    getList<Job>('jobs', { limit: 50 }).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setJobs([]);
      } else {
        setError(null);
        setJobs(res.data ?? []);
      }
      setLoading(false);
    });
  }

  useEffect(() => {
    let active = true;
    loadJobs(active);
    return () => {
      active = false;
    };
  }, []);

  async function closeJob(jobId: string) {
    setBusy(true);
    const response = await apiDelete(`/jobs/${encodeURIComponent(jobId)}`);
    if (!response.ok) {
      setError(await response.text());
    } else {
      await loadJobs();
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Postings"
        action={
          <Link
            className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white"
            href="/recruiter/jobs/new"
          >
            + Post New Job
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-white p-4">
        <input
          className="h-9 flex-1 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder="Search"
        />
        <select className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm">
          <option>Status</option>
        </select>
        <select className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm">
          <option>Category</option>
        </select>
      </div>
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && jobs.length === 0 ? (
        <EmptyState title="No job postings" description="Create your first job posting." />
      ) : null}
      {!loading && !error && jobs.length > 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="grid grid-cols-6 text-xs font-semibold text-[var(--text-3)]">
            <span>Title</span>
            <span>Category</span>
            <span>Location</span>
            <span>Status</span>
            <span>Deadline</span>
            <span>Actions</span>
          </div>
          <div className="mt-3 space-y-2">
            {jobs.map((job) => (
              <div key={job._id} className="grid grid-cols-6 text-sm">
                <span>{job.title}</span>
                <span>{job.category}</span>
                <span>{job.location || '-'}</span>
                <span>{job.status}</span>
                <span>{job.applicationDeadline || '-'}</span>
                <span className="flex gap-2">
                  <a
                    className="text-[var(--blue-700)]"
                    href={`/recruiter/jobs/${job._id}/candidates`}
                  >
                    Candidates
                  </a>
                  <a className="text-[var(--blue-700)]" href={`/recruiter/jobs/${job._id}/edit`}>
                    Edit
                  </a>
                  <button
                    className="text-[var(--danger)]"
                    onClick={() => closeJob(job._id)}
                    disabled={busy}
                  >
                    Close
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
