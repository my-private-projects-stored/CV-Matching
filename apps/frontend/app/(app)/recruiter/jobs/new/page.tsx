'use client';

import { useState } from 'react';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { postOne } from '@/lib/api';
import type { JobCategory, Job } from '@/types';

export default function RecruiterJobNewPage() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<JobCategory>('IT');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [benefits, setBenefits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const res = await postOne<Job, Partial<Job>>('jobs', {
      title,
      category,
      location,
      description,
      requirements,
      benefits,
    });
    if (res.error) {
      setError(res.error);
    } else {
      setError(null);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Post New Job" subtitle="Create a job description." />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <select
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value as JobCategory)}
          >
            <option value="IT">IT</option>
            <option value="Accounting">Accounting</option>
            <option value="Marketing">Marketing</option>
          </select>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder="Location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
          <textarea
            className="min-h-28 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            placeholder="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <textarea
            className="min-h-24 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            placeholder="Requirements"
            value={requirements}
            onChange={(event) => setRequirements(event.target.value)}
          />
          <textarea
            className="min-h-24 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
            placeholder="Benefits"
            value={benefits}
            onChange={(event) => setBenefits(event.target.value)}
          />
          <div className="flex gap-2">
            <button className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
              Save Draft
            </button>
            <button
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Publishing...' : 'Publish Job'}
            </button>
          </div>
        </section>
        <aside className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <p className="text-sm font-semibold">Preview</p>
          <div className="mt-3 h-40 rounded-lg border border-dashed border-[var(--border)]" />
          <div className="mt-4 rounded-lg bg-[var(--blue-50)] p-3 text-xs text-[var(--text-2)]">
            AI readiness score will appear here.
          </div>
        </aside>
      </div>
    </div>
  );
}
