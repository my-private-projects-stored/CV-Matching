'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Briefcase, Calendar, RefreshCw, Sparkles, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, ScoreBar, ErrorBanner, EmptyState } from '@/components/ui';
import {
  createApplication,
  fetchMasterResume,
  fetchResumeList,
  getJobRecommendations,
  type JobRecommendation,
  type RecommendationMeta,
  type ResumeListItem,
} from '@/lib/api';

// ── Score Circle ──────────────────────────────────────────────────────────────

function ScoreCircle({ value }: { value: number }) {
  const { t } = useTranslations();
  const pct = Math.round(value * 100);
  const color =
    value >= 0.75 ? 'var(--success)' : value >= 0.5 ? 'var(--warning)' : 'var(--danger)';
  const label =
    value >= 0.75
      ? t('scores.strongMatch')
      : value >= 0.5
        ? t('scores.potential')
        : t('scores.weakMatch');
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full border-2 font-mono text-sm font-bold tabular-nums"
        style={{ borderColor: color, color }}
      >
        {pct}%
      </div>
      <span className="text-[10px] font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// ── Keyword Pills ─────────────────────────────────────────────────────────────

function KeywordPills({ keywords, max = 5 }: { keywords: string[]; max?: number }) {
  const { t } = useTranslations();
  const visible = keywords.slice(0, max);
  const extra = keywords.length - max;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((kw) => (
        <span
          key={kw}
          className="rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--success)]"
        >
          {kw}
        </span>
      ))}
      {extra > 0 && (
        <span className="rounded-full bg-[var(--blue-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--blue-700)]">
          {t('scores.moreKeywords', { count: extra })}
        </span>
      )}
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobRecommendationCard({
  job,
  onApply,
  disabled,
}: {
  job: JobRecommendation;
  onApply: (job: JobRecommendation) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslations();
  const tierColor =
    job.scores.hybrid_score >= 0.75
      ? 'var(--success)'
      : job.scores.hybrid_score >= 0.5
        ? 'var(--warning)'
        : 'var(--danger)';

  return (
    <article
      className="card-hover animate-fade-up flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-[var(--shadow-elev-1)]"
      style={{ borderLeftWidth: 3, borderLeftColor: tierColor }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[var(--text-1)]">{job.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-2)]">
            <span className="flex items-center gap-1">
              <Briefcase className="size-3" />
              {job.category}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {job.location || t('recommendations.remote')}
            </span>
            {job.application_deadline && (
              <span className="flex items-center gap-1 text-[var(--warning)]">
                <Calendar className="size-3" />
                {new Date(job.application_deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <ScoreCircle value={job.scores.hybrid_score} />
      </div>

      {/* Description preview */}
      {job.description_preview && (
        <p className="line-clamp-2 text-xs text-[var(--text-2)]">{job.description_preview}</p>
      )}

      {/* Score bars */}
      <div className="space-y-1.5">
        <ScoreBar
          label={t('scores.semantic')}
          value={job.scores.semantic_score}
          color="var(--blue-600)"
        />
        <ScoreBar
          label={t('scores.keyword')}
          value={job.scores.keyword_score}
          color="var(--success)"
        />
      </div>

      {/* Matched keywords */}
      {job.matched_keywords.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            {t('scores.matchedSkills')}
          </p>
          <KeywordPills keywords={job.matched_keywords} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link
          href={`/candidate/jobs/${job.job_id}`}
          className="flex-1 rounded-lg bg-[var(--blue-700)] py-2 text-center text-sm font-semibold text-white transition hover:bg-[#1e40af]"
        >
          {t('recommendations.viewJob')}
        </Link>
        <button
          type="button"
          onClick={() => onApply(job)}
          disabled={disabled}
          className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm font-semibold text-[var(--text-2)] transition hover:border-[var(--blue-700)] hover:text-[var(--blue-700)]"
        >
          {t('common.apply')}
        </button>
      </div>
    </article>
  );
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

function JobCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border bg-white p-5">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-[var(--border)]" />
          <div className="h-3 w-24 rounded bg-[var(--border)]" />
        </div>
        <div className="h-14 w-14 rounded-full bg-[var(--border)]" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 rounded bg-[var(--border)]" />
        <div className="h-2 rounded bg-[var(--border)]" />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-8 flex-1 rounded bg-[var(--border)]" />
        <div className="h-8 flex-1 rounded bg-[var(--border)]" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const LIMIT_OPTIONS = [10, 20, 50];

export default function CandidateRecommendationsPage() {
  const header = usePageHeader('candidateRecommendations');
  const { t } = useTranslations();
  const [jobs, setJobs] = useState<JobRecommendation[]>([]);
  const [meta, setMeta] = useState<RecommendationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [applyJob, setApplyJob] = useState<JobRecommendation | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  // Filter state
  const [limit, setLimit] = useState(10);
  const [semanticWeight, setSemanticWeight] = useState(0.65);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchMasterResume().catch(() => null),
      fetchResumeList(true).catch(() => []),
    ]).then(([masterResume, resumeItems]) => {
      if (!active) return;
      if (masterResume?.resume_id) {
        setMasterResumeId(masterResume.resume_id);
      }
      setResumes(resumeItems);
      const master = resumeItems.find((item) => item.is_master);
      setSelectedResumeId(master?.resume_id || resumeItems[0]?.resume_id || '');
    });
    return () => {
      active = false;
    };
  }, []);

  const fetchRecommendations = useCallback(
    async (resumeId: string) => {
      setLoading(true);
      setError(null);
      const result = await getJobRecommendations(resumeId, {
        limit,
        semantic_weight: semanticWeight,
      });
      if ('error' in result) {
        setError(result.error);
        setJobs([]);
      } else {
        setJobs(result.data);
        setMeta(result.meta);
      }
      setLoading(false);
    },
    [limit, semanticWeight]
  );

  useEffect(() => {
    if (masterResumeId) {
      fetchRecommendations(masterResumeId);
    }
  }, [masterResumeId, fetchRecommendations]);

  const avgScore = useMemo(() => {
    if (!jobs.length) return 0;
    return Math.round(
      (jobs.reduce((acc, j) => acc + j.scores.hybrid_score, 0) / jobs.length) * 100
    );
  }, [jobs]);

  function openApplyModal(job: JobRecommendation) {
    setApplyJob(job);
    setApplyError(null);
    setApplyMessage(null);
  }

  async function handleApply() {
    if (!applyJob || !selectedResumeId) return;
    setApplyLoading(true);
    setApplyError(null);
    setApplyMessage(null);
    try {
      await createApplication({ job_id: applyJob.job_id, resume_id: selectedResumeId });
      setApplyMessage(t('jobs.applicationSubmitted'));
      setTimeout(() => {
        setApplyJob(null);
        setApplyMessage(null);
      }, 1200);
    } catch (requestError) {
      setApplyError(requestError instanceof Error ? requestError.message : t('errors.apply'));
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-elev-1)]">
        {/* Limit */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
            {t('recommendations.results')}
          </label>
          <div className="relative">
            <select
              id="limit-select"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="appearance-none rounded-lg border border-[var(--border)] bg-white px-3 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--blue-700)]"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {t('recommendations.jobsCount', { count: n })}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-4 text-[var(--text-3)]" />
          </div>
        </div>

        {/* Semantic weight */}
        <div className="min-w-[160px] flex-1 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
            {t('recommendations.semanticWeight', {
              percent: Math.round(semanticWeight * 100),
            })}
          </label>
          <input
            id="semantic-weight"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={semanticWeight}
            onChange={(e) => setSemanticWeight(Number(e.target.value))}
            className="w-full accent-[var(--blue-700)]"
          />
        </div>

        <button
          id="refresh-recommendations-btn"
          type="button"
          disabled={!masterResumeId || loading}
          onClick={() => masterResumeId && fetchRecommendations(masterResumeId)}
          className="flex items-center gap-2 rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? t('recommendations.searching') : t('recommendations.refresh')}
        </button>
      </div>

      {/* Stats strip */}
      {meta && !loading && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-[var(--border)] bg-[var(--blue-50)] px-4 py-2.5 text-sm text-[var(--blue-700)]">
          <span className="font-semibold">
            {meta.total === 1
              ? t('recommendations.matchesFound', { count: meta.total })
              : t('recommendations.matchesFoundPlural', { count: meta.total })}
          </span>
          <span className="text-[var(--text-2)]">·</span>
          <span>{t('recommendations.avgScore', { score: avgScore })}</span>
          <span className="text-[var(--text-2)]">·</span>
          <span>{t('recommendations.basedOnMaster')}</span>
        </div>
      )}

      {/* No resume yet */}
      {!masterResumeId && !loading && (
        <EmptyState
          title={t('emptyStates.noMasterResume.title')}
          description={t('emptyStates.noMasterResume.description')}
          action={
            <Link
              href="/candidate/resumes"
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white"
            >
              {t('emptyStates.noMasterResume.action')}
            </Link>
          }
        />
      )}

      <ErrorBanner message={error ?? ''} />

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      ) : !error && jobs.length === 0 && masterResumeId ? (
        <EmptyState
          title={t('emptyStates.noMatchingJobs.title')}
          description={t('emptyStates.noMatchingJobs.description')}
          action={
            <button
              type="button"
              onClick={() => masterResumeId && fetchRecommendations(masterResumeId)}
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white"
            >
              <Sparkles className="mr-1.5 inline size-4" />
              {t('recommendations.tryAgain')}
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <JobRecommendationCard
              key={job.job_id}
              job={job}
              onApply={openApplyModal}
              disabled={applyLoading}
            />
          ))}
        </div>
      )}

      {applyJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold">
              {t('jobs.applyForTitle', { title: applyJob.title })}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">{t('jobs.selectResumeToApply')}</p>
            {resumes.length === 0 ? (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t('jobs.noResumesYet')}{' '}
                <Link href="/candidate/resumes" className="underline">
                  {t('jobs.uploadFirst')}
                </Link>
              </div>
            ) : (
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
            )}
            {applyError ? (
              <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
                {applyError}
              </p>
            ) : null}
            {applyMessage ? (
              <p className="mt-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
                {applyMessage}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                onClick={() => setApplyJob(null)}
                disabled={applyLoading}
                type="button"
              >
                {t('common.cancel')}
              </button>
              <button
                className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={handleApply}
                disabled={applyLoading || !selectedResumeId || resumes.length === 0}
                type="button"
              >
                {applyLoading ? t('jobs.submitting') : t('jobs.submitApplication')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
