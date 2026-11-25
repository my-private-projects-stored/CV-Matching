'use client';

import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { ErrorBanner, PageHeader } from '@/components/ui';
import {
  generatePracticeInterviewQuestions,
  type PracticeQuestionItem,
} from '@/lib/api/interviews';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

export default function CandidatePracticeInterviewPage() {
  const header = usePageHeader('candidatePracticeInterview');
  const { t, locale } = useTranslations();
  const [jobTitle, setJobTitle] = useState('Backend Node.js Engineer');
  const [skillsInput, setSkillsInput] = useState('Node.js, MongoDB, Redis');
  const [language, setLanguage] = useState<'vi' | 'en'>(locale === 'vi' ? 'vi' : 'en');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [questions, setQuestions] = useState<PracticeQuestionItem[]>([]);
  const [generationMode, setGenerationMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const skills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await generatePracticeInterviewQuestions({
        jobTitle,
        skills,
        language,
      });
      setQuestions(res.questionSet.questions ?? []);
      setGenerationMode(res.generation_mode);
      setCategoryFilter('all');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadInterview'));
    } finally {
      setLoading(false);
    }
  }

  const categories = ['all', ...Array.from(new Set(questions.map((q) => q.category)))];
  const visibleQuestions =
    categoryFilter === 'all' ? questions : questions.filter((q) => q.category === categoryFilter);

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />

      <form
        onSubmit={handleGenerate}
        className="grid gap-4 rounded-2xl border border-[var(--border)] bg-white p-5 md:grid-cols-4"
      >
        <div>
          <label className="text-xs font-semibold text-[var(--text-2)]">
            {t('practiceInterview.jobTitle')}
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-[var(--text-2)]">
            {t('practiceInterview.skills')}
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <select
            className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'vi' | 'en')}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--blue-700)] px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Sparkles className="size-3.5" />
            {loading ? t('common.loading') : t('practiceInterview.generate')}
          </button>
        </div>
      </form>

      {error ? <ErrorBanner message={error} /> : null}

      {questions.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    categoryFilter === cat
                      ? 'border-[var(--blue-700)] bg-[var(--blue-700)] text-white'
                      : 'border-[var(--border)] bg-white text-[var(--text-2)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {generationMode ? (
              <span className="rounded-full bg-[var(--blue-50)] px-2.5 py-1 font-mono text-[11px] text-[var(--blue-700)]">
                mode: {generationMode}
              </span>
            ) : null}
          </div>

          <div className="space-y-3">
            {visibleQuestions.map((item, idx) => (
              <div
                key={`${item.category}-${idx}`}
                className="rounded-2xl border border-[var(--border)] bg-white p-5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-full bg-[var(--blue-50)] px-2.5 py-0.5 font-semibold text-[var(--blue-700)]">
                    {item.category}
                  </span>
                  <span className="uppercase text-[var(--text-3)]">{item.difficulty}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-[var(--text-1)]">{item.question}</p>
                {item.expectedSignal ? (
                  <details className="mt-3 rounded-lg bg-[var(--bg)] p-3 text-xs text-[var(--text-2)]">
                    <summary className="cursor-pointer font-semibold text-[var(--blue-700)]">
                      {t('practiceInterview.starHint')}
                    </summary>
                    <p className="mt-1.5">{item.expectedSignal}</p>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
