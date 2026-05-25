'use client';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader, ConfirmDialog, ErrorBanner, SkeletonRow } from '@/components/ui';
import {
  fetchResumeHistory,
  restoreResumeVersion,
  type ResumeListItem,
} from '@/lib/api';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ResumeHistoryPage() {
  const header = usePageHeader('candidateHistory');
  const { t } = useTranslations();
  const params = useParams();
  const resumeId = params?.id as string;
  const [versions, setVersions] = useState<ResumeListItem[]>([]);
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ResumeListItem | null>(null);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await fetchResumeHistory(resumeId);
      setVersions(data.versions ?? []);
      setCurrentResumeId(data.current_resume_id);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.loadHistory'));
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!resumeId) return;
    void loadHistory();
  }, [resumeId]);

  async function handleRestore(versionId: string) {
    setBusy(true);
    setError(null);
    try {
      await restoreResumeVersion(resumeId, versionId);
      setRestoreTarget(null);
      await loadHistory();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('errors.restoreVersion'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <Link className="text-xs text-[var(--blue-700)]" href="/candidate/resumes">
        {t('resumes.backToResumes')}
      </Link>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : null}
      {!loading && !error ? (
        <ol className="relative space-y-4 border-l border-[var(--border)] pl-6">
          {versions.map((version, index) => {
            const isCurrent = version.resume_id === currentResumeId;
            const versionTitle =
              version.title ||
              t('resumes.versionLabel', { number: versions.length - index });
            return (
              <li key={version.resume_id} className="relative">
                <span
                  className={`absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-white ${
                    isCurrent ? 'bg-[var(--blue-700)]' : 'bg-[var(--border)]'
                  }`}
                />
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{versionTitle}</p>
                      <p className="mt-1 text-xs text-[var(--text-2)]">
                        {t('resumes.updated', { date: formatDate(version.updated_at) })}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-3)]">
                        {t('resumes.status', { status: version.processing_status })}
                        {version.restored_from_version_id
                          ? t('resumes.restoredFrom', {
                              versionId: version.restored_from_version_id,
                            })
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link
                        className="text-[var(--blue-700)]"
                        href={`/candidate/resumes/${version.resume_id}/builder`}
                      >
                        {t('resumes.open')}
                      </Link>
                      {!isCurrent ? (
                        <button
                          type="button"
                          className="text-[var(--blue-700)] disabled:opacity-60"
                          onClick={() => setRestoreTarget(version)}
                          disabled={busy}
                        >
                          {t('resumes.restore')}
                        </button>
                      ) : (
                        <span className="rounded-full bg-[var(--blue-50)] px-2 py-0.5 text-[var(--blue-700)]">
                          {t('resumes.current')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {!loading && !error && versions.length === 0 ? (
        <p className="text-sm text-[var(--text-2)]">{t('resumes.noHistory')}</p>
      ) : null}

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title={t('dialogs.restoreVersion.title')}
        description={
          restoreTarget
            ? t('dialogs.restoreVersion.description', {
                title: restoreTarget.title || restoreTarget.resume_id,
              })
            : undefined
        }
        confirmLabel={t('dialogs.restoreVersion.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (restoreTarget) void handleRestore(restoreTarget.resume_id);
        }}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
}
