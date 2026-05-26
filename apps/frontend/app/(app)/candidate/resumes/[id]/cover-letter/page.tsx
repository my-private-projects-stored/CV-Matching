'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader, ErrorBanner, SkeletonCard } from '@/components/ui';
import { GenerationModeBadge } from '@/components/ui/GenerationModeBadge';
import { getOne } from '@/lib/api';
import { fetchFeatureConfig, type FeatureConfig } from '@/lib/api/config';
import {
  generateCoverLetter,
  generateOutreachMessage,
  updateCoverLetter,
  updateOutreachMessage,
  downloadCoverLetterPdf,
  fetchJobDescription,
} from '@/lib/api/resume';
import type { GenerationMode } from '@/lib/types/generation';
import type { Resume } from '@/types';

type Tab = 'cover-letter' | 'outreach';

export default function CoverLetterPage() {
  const header = usePageHeader('candidateCoverLetter');
  const { t } = useTranslations();
  const params = useParams();
  const resumeId = params?.id as string;
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('cover-letter');
  const [jobContext, setJobContext] = useState('');
  const [featureConfig, setFeatureConfig] = useState<FeatureConfig | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [coverLetterMode, setCoverLetterMode] = useState<GenerationMode | null>(null);
  const [outreachMode, setOutreachMode] = useState<GenerationMode | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOne<Resume>('resumes', resumeId).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
      } else {
        const loaded = res.data ?? null;
        setResume(loaded);
        setCoverLetter(loaded?.coverLetter || '');
        setOutreachMessage(loaded?.outreachMessage || '');
      }
      setLoading(false);
    });
    fetchJobDescription(resumeId)
      .then((jd) => {
        if (active && jd.content) setJobContext(jd.content);
      })
      .catch(() => undefined);
    fetchFeatureConfig()
      .then((features) => {
        if (active) setFeatureConfig(features);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [resumeId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      if (tab === 'cover-letter') {
        const result = await generateCoverLetter(resumeId);
        setCoverLetter(result.content);
        setCoverLetterMode(result.generation_mode ?? null);
        setMessage(t('builder.generatedCoverLetter'));
      } else {
        const result = await generateOutreachMessage(resumeId);
        setOutreachMessage(result.content);
        setOutreachMode(result.generation_mode ?? null);
        setMessage(t('builder.generatedOutreach'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generationFailed'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (tab === 'cover-letter') {
        await updateCoverLetter(resumeId, coverLetter);
      } else {
        await updateOutreachMessage(resumeId, outreachMessage);
      }
      setMessage(t('builder.savedSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (tab !== 'cover-letter') return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await downloadCoverLetterPdf(resumeId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resume?.title || 'cover-letter'}-cover-letter.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  }

  const currentContent = tab === 'cover-letter' ? coverLetter : outreachMessage;
  const setCurrentContent = tab === 'cover-letter' ? setCoverLetter : setOutreachMessage;
  const isCoverLetter = tab === 'cover-letter';
  const currentMode = isCoverLetter ? coverLetterMode : outreachMode;
  const generationEnabled = isCoverLetter
    ? featureConfig?.enable_cover_letter !== false
    : featureConfig?.enable_outreach_message !== false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a
          className="text-sm text-[var(--blue-700)]"
          href={`/candidate/resumes/${resumeId}/builder`}
        >
          {t('builder.backToBuilder')}
        </a>
        <span className="text-[var(--text-3)]">|</span>
        <a className="text-sm text-[var(--text-2)]" href="/candidate/resumes">
          {t('builder.myResumes')}
        </a>
      </div>

      <PageHeader
        title={header.title}
        subtitle={
          resume?.title
            ? t('pages.candidateCoverLetter.subtitleFor', { title: resume.title })
            : header.subtitle
        }
      />

      <div className="flex gap-2">
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            isCoverLetter
              ? 'bg-[var(--blue-700)] text-white'
              : 'border border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-gray-50'
          }`}
          onClick={() => {
            setTab('cover-letter');
            setError(null);
            setMessage(null);
          }}
          type="button"
        >
          {t('builder.coverLetterTab')}
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            !isCoverLetter
              ? 'bg-[var(--blue-700)] text-white'
              : 'border border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-gray-50'
          }`}
          onClick={() => {
            setTab('outreach');
            setError(null);
            setMessage(null);
          }}
          type="button"
        >
          {t('builder.outreachTab')}
        </button>
      </div>

      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {message ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
          {message}
        </p>
      ) : null}

      {!loading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                {isCoverLetter ? t('builder.coverLetterLabel') : t('builder.outreachLabel')}
                <GenerationModeBadge mode={currentMode} />
              </label>
              <textarea
                className="mt-3 min-h-[480px] w-full rounded-lg border border-[var(--border)] p-4 text-sm leading-7 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                placeholder={
                  isCoverLetter
                    ? t('builder.coverLetterPlaceholder')
                    : t('builder.outreachPlaceholder')
                }
                value={currentContent}
                onChange={(e) => setCurrentContent(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={handleSave}
                  disabled={saving || !currentContent.trim()}
                  type="button"
                >
                  {saving ? t('builder.saving') : t('common.save')}
                </button>
                {isCoverLetter ? (
                  <button
                    className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                    onClick={handleDownloadPdf}
                    disabled={downloading || !coverLetter.trim()}
                    type="button"
                  >
                    {downloading ? t('builder.downloading') : t('builder.downloadPdf')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <p className="text-sm font-semibold">{t('builder.generateWithAi')}</p>
              <p className="mt-1 text-xs text-[var(--text-2)]">
                {t('builder.generateHint', {
                  type: isCoverLetter
                    ? t('builder.typeCoverLetter')
                    : t('builder.typeOutreach'),
                })}
              </p>
              <textarea
                className="mt-3 min-h-32 w-full rounded-lg border border-[var(--border)] p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                placeholder={t('builder.jdPlaceholder')}
                value={jobContext}
                onChange={(e) => setJobContext(e.target.value)}
              />
              <button
                className="mt-3 w-full rounded-lg bg-[var(--blue-700)] py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
                onClick={handleGenerate}
                disabled={generating || !generationEnabled}
                type="button"
              >
                {generating
                  ? t('builder.generating')
                  : isCoverLetter
                    ? t('builder.generateCoverLetter')
                    : t('builder.generateOutreach')}
              </button>
              {!generationEnabled ? (
                <p className="mt-2 text-xs text-[var(--text-3)]">
                  {isCoverLetter
                    ? t('builder.coverLetterDisabled')
                    : t('builder.outreachDisabled')}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <p className="text-sm font-semibold">{t('builder.tips')}</p>
              <ul className="mt-2 space-y-1.5 text-xs text-[var(--text-2)]">
                {isCoverLetter ? (
                  <>
                    <li>{t('builder.tipCoverLetter1')}</li>
                    <li>{t('builder.tipCoverLetter2')}</li>
                    <li>{t('builder.tipCoverLetter3')}</li>
                    <li>{t('builder.tipCoverLetter4')}</li>
                  </>
                ) : (
                  <>
                    <li>{t('builder.tipOutreach1')}</li>
                    <li>{t('builder.tipOutreach2')}</li>
                    <li>{t('builder.tipOutreach3')}</li>
                    <li>{t('builder.tipOutreach4')}</li>
                  </>
                )}
              </ul>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
