'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader, ErrorBanner, AiScoreWidget } from '@/components/ui';
import { GenerationModeBadge } from '@/components/ui/GenerationModeBadge';
import {
  matchResumeToJd,
  uploadJobDescriptions,
  previewImproveResume,
  confirmImproveResume,
  improveResume,
  fetchJobDescription,
  fetchResumeList,
  type JdMatchResult,
  type ResumeListItem,
} from '@/lib/api';
import {
  analyzeResume,
  generateEnhancements,
  applyEnhancements,
  regenerateItems,
  applyRegeneratedItems,
  type EnrichmentQuestion,
  type EnhancedDescription,
  type RegeneratedItem,
} from '@/lib/api/enrichment';
import { fetchLanguageConfig, type SupportedLanguage } from '@/lib/api/config';
import type { ImprovedResult } from '@/components/common/resume_previewer_context';
import type { ResumeData } from '@/components/dashboard/resume-component';

type JdWizardStep = 'match' | 'preview' | 'confirm';

function extractSuggestions(payload: ImprovedResult): string[] {
  const p = payload as unknown as Record<string, unknown>;
  const improvements =
    (p.improvements as Array<{ suggestion: string }> | undefined) ??
    (payload.data && typeof payload.data === 'object' && 'improvements' in payload.data
      ? (payload.data.improvements as Array<{ suggestion: string }>)
      : undefined) ??
    [];
  return improvements
    .map((item) => (item as { suggestion?: string }).suggestion || '')
    .filter(Boolean);
}

function extractGenerationMode(
  payload: ImprovedResult | null
): import('@/lib/types/generation').GenerationMode | null {
  if (!payload) return null;
  const p = payload as unknown as Record<string, unknown>;
  if (p.generation_mode === 'llm' || p.generation_mode === 'template_fallback')
    return p.generation_mode;
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const mode =
    'generation_mode' in data ? (data as { generation_mode?: string }).generation_mode : null;
  if (mode === 'llm' || mode === 'template_fallback') return mode;
  return null;
}

function extractImprovedData(payload: ImprovedResult): ResumeData | undefined {
  const p = payload as unknown as Record<string, unknown>;
  if (p.improved_data) return p.improved_data as ResumeData;
  const data = payload.data;
  if (!data || typeof data !== 'object') return undefined;
  if ('resume_preview' in data && (data as Record<string, unknown>).resume_preview)
    return (data as Record<string, unknown>).resume_preview as ResumeData;
  if ('improved_data' in data && (data as Record<string, unknown>).improved_data)
    return (data as Record<string, unknown>).improved_data as ResumeData;
  if ('resume' in data && (data as Record<string, unknown>).resume)
    return (data as Record<string, unknown>).resume as ResumeData;
  return data as unknown as ResumeData;
}

function extractImprovements(payload: ImprovedResult) {
  const p = payload as unknown as Record<string, unknown>;
  if (p.improvements) return p.improvements as Array<{ suggestion: string }>;
  const data = payload.data;
  if (data && typeof data === 'object' && 'improvements' in data) {
    return ((data as unknown as Record<string, unknown>).improvements ?? []) as Array<{
      suggestion: string;
    }>;
  }
  return [];
}

function renderHighlights(segments: Array<{ text: string; type: string }>) {
  return segments.map((segment, index) => (
    <span
      key={`${segment.text}-${index}`}
      className={
        segment.type === 'matched'
          ? 'bg-green-100 text-green-900'
          : segment.type === 'missing'
            ? 'bg-red-100 text-red-900'
            : undefined
      }
    >
      {segment.text}
    </span>
  ));
}

export default function CandidateOptimizePage() {
  const header = usePageHeader('candidateOptimize');
  const { t } = useTranslations();
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [resumeId, setResumeId] = useState('');
  const [tab, setTab] = useState<'jd' | 'enrichment'>('jd');
  const [jdStep, setJdStep] = useState<JdWizardStep>('match');
  const [jobDescription, setJobDescription] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ImprovedResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [match, setMatch] = useState<JdMatchResult | null>(null);
  const [questions, setQuestions] = useState<EnrichmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [enhancements, setEnhancements] = useState<EnhancedDescription[]>([]);
  const [regenerateInstruction, setRegenerateInstruction] = useState('');
  const [regeneratedItems, setRegeneratedItems] = useState<RegeneratedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState<SupportedLanguage>('en');
  const [showAlgorithmInfo, setShowAlgorithmInfo] = useState(false);

  const selectedResume = resumes.find((item) => item.resume_id === resumeId);

  const loadResumes = useCallback(async () => {
    try {
      const loaded = await fetchResumeList(true);
      setResumes(loaded);
      setResumeId((current) => {
        if (current && loaded.some((item) => item.resume_id === current)) return current;
        return loaded.find((item) => item.is_master)?.resume_id || loaded[0]?.resume_id || '';
      });
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.loadResumes'));
    }
  }, [t]);

  useEffect(() => {
    loadResumes();
    let active = true;
    fetchLanguageConfig()
      .then((config) => {
        if (active) setOutputLanguage(config.content_language || 'en');
      })
      .catch(() => {
        if (active) setOutputLanguage('en');
      });
    return () => {
      active = false;
    };
  }, [loadResumes]);

  useEffect(() => {
    if (!resumeId) return;
    const resume = resumes.find((item) => item.resume_id === resumeId);
    if (!resume?.parent_id) return;

    let active = true;
    fetchJobDescription(resumeId)
      .then((payload) => {
        if (!active) return;
        if (payload.content) setJobDescription(payload.content);
        if (payload.job_id) setJobId(payload.job_id);
      })
      .catch(() => {
        if (active) return;
      });
    return () => {
      active = false;
    };
  }, [resumeId, resumes]);

  function resetJdFlow() {
    setJdStep('match');
    setMatch(null);
    setPreviewResult(null);
    setSuggestions([]);
    setJobId(null);
    setSuccess(null);
  }

  async function handleMatch() {
    if (!resumeId) {
      setError(t('errors.needResume'));
      return;
    }
    if (!jobDescription.trim()) {
      setError(t('errors.needJd'));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setMatch(null);
    setPreviewResult(null);
    setSuggestions([]);
    setJobId(null);

    try {
      const matchPayload = await matchResumeToJd(resumeId, {
        job_description: jobDescription,
        include_highlights: true,
      });
      setMatch(matchPayload);
      setJdStep('preview');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.matchFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview() {
    if (!resumeId || !jobDescription.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const uploadedJobId = await uploadJobDescriptions([jobDescription], resumeId);
      setJobId(uploadedJobId);
      const preview = await previewImproveResume(resumeId, uploadedJobId);
      setPreviewResult(preview);
      const nextSuggestions = extractSuggestions(preview);
      setSuggestions(
        nextSuggestions.length ? nextSuggestions : [t('optimize.previewFallbackSuggestion')]
      );
      setJdStep('confirm');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.previewFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmApply() {
    if (!resumeId || !jobId || !previewResult) return;

    const improved_data = extractImprovedData(previewResult);
    if (!improved_data) {
      setError(t('errors.noImprovedData'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const previewData =
        previewResult.data && typeof previewResult.data === 'object' ? previewResult.data : {};
      const result = await confirmImproveResume({
        resume_id: resumeId,
        job_id: jobId,
        improved_data,
        improvements: extractImprovements(previewResult),
        generation_mode: ((previewResult as unknown as Record<string, unknown>).generation_mode ??
          ('generation_mode' in previewData
            ? (previewData as unknown as Record<string, unknown>).generation_mode
            : null)) as import('@/lib/types/generation').GenerationMode | null | undefined,
        llm_metadata: ((previewResult as unknown as Record<string, unknown>).llm_metadata ??
          ('llm_metadata' in previewData
            ? (previewData as unknown as Record<string, unknown>).llm_metadata
            : null)) as import('@/lib/types/generation').LlmMetadata | null | undefined,
      });
      setSuccess(t('optimize.successTailored'));
      const newResumeId = result.data?.resume_id;
      await loadResumes();
      if (newResumeId) {
        setResumeId(newResumeId);
        router.push(`/candidate/resumes/${newResumeId}/builder`);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('errors.applyTailoredFailed')
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDirectly() {
    if (!resumeId || !jobId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await improveResume(resumeId, jobId);
      setPreviewResult(result);
      setSuggestions(extractSuggestions(result));
      setSuccess(t('optimize.successSaved'));
      await loadResumes();
      const newResumeId = result.data?.resume_id;
      if (newResumeId) {
        router.push(`/candidate/resumes/${newResumeId}/builder`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.saveResumeFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function analyzeEnrichment() {
    if (!resumeId) {
      setError(t('errors.needResume'));
      return;
    }

    setEnrichmentLoading(true);
    setError(null);
    setSuccess(null);
    setQuestions([]);
    setEnhancements([]);
    setRegeneratedItems([]);
    try {
      const payload = await analyzeResume(resumeId);
      setQuestions(payload.questions ?? []);
      if (payload.analysis_summary) {
        setSuccess(payload.analysis_summary);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.analyzeFailed'));
    } finally {
      setEnrichmentLoading(false);
    }
  }

  async function handleGenerateEnhancements() {
    if (!resumeId) return;
    setEnrichmentLoading(true);
    setError(null);
    setRegeneratedItems([]);
    try {
      const payload = await generateEnhancements(
        resumeId,
        Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer }))
      );
      setEnhancements(payload.enhancements ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('errors.enhancementsFailed')
      );
    } finally {
      setEnrichmentLoading(false);
    }
  }

  async function handleApplyEnhancements() {
    if (!resumeId || enhancements.length === 0) return;
    setEnrichmentLoading(true);
    setError(null);
    try {
      await applyEnhancements(resumeId, enhancements);
      setSuccess(t('optimize.successEnhancements'));
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('errors.applyEnhancementsFailed')
      );
    } finally {
      setEnrichmentLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!resumeId || enhancements.length === 0 || !regenerateInstruction.trim()) return;
    setEnrichmentLoading(true);
    setError(null);
    try {
      const payload = await regenerateItems({
        resume_id: resumeId,
        items: enhancements.map((item) => ({
          item_id: item.item_id,
          item_type: item.item_type,
          title: item.title,
          current_content: item.enhanced_description,
        })),
        instruction: regenerateInstruction.trim(),
        output_language: outputLanguage,
      });
      setRegeneratedItems(payload.regenerated_items ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.regenerateFailed'));
    } finally {
      setEnrichmentLoading(false);
    }
  }

  async function handleApplyRegenerated() {
    if (!resumeId || regeneratedItems.length === 0) return;
    setEnrichmentLoading(true);
    setError(null);
    try {
      await applyRegeneratedItems(resumeId, regeneratedItems);
      setSuccess(t('optimize.successRegenerated'));
      setRegeneratedItems([]);
      setRegenerateInstruction('');
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('errors.applyRegeneratedFailed')
      );
    } finally {
      setEnrichmentLoading(false);
    }
  }

  const jdSteps: { key: JdWizardStep; label: string }[] = [
    { key: 'match', label: t('optimize.stepMatch') },
    { key: 'preview', label: t('optimize.stepPreview') },
    { key: 'confirm', label: t('optimize.stepConfirm') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      {error ? <ErrorBanner message={error} /> : null}
      {success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {success}
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          className={`rounded-lg px-3 py-2 text-sm ${tab === 'jd' ? 'bg-[var(--blue-700)] text-white' : 'border border-[var(--border)] bg-white'}`}
          onClick={() => {
            setTab('jd');
            setError(null);
            setSuccess(null);
          }}
          type="button"
        >
          {t('optimize.jdMatchTab')}
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm ${tab === 'enrichment' ? 'bg-[var(--blue-700)] text-white' : 'border border-[var(--border)] bg-white'}`}
          onClick={() => {
            setTab('enrichment');
            setError(null);
            setSuccess(null);
            setQuestions([]);
            setAnswers({});
            setEnhancements([]);
            setRegeneratedItems([]);
          }}
          type="button"
        >
          {t('optimize.enrichmentTab')}
        </button>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <select
          className="mb-3 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          value={resumeId}
          onChange={(event) => {
            setResumeId(event.target.value);
            resetJdFlow();
            setQuestions([]);
            setAnswers({});
            setEnhancements([]);
            setRegeneratedItems([]);
            setError(null);
            setSuccess(null);
          }}
        >
          {resumes.map((resume) => (
            <option key={resume.resume_id} value={resume.resume_id}>
              {resume.title || resume.resume_id}
              {resume.is_master ? t('optimize.masterSuffix') : ''}
            </option>
          ))}
        </select>
        {selectedResume?.parent_id ? (
          <p className="mb-3 text-xs text-[var(--text-3)]">{t('optimize.linkedJdHint')}</p>
        ) : null}
        <p className="mb-3 text-xs text-[var(--text-3)]">
          {t('optimize.aiLanguage', { language: outputLanguage.toUpperCase() })}
        </p>
        {tab === 'jd' ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {jdSteps.map((step, index) => (
                <span
                  key={step.key}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    jdStep === step.key
                      ? 'bg-[var(--blue-700)] text-white'
                      : 'bg-[var(--blue-50)] text-[var(--blue-700)]'
                  }`}
                >
                  {index + 1}. {step.label}
                </span>
              ))}
            </div>
            <textarea
              className="min-h-32 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
              placeholder={t('optimize.jdPlaceholder')}
              value={jobDescription}
              onChange={(event) => {
                setJobDescription(event.target.value);
                if (jdStep !== 'match') resetJdFlow();
              }}
            />
            {jdStep === 'match' ? (
              <button
                className="mt-3 rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
                onClick={handleMatch}
                disabled={loading}
                type="button"
              >
                {loading ? t('optimize.matching') : t('optimize.runMatch')}
              </button>
            ) : null}
            {jdStep === 'preview' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                  onClick={() => setJdStep('match')}
                  type="button"
                >
                  {t('common.back')}
                </button>
                <button
                  className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
                  onClick={handlePreview}
                  disabled={loading}
                  type="button"
                >
                  {loading ? t('optimize.previewing') : t('optimize.generatePreview')}
                </button>
              </div>
            ) : null}
            {jdStep === 'confirm' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                  onClick={() => setJdStep('preview')}
                  type="button"
                >
                  {t('common.back')}
                </button>
                <button
                  className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
                  onClick={handleConfirmApply}
                  disabled={loading || !jobId || !previewResult}
                  type="button"
                >
                  {loading ? t('optimize.applying') : t('optimize.applyTailored')}
                </button>
                <button
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
                  onClick={handleSaveDirectly}
                  disabled={loading || !jobId}
                  type="button"
                >
                  {t('optimize.saveDirectly')}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-4">
            <button
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
              onClick={analyzeEnrichment}
              disabled={enrichmentLoading}
              type="button"
            >
              {enrichmentLoading ? t('optimize.working') : t('optimize.analyzeResume')}
            </button>
            {questions.map((question) => (
              <label key={question.question_id} className="block text-sm font-medium">
                {question.question}
                <textarea
                  className="mt-2 min-h-20 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
                  placeholder={question.placeholder}
                  value={answers[question.question_id] ?? ''}
                  onChange={(event) =>
                    setAnswers({ ...answers, [question.question_id]: event.target.value })
                  }
                />
              </label>
            ))}
            {questions.length > 0 ? (
              <button
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                onClick={handleGenerateEnhancements}
                disabled={enrichmentLoading}
                type="button"
              >
                {t('optimize.generateBullets')}
              </button>
            ) : null}
          </div>
        )}
      </div>
      {suggestions.length > 0 && tab === 'jd' ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('optimize.aiSuggestions')}</h3>
            <GenerationModeBadge mode={extractGenerationMode(previewResult)} />
          </div>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-2)]">
            {suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {match && tab === 'jd' ? (
        <div className="space-y-4">
          {/* Score Widget */}
          <AiScoreWidget
            semanticScore={(match.semantic_score ?? match.match_percentage) / 100}
            keywordScore={(match.keyword_score ?? match.match_percentage) / 100}
            hybridScore={match.match_percentage / 100}
            matchedKeywords={match.matched_keywords}
            missingKeywords={match.missing_keywords}
          />

          {/* Recommendations */}
          {match.recommendations?.length ? (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <h3 className="text-sm font-semibold">{t('optimize.aiSuggestions')}</h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text-2)]">
                {match.recommendations.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-[var(--warning)]">💡</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Highlighted Comparison */}
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <h3 className="text-sm font-semibold">{t('optimize.highlights')}</h3>
            <div className="mt-2 mb-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-3)]">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-green-100" />
                {t('optimize.highlightLegendMatched')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-red-100" />
                {t('optimize.highlightLegendMissing')}
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                  📄 {t('optimize.jdHighlightsTitle')}
                </p>
                <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] p-3 text-xs leading-6">
                  {renderHighlights(match.jd_highlights)}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                  📋 {t('optimize.resumeHighlightsTitle')}
                </p>
                <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] p-3 text-xs leading-6">
                  {renderHighlights(match.resume_highlights)}
                </div>
              </div>
            </div>
          </section>

          {/* Algorithm Info (collapsible) */}
          <section className="rounded-2xl border border-[var(--border)] bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold hover:bg-[var(--blue-50)] transition-colors rounded-2xl"
              onClick={() => setShowAlgorithmInfo(!showAlgorithmInfo)}
            >
              <span>🧪 {t('optimize.algorithmInfo')}</span>
              <span className="text-[var(--text-3)] text-xs">{showAlgorithmInfo ? '▲' : '▼'}</span>
            </button>
            {showAlgorithmInfo && (
              <div className="border-t border-[var(--border)] px-4 pb-4 pt-3 space-y-3 text-sm text-[var(--text-2)]">
                <p className="text-xs text-[var(--text-3)]">{t('optimize.algorithmInfoDesc')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-1">
                      {t('optimize.scoreBreakdown')}
                    </p>
                    <p className="font-mono text-xs">
                      {match.score_method === 'hybrid'
                        ? t('optimize.scoreMethodHybrid', {
                            semantic: String(Math.round((match.score_weights?.semantic ?? 0.65) * 100)),
                            keyword: String(Math.round((match.score_weights?.keyword ?? 0.35) * 100)),
                          })
                        : t('optimize.scoreMethodKeyword')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] mb-1">
                      {t('optimize.scoreBreakdown')}
                    </p>
                    <ul className="space-y-1 font-mono text-xs">
                      <li>Semantic: {match.semantic_score ?? '—'}% ({t('optimize.semanticExplain')})</li>
                      <li>Keyword: {match.keyword_score ?? '—'}% ({t('optimize.keywordExplain')})</li>
                      {match.hybrid_score != null && (
                        <li className="font-semibold">Hybrid: {match.hybrid_score}%</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
      {enhancements.length > 0 && tab === 'enrichment' ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <h3 className="text-sm font-semibold">{t('optimize.generatedBullets')}</h3>
          <div className="mt-3 space-y-3">
            {enhancements.map((item) => (
              <div key={item.item_id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-medium">{item.title || item.item_id}</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--text-2)]">
                  {item.enhanced_description.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium">
              {t('optimize.regenerateLabel')}
              <textarea
                className="mt-2 min-h-20 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
                placeholder={t('optimize.regeneratePlaceholder')}
                value={regenerateInstruction}
                onChange={(event) => setRegenerateInstruction(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
                onClick={handleRegenerate}
                disabled={enrichmentLoading || !regenerateInstruction.trim()}
                type="button"
              >
                {t('optimize.regenerateSelected')}
              </button>
              <button
                className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
                onClick={handleApplyEnhancements}
                disabled={enrichmentLoading}
                type="button"
              >
                {t('optimize.applyToResume')}
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {regeneratedItems.length > 0 && tab === 'enrichment' ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <h3 className="text-sm font-semibold">{t('optimize.regeneratedContent')}</h3>
          <div className="mt-3 space-y-3">
            {regeneratedItems.map((item) => (
              <div key={item.item_id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-medium">{item.title}</p>
                {item.diff_summary ? (
                  <p className="mt-1 text-xs text-[var(--text-3)]">{item.diff_summary}</p>
                ) : null}
                <ul className="mt-2 space-y-1 text-sm text-[var(--text-2)]">
                  {item.new_content.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button
            className="mt-4 rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
            onClick={handleApplyRegenerated}
            disabled={enrichmentLoading}
            type="button"
          >
            {t('optimize.applyRegenerated')}
          </button>
        </section>
      ) : null}
      {resumeId ? (
        <p className="text-xs text-[var(--text-3)]">
          <Link className="text-[var(--blue-700)]" href={`/candidate/resumes/${resumeId}/builder`}>
            {t('optimize.openBuilder')}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
