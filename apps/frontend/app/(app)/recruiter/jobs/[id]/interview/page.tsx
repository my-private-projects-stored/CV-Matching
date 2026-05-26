'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Brain,
  Briefcase,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Code2,
  FolderOpen,
  Loader2,
  MessageSquare,
  RefreshCw,
  Tag,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { GenerationModeBadge } from '@/components/ui/GenerationModeBadge';
import { generateInterviewQuestions, type InterviewQuestionsResult, type QuestionGroup } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Group config ──────────────────────────────────────────────────────────────

const GROUP_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  technical:  { color: 'var(--blue-700)',  icon: Code2 },
  experience: { color: '#7c3aed',          icon: Briefcase },
  project:    { color: 'var(--info)',      icon: FolderOpen },
  behavioral: { color: 'var(--warning)',   icon: Brain },
  closing:    { color: '#64748b',          icon: CheckCircle },
};

// ── Language toggle ───────────────────────────────────────────────────────────

function LanguageToggle({
  value,
  onChange,
}: {
  value: 'en' | 'vi';
  onChange: (v: 'en' | 'vi') => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-[#1e293b]/30 p-1">
      {(['en', 'vi'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={cn(
            'rounded-md px-3 py-1 text-sm font-semibold transition',
            value === lang
              ? 'bg-[var(--blue-700)] text-white shadow'
              : 'text-white/60 hover:text-white'
          )}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ── Question Item ─────────────────────────────────────────────────────────────

function QuestionItem({
  question,
  index,
  t,
}: {
  question: { id: string; question: string; focus_skill?: string | null };
  index: number;
  t: (key: string) => string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(question.question).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg p-3 transition hover:bg-[var(--surface-muted)]">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[10px] font-bold text-[var(--blue-700)]">
        {index + 1}
      </span>
      <div className="flex-1 space-y-1.5">
        <p className="text-sm text-[var(--text-1)]">{question.question}</p>
        {question.focus_skill && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--blue-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--blue-700)]">
            <Tag className="size-2.5" />
            {question.focus_skill}
          </span>
        )}
      </div>
      <button
        type="button"
        title={t('recruiter.interview.copyQuestion')}
        onClick={handleCopy}
        className="ml-2 shrink-0 rounded p-1 opacity-0 transition hover:bg-[var(--border)] group-hover:opacity-100"
      >
        {copied ? (
          <CheckCircle className="size-3.5 text-[var(--success)]" />
        ) : (
          <ClipboardCopy className="size-3.5 text-[var(--text-3)]" />
        )}
      </button>
    </li>
  );
}

// ── Question Group Accordion ──────────────────────────────────────────────────

function QuestionGroupAccordion({
  group,
  t,
}: {
  group: QuestionGroup;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = useState(group.group === 'technical');
  const cfg = GROUP_CONFIG[group.group] ?? { color: '#64748b', icon: MessageSquare };
  const Icon = cfg.icon;

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderLeftWidth: 3, borderLeftColor: cfg.color }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 transition hover:bg-[var(--surface-muted)]"
      >
        <div className="flex items-center gap-2">
          <Icon className="size-4" style={{ color: cfg.color }} />
          <span className="font-semibold text-[var(--text-1)]">{group.label}</span>
          <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-2)]">
            {t('recruiter.interview.questionsInGroup', { count: group.questions.length })}
          </span>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-[var(--text-3)]" />
        ) : (
          <ChevronDown className="size-4 text-[var(--text-3)]" />
        )}
      </button>
      {open && (
        <div className="border-t border-[var(--border)] bg-white px-2 pb-2">
          {group.description && (
            <p className="px-3 pb-2 pt-3 text-xs text-[var(--text-3)]">{group.description}</p>
          )}
          <ul className="space-y-1">
            {group.questions.map((q, i) => (
              <QuestionItem key={q.id} question={q} index={i} t={t} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Copy All ──────────────────────────────────────────────────────────────────

function copyAllQuestions(result: InterviewQuestionsResult, t: (key: string, params?: Record<string, string | number>) => string) {
  const lines: string[] = [t('recruiter.interview.copyAllHeader', { name: result.candidate_name }), ''];
  for (const group of result.question_groups) {
    lines.push(`## ${group.label}`);
    group.questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question}`);
    });
    lines.push('');
  }
  navigator.clipboard.writeText(lines.join('\n'));
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InterviewQuestionsPage() {
  const header = usePageHeader('recruiterInterview');
  const { t } = useTranslations();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const jobId = params.id;
  const resumeId = searchParams.get('resume_id') ?? '';

  const [language, setLanguage] = useState<'en' | 'vi'>('en');
  const [result, setResult] = useState<InterviewQuestionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    if (!resumeId) return;
    setLoading(true);
    setError(null);
    const res = await generateInterviewQuestions(resumeId, jobId || undefined, language);
    if ('error' in res) {
      setError(res.error);
      setResult(null);
    } else {
      setResult(res.data);
    }
    setLoading(false);
  }, [resumeId, jobId, language]);

  useEffect(() => { generate(); }, [generate]);

  function handleCopyAll() {
    if (!result) return;
    copyAllQuestions(result, t);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full gap-0">
      {/* ── LEFT PANEL ── */}
      <aside className="hidden w-72 shrink-0 flex-col gap-6 bg-[#1e293b] p-6 text-white md:flex">
        <Link
          href={`/recruiter/jobs/${jobId}/candidates`}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {t('recruiter.interview.backToCandidates')}
        </Link>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            {t('recruiter.interview.candidateLabel')}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--blue-700)] text-sm font-bold">
              {result
                ? result.candidate_name
                    .split(' ')
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join('')
                : <User className="size-5" />}
            </div>
            <div>
              <p className="font-semibold">{result?.candidate_name ?? '—'}</p>
              <p className="text-xs text-white/60">{result?.candidate_title ?? ''}</p>
            </div>
          </div>
        </div>

        {result?.job_title && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              {t('recruiter.interview.jobContext')}
            </p>
            <p className="mt-2 text-sm text-white/80">📋 {result.job_title}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-white/40">
            {t('recruiter.interview.language')}
          </p>
          <LanguageToggle value={language} onChange={setLanguage} />
        </div>

        {result && (
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              {t('recruiter.interview.summary')}
            </p>
            <p className="mt-2 text-2xl font-bold">{result.total_questions}</p>
            <p className="text-xs text-white/60">
              {t('recruiter.interview.questionsInGroups', {
                count: result.question_groups.length,
              })}
            </p>
            {result.generation_mode && (
              <div className="mt-3">
                <GenerationModeBadge mode={result.generation_mode} />
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={generate}
          className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          {t('recruiter.interview.regenerate')}
        </button>
      </aside>

      {/* ── RIGHT PANEL ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {/* Mobile back button */}
          <Link
            href={`/recruiter/jobs/${jobId}/candidates`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--blue-700)] md:hidden"
          >
            <ArrowLeft className="size-4" />
            {t('common.back')}
          </Link>

          <PageHeader
            title={header.title}
            subtitle={
              result
                ? t('recruiter.interview.subtitleGenerated', {
                    count: result.total_questions,
                    date: new Date(result.generated_at).toLocaleString(),
                  })
                : t('recruiter.interview.subtitleDefault')
            }
          />

          <ErrorBanner message={error ?? ''} />

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--text-2)]">
              <Loader2 className="size-8 animate-spin text-[var(--blue-700)]" />
              <p className="text-sm">{t('recruiter.interview.generating')}</p>
            </div>
          )}

          {!loading && result && (
            <div className="mt-6 space-y-3">
              {result.question_groups.map((group) => (
                <QuestionGroupAccordion key={group.group} group={group} t={t} />
              ))}
            </div>
          )}

          {!loading && !result && !error && (
            <div className="py-20 text-center text-[var(--text-3)]">
              <MessageSquare className="mx-auto mb-3 size-10 opacity-40" />
              <p className="text-sm">{t('recruiter.interview.noResumeId')}</p>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        {result && !loading && (
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-white px-6 py-3">
            <p className="text-sm text-[var(--text-2)]">
              {t('recruiter.interview.footerSummary', {
                count: result.total_questions,
                lang: result.language.toUpperCase(),
              })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyAll}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:border-[var(--blue-700)] hover:text-[var(--blue-700)]"
              >
                {copied ? (
                  <CheckCircle className="size-4 text-[var(--success)]" />
                ) : (
                  <ClipboardCopy className="size-4" />
                )}
                {copied
                  ? t('recruiter.interview.copied')
                  : t('recruiter.interview.copyAll', { count: result.total_questions })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
