'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AiScoreWidget,
  StatusBadge,
  AiStatusBadge,
  ErrorBanner,
  SkeletonCard,
} from '@/components/ui';
import { useTranslations } from '@/lib/i18n/translations';
import {
  fetchApplicationFeedback,
  fetchApplicationStatusHistory,
  fetchRankedApplications,
  updateApplicationStatus,
  type ApplicationFeedbackResponse,
  type ApplicationStatus,
  type ApplicationStatusHistoryResponse,
  type RankedCandidateItem,
} from '@/lib/api/applications';
import { fetchJobById, type JobItem } from '@/lib/api/jobs';
import {
  fetchCandidateProfileById,
  type CandidateProfileResponse,
} from '@/lib/api/candidate-profile';
import { downloadOriginalResumeFile } from '@/lib/api/resume';

const ACTION_STATUSES: ApplicationStatus[] = ['interview', 'rejected', 'hired'];

export default function RecruiterCandidateDetailPage() {
  const { t } = useTranslations();
  const params = useParams();
  const jobId = params?.id as string;
  const applicationId = params?.applicationId as string;
  const [feedback, setFeedback] = useState<ApplicationFeedbackResponse['data'] | null>(null);
  const [history, setHistory] = useState<ApplicationStatusHistoryResponse['data']['history']>([]);
  const [rankedCandidate, setRankedCandidate] = useState<RankedCandidateItem | null>(null);
  const [profile, setProfile] = useState<CandidateProfileResponse['data'] | null>(null);
  const [job, setJob] = useState<JobItem | null>(null);
  const [showJobDescription, setShowJobDescription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchApplicationFeedback(applicationId),
      fetchApplicationStatusHistory(applicationId),
      fetchJobById(jobId),
      fetchRankedApplications({ jobId, limit: 100 }),
    ])
      .then(async ([feedbackPayload, historyPayload, jobPayload, rankedPayload]) => {
        if (!active) return;
        const candidate = rankedPayload.data.candidates.find(
          (item) => item.application_id === applicationId
        );
        setFeedback(feedbackPayload.data);
        setHistory(historyPayload.data.history ?? []);
        setJob(jobPayload);
        setRankedCandidate(candidate ?? null);
        if (candidate?.candidate.id) {
          try {
            const candidateProfile = await fetchCandidateProfileById(candidate.candidate.id);
            if (active) setProfile(candidateProfile.data);
          } catch {
            if (active) setProfile(null);
          }
        }
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError instanceof Error ? requestError.message : t('errors.loadApplication')
        );
        setFeedback(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applicationId, jobId, t]);

  async function handleStatus(status: ApplicationStatus) {
    setSaving(true);
    setError(null);
    try {
      await updateApplicationStatus(applicationId, status);
      setFeedback((current) => (current ? { ...current, status } : current));
      setRankedCandidate((current) => (current ? { ...current, status } : current));
      const updatedHistory = await fetchApplicationStatusHistory(applicationId);
      setHistory(updatedHistory.data.history ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('errors.statusUpdateFailed')
      );
    } finally {
      setSaving(false);
    }
  }

  async function downloadResume() {
    if (!feedback?.resume_id) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await downloadOriginalResumeFile(feedback.resume_id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${rankedCandidate?.resume.title || 'resume'}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : t('errors.downloadResume'));
    } finally {
      setSaving(false);
    }
  }

  const candidateName =
    rankedCandidate?.candidate.full_name ||
    profile?.full_name ||
    t('recruiter.candidates.unnamedCandidate');

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-sm font-semibold">{candidateName}</p>
          <p className="text-xs text-[var(--text-2)]">
            {rankedCandidate?.candidate.email || profile?.email || '-'}
          </p>
          {profile?.profile.headline ? (
            <p className="mt-2 text-xs text-[var(--text-2)]">{profile.profile.headline}</p>
          ) : null}
          {feedback?.resume_id ? (
            <button
              className="mt-3 inline-block rounded-lg border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-60"
              onClick={() => void downloadResume()}
              disabled={saving}
              type="button"
            >
              {t('recruiter.candidateDetail.downloadCv')}
            </button>
          ) : null}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-semibold">{t('recruiter.candidateDetail.pipeline')}</p>
          <div className="mt-2 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span>{t('recruiter.candidateDetail.statusLabel')}</span>
              {feedback ? <StatusBadge status={feedback.status} /> : null}
            </div>
            <div className="flex items-center justify-between">
              <span>{t('recruiter.candidateDetail.aiLabel')}</span>
              {feedback ? <AiStatusBadge status={feedback.ai_status} /> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTION_STATUSES.map((status) => (
            <button
              key={status}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs disabled:opacity-60"
              onClick={() => void handleStatus(status)}
              disabled={saving || feedback?.status === status}
              type="button"
            >
              {t(`status.${status}`)}
            </button>
          ))}
        </div>
        {feedback?.resume_id ? (
          <Link
            className="block rounded-lg bg-[var(--blue-700)] px-3 py-2 text-center text-xs font-semibold text-white"
            href={`/recruiter/jobs/${jobId}/interview?resume_id=${feedback.resume_id}&application_id=${applicationId}`}
          >
            {t('recruiter.candidateDetail.interviewQuestions')}
          </Link>
        ) : null}
      </aside>
      <section className="space-y-4">
        {loading ? <SkeletonCard /> : null}
        {error ? <ErrorBanner message={error} /> : null}
        {!loading && !error && feedback ? (
          <AiScoreWidget
            semanticScore={feedback.scores.semantic_score}
            keywordScore={feedback.scores.keyword_score}
            hybridScore={feedback.scores.hybrid_score}
            matchedKeywords={feedback.explainability.matched_keywords}
            missingKeywords={feedback.explainability.missing_keywords}
          />
        ) : null}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <h2 className="text-sm font-semibold">{t('recruiter.candidateDetail.statusTimeline')}</h2>
          <div className="mt-3 space-y-2">
            {history.map((entry, index) => (
              <div
                key={`${entry.changed_at}-${index}`}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
              >
                <span className="font-semibold">
                  {entry.from_status ? t(`status.${entry.from_status}`) : '-'} {'->'}{' '}
                  {t(`status.${entry.to_status}`)}
                </span>
                <span className="ml-2 text-[var(--text-3)]">
                  {new Date(entry.changed_at).toLocaleString()}
                </span>
              </div>
            ))}
            {!history.length ? (
              <p className="text-sm text-[var(--text-3)]">{t('applications.noStatusChanges')}</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <button
            className="text-sm font-semibold text-[var(--blue-700)]"
            type="button"
            onClick={() => setShowJobDescription((current) => !current)}
          >
            {t('recruiter.candidateDetail.toggleJobDescription')}
          </button>
          {showJobDescription ? (
            <div className="mt-3 space-y-4 text-sm text-[var(--text-2)]">
              <h3 className="font-semibold text-[var(--text-1)]">{job?.title}</h3>
              <p className="whitespace-pre-line">{job?.description}</p>
              {job?.requirements ? <p className="whitespace-pre-line">{job.requirements}</p> : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
