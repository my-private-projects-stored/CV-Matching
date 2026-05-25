'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AiScoreWidget, AiStatusIndicator, ErrorBanner, SkeletonCard } from '@/components/ui';
import { getOne, getPath } from '@/lib/api';
import type { Application, Job } from '@/types';

type FeedbackPayload = {
  application?: Application;
  job?: Job;
  aiScores?: Application['aiScores'];
  aiDetails?: Application['aiDetails'];
  aiStatus?: Application['aiStatus'];
};

export default function CandidateApplicationDetailPage() {
  const params = useParams();
  const applicationId = params?.id as string;
  const [payload, setPayload] = useState<FeedbackPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPath<FeedbackPayload>(`applications/${applicationId}/feedback`).then((res) => {
      if (!active) return;
      if (res.error || !res.data) {
        getOne<Application>('applications', applicationId).then((fallback) => {
          if (!active) return;
          if (fallback.error || !fallback.data) {
            setError(res.error || fallback.error || 'Failed to load feedback');
            setPayload(null);
          } else {
            setPayload({ application: fallback.data });
            setError(null);
          }
          setLoading(false);
        });
        return;
      }
      setPayload(res.data);
      setError(null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [applicationId]);

  const aiScores = payload?.aiScores || payload?.application?.aiScores;
  const aiDetails = payload?.aiDetails || payload?.application?.aiDetails;
  const aiStatus = payload?.aiStatus || payload?.application?.aiStatus || 'pending';

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs text-[var(--text-3)]">Job</p>
          <p className="text-sm font-semibold">
            {payload?.job?.title || payload?.application?.jobId || '-'}
          </p>
          <p className="text-xs text-[var(--text-2)]">{payload?.job?.location || '-'}</p>
        </div>
        <Link className="text-xs text-[var(--blue-700)]" href="/candidate/applications">
          ← Back to Applications
        </Link>
      </aside>
      <section className="space-y-4">
        {loading ? <SkeletonCard /> : null}
        {error ? <ErrorBanner message={error} /> : null}
        {!loading && !error && aiScores && aiDetails ? (
          <AiScoreWidget
            semanticScore={aiScores.semanticScore}
            keywordScore={aiScores.keywordScore}
            hybridScore={aiScores.hybridScore}
            matchedKeywords={aiDetails.matchedKeywords}
            missingKeywords={aiDetails.missingKeywords}
          />
        ) : null}
        <AiStatusIndicator status={aiStatus} />
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
            Edit Resume
          </button>
          <button className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
            Re-apply
          </button>
        </div>
      </section>
    </div>
  );
}
