'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AiScoreWidget,
  AiStatusIndicator,
  ErrorBanner,
  SkeletonCard,
} from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import {
  createApplication,
  fetchApplicationFeedback,
  fetchApplicationStatusHistory,
  type ApplicationFeedbackResponse,
  type ApplicationStatusHistoryResponse,
} from '@/lib/api/applications';
import { fetchJobById, type JobItem } from '@/lib/api/jobs';
import { fetchResumeList, type ResumeListItem } from '@/lib/api/resume';

export default function CandidateApplicationDetailPage() {
  const header = usePageHeader('candidateApplicationDetail');
  const { t } = useTranslations();
  const params = useParams();
  const applicationId = params?.id as string;
  const [feedback, setFeedback] = useState<ApplicationFeedbackResponse['data'] | null>(null);
  const [history, setHistory] = useState<ApplicationStatusHistoryResponse['data']['history']>([]);
  const [job, setJob] = useState<JobItem | null>(null);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [showReapplyModal, setShowReapplyModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchApplicationFeedback(applicationId),
      fetchApplicationStatusHistory(applicationId),
      fetchResumeList(true),
    ])
      .then(async ([feedbackPayload, historyPayload, resumeItems]) => {
        if (!active) return;
        const feedbackData = feedbackPayload.data;
        setFeedback(feedbackData);
        setHistory(historyPayload.data.history ?? []);
        setResumes(resumeItems);
        const master = resumeItems.find((item) => item.is_master);
        setSelectedResumeId(master?.resume_id || resumeItems[0]?.resume_id || '');
        if (feedbackData.job_id) {
          const jobData = await fetchJobById(feedbackData.job_id);
          if (active) setJob(jobData);
        }
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t('errors.loadApplication'));
        setFeedback(null);
        setHistory([]);
        setJob(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applicationId, t]);

  const canReapply = Boolean(feedback?.job_id && job?.status === 'active');

  async function handleReapply() {
    if (!feedback?.job_id || !selectedResumeId || !canReapply) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await createApplication({ job_id: feedback.job_id, resume_id: selectedResumeId });
      setMessage(t('jobs.applicationSubmitted'));
      setShowReapplyModal(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.apply'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs text-[var(--text-3)]">{t('jobs.label')}</p>
          <p className="text-sm font-semibold">{job?.title || feedback?.job_id || '-'}</p>
          <p className="text-xs text-[var(--text-2)]">{job?.location || '-'}</p>
          {job ? (
            <div className="mt-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  job.status === 'active'
                    ? 'bg-green-50 text-[var(--success)]'
                    : 'bg-slate-100 text-[var(--text-2)]'
                }`}
              >
                {job.status === 'active' ? t('jobs.acceptingApplications') : t('jobs.closed')}
              </span>
            </div>
          ) : null}
        </div>
        <Link className="text-xs text-[var(--blue-700)]" href="/candidate/applications">
          {t('applications.backToApplications')}
        </Link>
      </aside>
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{header.title}</h1>
          <p className="text-sm text-[var(--text-2)]">{header.subtitle}</p>
        </div>
        {loading ? <SkeletonCard /> : null}
        {error ? <ErrorBanner message={error} /> : null}
        {message ? (
          <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
            {message}
          </p>
        ) : null}
        {!loading && !error && feedback ? (
          <>
            <AiScoreWidget
              semanticScore={feedback.scores.semantic_score}
              keywordScore={feedback.scores.keyword_score}
              hybridScore={feedback.scores.hybrid_score}
              matchedKeywords={feedback.explainability.matched_keywords}
              missingKeywords={feedback.explainability.missing_keywords}
            />
            <AiStatusIndicator status={feedback.ai_status} />
            <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <h2 className="text-sm font-semibold">{t('applications.statusTimeline')}</h2>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-3)]">
                  {t('applications.noStatusChanges')}
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {history.map((entry, index) => (
                    <div
                      key={`${entry.changed_at}-${index}`}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                    >
                      <p className="font-semibold">
                        {t('applications.statusTransition', {
                          from: entry.from_status ? t(`status.${entry.from_status}`) : '-',
                          to: t(`status.${entry.to_status}`),
                        })}
                      </p>
                      <p className="text-[var(--text-3)]">
                        {new Date(entry.changed_at).toLocaleString()} - {entry.changed_by}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <h2 className="text-sm font-semibold">{t('applications.improvementSuggestions')}</h2>
              {feedback.recommendations?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--text-2)]">
                  {feedback.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-3)]">
                  {t('applications.noKeywordSuggestions')}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {feedback.resume_id ? (
                <Link
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                  href={`/candidate/resumes/${feedback.resume_id}/builder`}
                >
                  {t('applications.editResume')}
                </Link>
              ) : null}
              {canReapply ? (
                <button
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                  onClick={() => setShowReapplyModal(true)}
                  type="button"
                >
                  {t('applications.reapply')}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      {showReapplyModal && feedback?.job_id ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold">
              {t('jobs.applyForTitle', { title: job?.title ?? feedback.job_id })}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">{t('jobs.selectResume')}</p>
            <select
              className="mt-4 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              value={selectedResumeId}
              onChange={(event) => setSelectedResumeId(event.target.value)}
            >
              {resumes.map((resume) => (
                <option key={resume.resume_id} value={resume.resume_id}>
                  {resume.title || t('resumes.defaultTitle')}
                  {resume.is_master ? t('forms.masterSuffix') : ''}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                onClick={() => setShowReapplyModal(false)}
                disabled={saving}
                type="button"
              >
                {t('common.cancel')}
              </button>
              <button
                className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={handleReapply}
                disabled={saving || !selectedResumeId || resumes.length === 0}
                type="button"
              >
                {saving ? t('jobs.submitting') : t('jobs.submitApplication')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
