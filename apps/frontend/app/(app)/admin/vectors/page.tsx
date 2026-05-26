'use client';

import { useState } from 'react';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';
import {
  indexJobVector,
  indexResumeVector,
  scorePair,
  searchJobsByResumeVector,
  searchResumesByJobVector,
  type HybridScorePairResult,
  type VectorSearchMatch,
} from '@/lib/api/vectors';

function parseVectorInput(value: string, invalidMessage: string): number[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(invalidMessage);
  }
  const numbers = parsed.map((item) => Number(item));
  if (numbers.some((item) => !Number.isFinite(item))) {
    throw new Error(invalidMessage);
  }
  return numbers;
}

export default function AdminVectorsPage() {
  const header = usePageHeader('adminVectors');
  const { t } = useTranslations();
  const [jobId, setJobId] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [vectorInput, setVectorInput] = useState('[0.1, 0.2, 0.3]');
  const [limit, setLimit] = useState('10');
  const [scoreThreshold, setScoreThreshold] = useState('0.5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<VectorSearchMatch[]>([]);
  const [pairScore, setPairScore] = useState<HybridScorePairResult | null>(null);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('errors.vectorOperationFailed')
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      {error ? <ErrorBanner message={error} /> : null}
      {message ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
          {message}
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-sm font-semibold">{t('admin.vectors.sharedInput')}</h2>
        <textarea
          className="min-h-24 w-full rounded-lg border border-[var(--border)] p-3 font-mono text-xs"
          value={vectorInput}
          onChange={(event) => setVectorInput(event.target.value)}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('admin.vectors.jobId')}
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('admin.vectors.resumeId')}
            value={resumeId}
            onChange={(event) => setResumeId(event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('admin.vectors.limit')}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          />
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('admin.vectors.scoreThreshold')}
            value={scoreThreshold}
            onChange={(event) => setScoreThreshold(event.target.value)}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-sm font-semibold">{t('admin.vectors.indexVectors')}</h2>
          <button
            className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
            disabled={busy || !jobId.trim()}
            onClick={() =>
              runAction(async () => {
                const result = await indexJobVector(jobId.trim(), {
                  vector: parseVectorInput(vectorInput, t('errors.vectorMustBeArray')),
                });
                setMessage(t('admin.vectors.messages.jobIndexed', { id: result.qdrantId }));
              })
            }
            type="button"
          >
            {t('admin.vectors.indexJobVector')}
          </button>
          <button
            className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
            disabled={busy || !resumeId.trim()}
            onClick={() =>
              runAction(async () => {
                const result = await indexResumeVector(resumeId.trim(), {
                  vector: parseVectorInput(vectorInput, t('errors.vectorMustBeArray')),
                });
                setMessage(t('admin.vectors.messages.resumeIndexed', { id: result.qdrantId }));
              })
            }
            type="button"
          >
            {t('admin.vectors.indexResumeVector')}
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-sm font-semibold">{t('admin.vectors.searchScore')}</h2>
          <button
            className="w-full rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                const results = await searchResumesByJobVector({
                  vector: parseVectorInput(vectorInput, t('errors.vectorMustBeArray')),
                  limit: Number(limit) || 10,
                  scoreThreshold: Number(scoreThreshold) || undefined,
                });
                setSearchResults(results);
                setMessage(
                  t('admin.vectors.messages.foundResumeMatches', { count: results.length })
                );
              })
            }
            type="button"
          >
            {t('admin.vectors.searchResumes')}
          </button>
          <button
            className="w-full rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                const results = await searchJobsByResumeVector({
                  vector: parseVectorInput(vectorInput, t('errors.vectorMustBeArray')),
                  limit: Number(limit) || 10,
                  scoreThreshold: Number(scoreThreshold) || undefined,
                });
                setSearchResults(results);
                setMessage(t('admin.vectors.messages.foundJobMatches', { count: results.length }));
              })
            }
            type="button"
          >
            {t('admin.vectors.searchJobs')}
          </button>
          <button
            className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
            disabled={busy || !jobId.trim() || !resumeId.trim()}
            onClick={() =>
              runAction(async () => {
                const result = await scorePair({
                  job_id: jobId.trim(),
                  resume_id: resumeId.trim(),
                });
                setPairScore(result);
                setMessage(t('admin.vectors.messages.hybridScoreComputed'));
              })
            }
            type="button"
          >
            {t('admin.vectors.scorePair')}
          </button>
        </div>
      </section>

      {pairScore ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5 text-sm">
          <h2 className="font-semibold">{t('admin.vectors.pairScore')}</h2>
          <p className="mt-2">
            {t('scores.semantic')}: {(pairScore.semantic_score * 100).toFixed(1)}%
          </p>
          <p>
            {t('scores.keyword')}: {(pairScore.keyword_score * 100).toFixed(1)}%
          </p>
          <p>
            {t('scores.hybrid')}: {(pairScore.hybrid_score * 100).toFixed(1)}%
          </p>
        </section>
      ) : null}

      {searchResults.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-sm font-semibold">{t('admin.vectors.searchResults')}</h2>
          <div className="mt-3 space-y-2">
            {searchResults.map((match) => (
              <div
                key={match.id}
                className="grid gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm md:grid-cols-[1fr_auto]"
              >
                <span className="font-mono text-xs">{match.id}</span>
                <span className="font-semibold text-[var(--blue-700)]">
                  {(match.score * 100).toFixed(1)}%
                </span>
                {match.payload ? (
                  <pre className="col-span-full mt-2 max-h-24 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-[var(--text-2)]">
                    {JSON.stringify(match.payload, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
