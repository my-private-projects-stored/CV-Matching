'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AiScoreWidget,
  StatusBadge,
  AiStatusBadge,
  ErrorBanner,
  SkeletonCard,
} from '@/components/ui';
import { getOne } from '@/lib/api';
import { apiFetch, apiPatch } from '@/lib/api/client';
import type { Application } from '@/types';

export default function RecruiterCandidateDetailPage() {
  const params = useParams();
  const applicationId = params?.applicationId as string;
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOne<Application>('applications', applicationId).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setApplication(null);
      } else {
        setError(null);
        setApplication(res.data ?? null);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [applicationId]);

  async function updateStatus(status: 'interview' | 'rejected' | 'hired') {
    setSaving(true);
    setError(null);
    const response = await apiPatch(`/applications/${encodeURIComponent(applicationId)}/status`, {
      status,
    });
    if (!response.ok) {
      setError(await response.text());
    } else {
      setApplication((current) => (current ? { ...current, status } : current));
    }
    setSaving(false);
  }

  async function downloadResume() {
    if (!application?.resumeId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/resumes/${encodeURIComponent(application.resumeId)}/download`
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'resume';
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : 'Failed to download resume'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-sm font-semibold">{application?._id || 'Candidate'}</p>
          <p className="text-xs text-[var(--text-2)]">{application?.jobId || '-'}</p>
          {application?.resumeId ? (
            <button
              className="mt-3 inline-block rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
              onClick={downloadResume}
              disabled={saving}
            >
              Download CV
            </button>
          ) : null}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-semibold">Pipeline</p>
          <div className="mt-2 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span>Status</span>
              {application ? <StatusBadge status={application.status} /> : null}
            </div>
            <div className="flex items-center justify-between">
              <span>AI</span>
              {application ? <AiStatusBadge status={application.aiStatus} /> : null}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
            onClick={() => updateStatus('interview')}
            disabled={saving}
          >
            Move to Interview
          </button>
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
            onClick={() => updateStatus('rejected')}
            disabled={saving}
          >
            Reject
          </button>
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
            onClick={() => updateStatus('hired')}
            disabled={saving}
          >
            Hire
          </button>
        </div>
      </aside>
      <section className="space-y-4">
        {loading ? <SkeletonCard /> : null}
        {error ? <ErrorBanner message={error} /> : null}
        {!loading && !error && application?.aiScores && application?.aiDetails ? (
          <AiScoreWidget
            semanticScore={application.aiScores.semanticScore}
            keywordScore={application.aiScores.keywordScore}
            hybridScore={application.aiScores.hybridScore}
            matchedKeywords={application.aiDetails.matchedKeywords}
            missingKeywords={application.aiDetails.missingKeywords}
          />
        ) : null}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <button className="text-sm text-[var(--blue-700)]">Toggle job description</button>
          <p className="mt-2 text-sm text-[var(--text-2)]">Job description details.</p>
        </div>
      </section>
    </div>
  );
}
