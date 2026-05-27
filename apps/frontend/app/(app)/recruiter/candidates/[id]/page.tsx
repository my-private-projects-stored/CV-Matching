'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ErrorBanner, PageHeader, SkeletonCard, StatusBadge } from '@/components/ui';
import { useTranslations } from '@/lib/i18n/translations';
import {
  fetchCandidateProfileById,
  type CandidateProfileResponse,
} from '@/lib/api/candidate-profile';
import {
  fetchCandidateApplicationHistory,
  type CandidateHistoryItem,
} from '@/lib/api/applications';

export default function RecruiterCandidateProfilePage() {
  const { t } = useTranslations();
  const params = useParams();
  const candidateId = params?.id as string;
  const [profile, setProfile] = useState<CandidateProfileResponse['data'] | null>(null);
  const [applications, setApplications] = useState<CandidateHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchCandidateProfileById(candidateId),
      fetchCandidateApplicationHistory({ candidateId, limit: 20 }),
    ])
      .then(([profilePayload, historyPayload]) => {
        if (!active) return;
        setProfile(profilePayload.data);
        setApplications(historyPayload.data.applications);
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t('errors.loadProfile'));
        setProfile(null);
        setApplications([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [candidateId, t]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile?.full_name || t('recruiter.candidates.unnamedCandidate')}
        subtitle={profile?.email || t('recruiter.candidateDetail.candidate')}
      />
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && profile ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <p className="text-sm font-semibold">{profile.profile.headline || profile.full_name}</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">{profile.profile.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.profile.skills.slice(0, 12).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-[var(--blue-50)] px-2 py-1 text-xs text-[var(--blue-700)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </aside>
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-sm font-semibold">{t('routes.applications')}</h2>
            <div className="mt-4 space-y-3">
              {applications.map((application) => (
                <Link
                  key={application.application_id}
                  href={`/recruiter/jobs/${application.job.id}/candidates/${application.application_id}`}
                  className="grid gap-3 rounded-xl border border-[var(--border)] p-4 text-sm hover:bg-slate-50 md:grid-cols-[1fr_120px_100px]"
                >
                  <span>
                    <span className="block font-semibold">{application.job.title}</span>
                    <span className="text-xs text-[var(--text-3)]">{application.resume.title}</span>
                  </span>
                  <span>{Math.round(application.scores.hybrid_score * 100)}%</span>
                  <StatusBadge status={application.status} />
                </Link>
              ))}
              {!applications.length ? (
                <p className="text-sm text-[var(--text-3)]">
                  {t('emptyStates.noApplicationsFound.description')}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
