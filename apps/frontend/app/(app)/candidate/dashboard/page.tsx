'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  AiStatusBadge,
  ScoreBar,
  SkeletonRow,
  ErrorBanner,
  EmptyState,
} from '@/components/ui';
import { getList } from '@/lib/api';
import type { Application } from '@/types';

const pendingAiStatuses = new Set(['pending', 'parsing', 'scoring']);

export default function CandidateDashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getList<Application>('applications', { limit: 20 }).then((res) => {
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

  const stats = useMemo(() => {
    const total = applications.length;
    const avgScore = total
      ? Math.round(
          (applications.reduce((acc, item) => acc + (item.aiScores?.hybridScore ?? 0), 0) / total) *
            100
        )
      : 0;
    const interviews = applications.filter((item) => item.status === 'interview').length;
    const pendingAi = applications.filter((item) => pendingAiStatuses.has(item.aiStatus)).length;
    return { total, avgScore, interviews, pendingAi };
  }, [applications]);

  const recent = applications.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Welcome back, here is your activity." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Applications Sent" value={String(stats.total)} />
        <StatCard label="Avg Match Score" value={`${stats.avgScore}%`} />
        <StatCard label="Interviews" value={String(stats.interviews)} />
        <StatCard label="Pending AI" value={String(stats.pendingAi)} />
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent applications</h2>
          <Link className="text-sm text-[var(--blue-700)]" href="/candidate/applications">
            View all
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : null}
          {error ? <ErrorBanner message={error} /> : null}
          {!loading && !error && recent.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Start applying to see results here."
            />
          ) : null}
          {!loading && !error
            ? recent.map((item) => (
                <div
                  key={item._id}
                  className="grid gap-3 rounded-xl border border-[var(--border)] p-4 md:grid-cols-[2fr_1fr_1fr]"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.jobId}</p>
                    <p className="text-xs text-[var(--text-2)]">{item.createdAt}</p>
                  </div>
                  <ScoreBar
                    label="Hybrid"
                    value={item.aiScores?.hybridScore ?? 0}
                    color="var(--gold)"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <AiStatusBadge status={item.aiStatus} />
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))
            : null}
        </div>
      </section>
    </div>
  );
}
