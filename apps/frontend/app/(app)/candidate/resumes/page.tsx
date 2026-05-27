'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader, EmptyState, ErrorBanner, SkeletonRow } from '@/components/ui';
import {
  fetchResumeList,
  createBlankResume,
  renameResume,
  retryProcessing,
  deleteResume,
  setResumeAsMaster,
  downloadOriginalResumeFile,
  getUploadUrl,
  type ResumeListItem,
} from '@/lib/api';
import { apiFetch } from '@/lib/api/client';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function ResumeTitleEditor({
  resume,
  disabled,
  onRenamed,
}: {
  resume: ResumeListItem;
  disabled: boolean;
  onRenamed: (resumeId: string, title: string) => void;
}) {
  const { t } = useTranslations();
  const defaultTitle = t('resumes.defaultTitle');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(resume.title || defaultTitle);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(resume.title || defaultTitle);
  }, [resume.title, resume.resume_id, defaultTitle]);

  async function saveTitle() {
    const nextTitle = title.trim() || defaultTitle;
    setSaving(true);
    try {
      await renameResume(resume.resume_id, nextTitle);
      onRenamed(resume.resume_id, nextTitle);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-lg border border-[var(--border)] px-2 py-1 text-sm"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void saveTitle();
            if (event.key === 'Escape') {
              setTitle(resume.title || defaultTitle);
              setEditing(false);
            }
          }}
          disabled={disabled || saving}
          autoFocus
        />
        <button
          type="button"
          className="text-xs text-[var(--blue-700)]"
          onClick={() => void saveTitle()}
          disabled={disabled || saving}
        >
          {t('common.save')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <p className="text-sm font-semibold">{resume.title || defaultTitle}</p>
      <button
        type="button"
        className="text-xs text-[var(--text-3)] hover:text-[var(--blue-700)]"
        onClick={() => setEditing(true)}
        disabled={disabled}
        aria-label={t('resumes.renameAria')}
        title={t('resumes.renameTitle')}
      >
        ✎
      </button>
    </div>
  );
}

function ResumeCard({
  resume,
  busy,
  onReload,
  onError,
}: {
  resume: ResumeListItem;
  busy: boolean;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const { t } = useTranslations();
  const defaultTitle = t('resumes.defaultTitle');
  const [localTitle, setLocalTitle] = useState(resume.title || defaultTitle);

  useEffect(() => {
    setLocalTitle(resume.title || defaultTitle);
  }, [resume.title, defaultTitle]);

  async function handleSetMaster() {
    try {
      await setResumeAsMaster(resume.resume_id);
      await onReload();
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : t('errors.setMasterResume'));
    }
  }

  async function handleDelete() {
    try {
      await deleteResume(resume.resume_id);
      await onReload();
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : t('errors.deleteResume'));
    }
  }

  async function handleRetry() {
    try {
      await retryProcessing(resume.resume_id);
      await onReload();
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : t('errors.retryProcessing'));
    }
  }

  async function handleDownload() {
    try {
      const blob = await downloadOriginalResumeFile(resume.resume_id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resume.filename || localTitle || 'resume';
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : t('errors.downloadResume'));
    }
  }

  const displayResume = { ...resume, title: localTitle };

  const isProcessing = resume.processing_status === 'processing';

  return (
    <div
      className={`card-hover rounded-2xl border bg-white p-4 ${
        resume.is_master ? 'border-[var(--gold-border)]' : 'border-[var(--border)]'
      } ${isProcessing ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <ResumeTitleEditor
          resume={displayResume}
          disabled={busy || isProcessing}
          onRenamed={(resumeId, title) => {
            if (resumeId === resume.resume_id) setLocalTitle(title);
          }}
        />
        {resume.is_master ? (
          <span className="shrink-0 rounded-full bg-[var(--gold-dim)] px-2 py-1 text-xs text-[var(--gold)]">
            {t('resumes.masterBadge')}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="text-xs text-[var(--text-2)]">{formatDate(resume.updated_at)}</p>
        {isProcessing ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            {t('resumes.statusProcessing')}
          </span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              resume.processing_status === 'ready'
                ? 'bg-green-50 text-green-700'
                : resume.processing_status === 'failed'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-[var(--blue-50)] text-[var(--blue-700)]'
            }`}
          >
            {resume.processing_status}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--blue-700)]">
        <Link href={`/candidate/resumes/${resume.resume_id}/builder`}>{t('common.edit')}</Link>
        <Link href={`/candidate/resumes/${resume.resume_id}/history`}>{t('resumes.history')}</Link>
        <button type="button" onClick={() => void handleDownload()} disabled={busy || isProcessing}>
          {t('common.download')}
        </button>
        {!resume.is_master ? (
          <button
            type="button"
            onClick={() => void handleSetMaster()}
            disabled={busy || isProcessing}
          >
            {t('resumes.setAsMaster')}
          </button>
        ) : null}
        {resume.processing_status === 'failed' ? (
          <button type="button" onClick={() => void handleRetry()} disabled={busy}>
            {t('common.retry')}
          </button>
        ) : null}
        <button
          type="button"
          className="text-[var(--danger)]"
          onClick={() => void handleDelete()}
          disabled={busy}
        >
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

export default function CandidateResumesPage() {
  const header = usePageHeader('candidateResumes');
  const { t } = useTranslations();
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if any resume is still being processed
  function hasProcessingResumes(list: ResumeListItem[]) {
    return list.some((r) => r.processing_status === 'processing');
  }

  // Stop the polling interval
  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function loadResumes(silent = false) {
    if (!silent) setLoading(true);
    try {
      const loaded = await fetchResumeList(true);
      setResumes(loaded);
      setError(null);

      // If any resumes are still processing, start/continue polling
      if (hasProcessingResumes(loaded)) {
        startPolling();
      } else {
        stopPolling();
      }
      return loaded;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.loadResumes'));
      setResumes([]);
      stopPolling();
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Start polling every 3 seconds until all resumes are done processing
  function startPolling() {
    stopPolling();
    pollTimerRef.current = setInterval(() => {
      void loadResumes(true);
    }, 3000);
  }

  useEffect(() => {
    void loadResumes();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadResume(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set('file', file);

    try {
      const response = await apiFetch(getUploadUrl(), { method: 'POST', body: form });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      // Reload immediately — the new resume will show with 'processing' status
      await loadResumes();
      // Start polling to update status once LLM parsing completes in background
      startPolling();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('errors.uploadResume'));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleCreateBlank() {
    setBusy(true);
    setError(null);
    try {
      const created = await createBlankResume({ title: t('resumes.untitled') });
      router.push(`/candidate/resumes/${created.resume_id}/builder`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.createResume'));
      setBusy(false);
    }
  }

  const sortedResumes = useMemo(() => {
    return [...resumes].sort((a, b) => {
      if (a.is_master !== b.is_master) return a.is_master ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [resumes]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={header.title}
        action={
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadResume(file);
              }}
            />
            <button
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
              onClick={() => void handleCreateBlank()}
              disabled={busy}
              type="button"
            >
              {t('resumes.createBlank')}
            </button>
            <button
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              type="button"
            >
              {t('resumes.upload')}
            </button>
          </div>
        }
      />
      <div
        className={`rounded-2xl border border-dashed bg-white p-6 text-center transition ${
          dragging ? 'border-[var(--blue-700)] bg-[var(--blue-50)]' : 'border-[var(--border)]'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void uploadResume(file);
        }}
      >
        <p className="font-display text-2xl">{t('resumes.dropZoneTitle')}</p>
        <p className="mt-2 text-sm text-[var(--text-2)]">{t('resumes.dropZoneHint')}</p>
        <button
          className="mt-4 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          type="button"
        >
          {t('resumes.chooseFile')}
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && !error && sortedResumes.length === 0 ? (
        <EmptyState
          title={t('emptyStates.noResumes.title')}
          description={t('emptyStates.noResumes.description')}
        />
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!loading
          ? sortedResumes.map((item) => (
              <ResumeCard
                key={item.resume_id}
                resume={item}
                busy={busy}
                onReload={async () => {
                  setBusy(true);
                  await loadResumes();
                  setBusy(false);
                }}
                onError={(message) => setError(message)}
              />
            ))
          : null}
      </div>
    </div>
  );
}
