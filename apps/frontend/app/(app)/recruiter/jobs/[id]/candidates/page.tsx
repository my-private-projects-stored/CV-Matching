'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader, CandidateRow, ErrorBanner, SkeletonRow } from '@/components/ui';
import { getPath } from '@/lib/api';
import type { Application } from '@/types';

export default function RecruiterCandidatesPage() {
  const params = useParams();
  const jobId = params?.id as string;
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPath<Application[]>(`jobs/${jobId}/applications`, { sort: 'hybridScore:desc' }).then(
      (res) => {
        if (!active) return;
        if (res.error) {
          setError(res.error);
          setApplications([]);
        } else {
          setError(null);
          setApplications(res.data ?? []);
        }
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [jobId]);

  return (
    <div className="space-y-6">
      <PageHeader title="Candidates" subtitle="Ranked by hybrid score." />
      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-white p-4">
        <input
          className="h-9 flex-1 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder="Search name"
        />
        <select className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm">
          <option>Status</option>
        </select>
        <select className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm">
          <option>AI Status</option>
        </select>
        <input
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
          placeholder="Score range"
        />
      </div>
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error
        ? applications.map((item) => (
            <CandidateRow
              key={item._id}
              application={{
                ...item,
                name: item._id,
                role: item.jobId,
                location: item.status,
              }}
            />
          ))
        : null}
    </div>
  );
}
