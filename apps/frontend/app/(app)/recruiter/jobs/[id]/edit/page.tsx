'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader, ConfirmDialog, ErrorBanner, SkeletonRow } from '@/components/ui';
import { getOne, putOne } from '@/lib/api';
import type { Job, JobCategory } from '@/types';

export default function RecruiterJobEditPage() {
  const params = useParams();
  const jobId = params?.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOne<Job>('jobs', jobId).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setJob(null);
      } else {
        setError(null);
        setJob(res.data ?? null);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [jobId]);

  async function handleSave() {
    if (!job) return;
    const res = await putOne<Job, Partial<Job>>('jobs', jobId, job);
    if (res.error) {
      setError(res.error);
    } else {
      setError(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Job" subtitle="Update your posting." />
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && job ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={job.title}
            onChange={(event) => setJob({ ...job, title: event.target.value })}
          />
          <select
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={job.category}
            onChange={(event) => setJob({ ...job, category: event.target.value as JobCategory })}
          >
            <option value="IT">IT</option>
            <option value="Accounting">Accounting</option>
            <option value="Marketing">Marketing</option>
          </select>
          <textarea
            className="min-h-28 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            value={job.description}
            onChange={(event) => setJob({ ...job, description: event.target.value })}
          />
          <div className="flex gap-2">
            <button className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
              Save Draft
            </button>
            <button
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </section>
      ) : null}
      <ConfirmDialog
        open={false}
        title="Close job posting"
        description="This will remove the job from active listings."
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    </div>
  );
}
