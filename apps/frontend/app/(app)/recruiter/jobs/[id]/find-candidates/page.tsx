'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ChevronDown,
  Search,
  UserCircle,
  Mail,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader, ScoreBar, ErrorBanner, EmptyState } from '@/components/ui';
import {
  getResumeRecommendations,
  type ResumeRecommendation,
  type RecommendationMeta,
} from '@/lib/api';
import { fetchJobById } from '@/lib/api/jobs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name?: string | null) {
  return (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function tierColor(score: number) {
  return score >= 0.75 ? 'var(--success)' : score >= 0.5 ? 'var(--warning)' : 'var(--danger)';
}

function tierLabel(score: number, t: (key: string) => string) {
  return score >= 0.75
    ? t('scores.strong')
    : score >= 0.5
      ? t('scores.potential')
      : t('scores.weak');
}

// ── Keyword Pills ─────────────────────────────────────────────────────────────

function KeywordPills({ keywords }: { keywords: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {keywords.slice(0, 6).map((kw) => (
        <span
          key={kw}
          className="rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--success)]"
        >
          {kw}
        </span>
      ))}
    </div>
  );
}

// ── Candidate Row ─────────────────────────────────────────────────────────────

function CandidateRecommendationRow({
  resume,
  jobId,
  t,
}: {
  resume: ResumeRecommendation;
  jobId: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const color = tierColor(resume.scores.hybrid_score);
  const label = tierLabel(resume.scores.hybrid_score, t);
  const pct = Math.round(resume.scores.hybrid_score * 100);

  return (
    <article
      className="card-hover animate-fade-up grid gap-4 rounded-xl border bg-white p-4 shadow-[var(--shadow-elev-1)] md:grid-cols-[auto_1fr_200px_auto]"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      {/* Avatar */}
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {initials(resume.candidate_name)}
      </div>

      {/* Info */}
      <div className="min-w-0 space-y-1.5">
        <div>
          <p className="font-semibold text-[var(--text-1)]">
            {resume.candidate_name ?? t('recruiter.findCandidates.anonymousCandidate')}
          </p>
          {resume.current_role && (
            <p className="text-xs text-[var(--text-2)]">{resume.current_role}</p>
          )}
          {resume.candidate_email && (
            <p className="flex items-center gap-1 text-xs text-[var(--text-3)]">
              <Mail className="size-3" />
              {resume.candidate_email}
            </p>
          )}
        </div>
        {resume.matched_keywords.length > 0 && <KeywordPills keywords={resume.matched_keywords} />}
        {resume.top_skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {resume.top_skills.slice(0, 5).map((sk) => (
              <span
                key={sk}
                className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--text-2)]"
              >
                {sk}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Scores */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color }}>
            {label} · {pct}%
          </span>
        </div>
        <ScoreBar
          label={t('scores.hybrid')}
          value={resume.scores.hybrid_score}
          color="var(--gold)"
        />
        <ScoreBar
          label={t('scores.semantic')}
          value={resume.scores.semantic_score}
          color="var(--blue-600)"
        />
        <ScoreBar
          label={t('scores.keyword')}
          value={resume.scores.keyword_score}
          color="var(--success)"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {resume.candidate_id ? (
          <Link
            href={`/recruiter/candidates/${resume.candidate_id}`}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] transition hover:border-[var(--blue-700)] hover:text-[var(--blue-700)]"
          >
            <FileText className="size-3.5" />
            {t('recruiter.findCandidates.viewCv')}
          </Link>
        ) : (
          <span className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-3)]">
            <FileText className="size-3.5" />
            {t('recruiter.findCandidates.viewCv')}
          </span>
        )}
        <Link
          href={`/recruiter/jobs/${jobId}/candidates`}
          className="flex items-center justify-center rounded-lg bg-[var(--blue-700)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        >
          {t('recruiter.findCandidates.reviewApplicants')}
        </Link>
      </div>
    </article>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CandidateRowSkeleton() {
  return (
    <div className="animate-pulse grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-[auto_1fr_200px_auto]">
      <div className="h-11 w-11 rounded-full bg-[var(--border)]" />
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-[var(--border)]" />
        <div className="h-3 w-48 rounded bg-[var(--border)]" />
      </div>
      <div className="space-y-2">
        <div className="h-3 rounded bg-[var(--border)]" />
        <div className="h-3 rounded bg-[var(--border)]" />
        <div className="h-3 rounded bg-[var(--border)]" />
      </div>
      <div className="space-y-2">
        <div className="h-8 w-24 rounded bg-[var(--border)]" />
        <div className="h-8 w-24 rounded bg-[var(--border)]" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const LIMIT_OPTIONS = [10, 20, 50];

export default function FindCandidatesPage() {
  const header = usePageHeader('recruiterFindCandidates');
  const { t } = useTranslations();
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [candidates, setCandidates] = useState<ResumeRecommendation[]>([]);
  const [meta, setMeta] = useState<RecommendationMeta | null>(null);
  const [jobTitle, setJobTitle] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limit, setLimit] = useState(10);
  const [semanticWeight, setSemanticWeight] = useState(0.65);

  // Fetch job title
  useEffect(() => {
    if (!jobId) return;
    fetchJobById(jobId)
      .then((job) => setJobTitle(job.title))
      .catch(() => undefined);
  }, [jobId]);

  const fetchCandidates = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    const result = await getResumeRecommendations(jobId, {
      limit,
      semantic_weight: semanticWeight,
    });
    if ('error' in result) {
      setError(result.error);
      setCandidates([]);
    } else {
      setCandidates(result.data);
      setMeta(result.meta);
    }
    setLoading(false);
  }, [jobId, limit, semanticWeight]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const avgScore = useMemo(() => {
    if (!candidates.length) return 0;
    return Math.round(
      (candidates.reduce((acc, c) => acc + c.scores.hybrid_score, 0) / candidates.length) * 100
    );
  }, [candidates]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/recruiter/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--blue-700)]"
      >
        <ArrowLeft className="size-4" />
        {t('recruiter.findCandidates.backToJobs')}
      </Link>

      <PageHeader
        title={header.title}
        subtitle={
          jobTitle
            ? t('recruiter.findCandidates.subtitleForJob', { title: jobTitle })
            : t('recruiter.findCandidates.subtitleDefault')
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-elev-1)]">
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
                  {t('recruiter.findCandidates.resultsCount', { count: n })}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-4 text-[var(--text-3)]" />
          </div>
        </div>

        <div className="min-w-[160px] flex-1 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
            {t('recommendations.semanticWeight', { percent: Math.round(semanticWeight * 100) })}
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
          id="search-candidates-btn"
          type="button"
          disabled={loading}
          onClick={fetchCandidates}
          className="flex items-center gap-2 rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-50"
        >
          <Search className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? t('recommendations.searching') : t('common.search')}
        </button>
      </div>

      {/* Stats strip */}
      {meta && !loading && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-[var(--border)] bg-[var(--blue-50)] px-4 py-2.5 text-sm text-[var(--blue-700)]">
          <span className="font-semibold">
            {meta.total === 1
              ? t('recruiter.findCandidates.candidatesFound', { count: meta.total })
              : t('recruiter.findCandidates.candidatesFoundPlural', { count: meta.total })}
          </span>
          {meta.total > 0 && (
            <>
              <span className="text-[var(--text-2)]">·</span>
              <span>{t('recruiter.findCandidates.avgMatch', { score: avgScore })}</span>
              <span className="text-[var(--text-2)]">·</span>
              <span className="text-[var(--text-3)]">
                {t('recruiter.findCandidates.passiveCandidatesHint')}
              </span>
            </>
          )}
        </div>
      )}

      <ErrorBanner message={error ?? ''} />

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <CandidateRowSkeleton key={i} />
          ))}
        </div>
      ) : !error && candidates.length === 0 ? (
        <EmptyState
          title={t('emptyStates.noMatchingCandidates.title')}
          description={t('emptyStates.noMatchingCandidates.description')}
          action={
            <button
              type="button"
              onClick={fetchCandidates}
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white"
            >
              <UserCircle className="mr-1.5 inline size-4" />
              {t('recommendations.tryAgain')}
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <CandidateRecommendationRow key={c.resume_id} resume={c} jobId={jobId} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
