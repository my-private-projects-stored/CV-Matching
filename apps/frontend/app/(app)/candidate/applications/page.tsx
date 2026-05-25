'use client';

import { useEffect, useState } from 'react';
import {
  PageHeader,
  EmptyState,
  ErrorBanner,
  SkeletonRow,
  ScoreBar,
  AiStatusBadge,
  StatusBadge,
} from '@/components/ui';
import { getList } from '@/lib/api';
import type { Application } from '@/types';

export default function CandidateApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getList<Application>('applications', { sort: 'createdAt:desc', limit: 50 }).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setApplications([]);
      } else {
        setError(null);
        setApplications(res.data ?? []);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="AI Applications" subtitle="Track your AI-ranked applications." />
      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-white p-4">
        <input
          className="h-9 flex-1 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder="Search"
        />
        <select className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm">
          <option>Status</option>
        </select>
        <select className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm">
          <option>AI Status</option>
        </select>
        <input
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder="Date range"
        />
      </div>
      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && applications.length === 0 ? (
        <EmptyState title="No applications yet" description="Browse jobs to get started." />
      ) : null}
      {!loading && !error ? (
        <div className="space-y-3">
          {applications.map((item) => (
            <div key={item._id} className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{item.jobId}</p>
                  <p className="text-xs text-[var(--text-2)]">Applied {item.createdAt}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AiStatusBadge status={item.aiStatus} />
                  <StatusBadge status={item.status} />
                </div>
              </div>
              <div className="mt-3">
                <ScoreBar
                  label="Hybrid"
                  value={item.aiScores?.hybridScore ?? 0}
                  color="var(--gold)"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <a
                  className="text-xs text-[var(--blue-700)]"
                  href={`/candidate/applications/${item._id}`}
                >
                  View Feedback
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
