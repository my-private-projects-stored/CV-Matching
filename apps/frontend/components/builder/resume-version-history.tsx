'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTranslations } from '@/lib/i18n';
import type { ResumeListItem } from '@/lib/api/resume';

interface ResumeVersionHistoryProps {
  versions: ResumeListItem[];
  currentResumeId: string;
  isLoading?: boolean;
  error?: string | null;
  onSelectVersion?: (resumeId: string) => void;
  onRestore?: (versionId: string) => Promise<void>;
  onCompare?: (versionId: string) => void;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function ResumeVersionHistory({
  versions,
  currentResumeId,
  isLoading = false,
  error = null,
  onSelectVersion,
  onRestore,
  onCompare,
}: ResumeVersionHistoryProps) {
  const { t } = useTranslations();
  const itemsPerPage = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [versions.length]);

  const totalPages = Math.max(1, Math.ceil(versions.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const visibleVersions = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return versions.slice(startIndex, startIndex + itemsPerPage);
  }, [safeCurrentPage, itemsPerPage, versions]);

  const versionLabelById = useMemo(() => {
    return new Map(
      versions.map((version) => [version.resume_id, version.title || version.filename || version.resume_id])
    );
  }, [versions]);

  const restoreVersion = versions.find((version) => version.resume_id === restoreConfirmId);
  const restoreVersionLabel =
    restoreVersion?.title || restoreVersion?.filename || restoreVersion?.resume_id || '';

  const handleRestoreClick = (versionId: string) => {
    setRestoreConfirmId(versionId);
    setRestoreError(null);
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirmId || !onRestore) return;

    setIsRestoring(true);
    setRestoreError(null);
    try {
      await onRestore(restoreConfirmId);
      setRestoreConfirmId(null);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Failed to restore resume');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancelRestore = () => {
    setRestoreConfirmId(null);
    setRestoreError(null);
  };

  return (
    <>
      <section className="mt-8 border border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
        <div className="border-b border-black px-4 py-3">
          <h3 className="font-serif text-lg font-bold">{t('resumeViewer.versionHistoryTitle')}</h3>
          <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
            {t('resumeViewer.versionHistoryDescription')}
          </p>
        </div>

        <div className="p-4">
          {isLoading ? (
            <p className="font-mono text-xs uppercase text-gray-500">{t('common.loading')}</p>
          ) : error ? (
            <p className="font-mono text-xs uppercase text-red-700">{error}</p>
          ) : versions.length ? (
            <>
              <ol className="space-y-3">
                {visibleVersions.map((version) => {
                  const isCurrent = version.resume_id === currentResumeId;
                  const label = version.title || version.filename || version.resume_id;
                  const restoredFromLabel = version.restored_from_version_id
                    ? versionLabelById.get(version.restored_from_version_id) || version.restored_from_version_id
                    : null;

                  return (
                    <li
                      key={version.resume_id}
                      className={`border p-3 ${isCurrent ? 'border-blue-700 bg-blue-50' : 'border-black/20 bg-white'}`}
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-serif text-base font-bold">{label}</h4>
                            {isCurrent ? (
                              <span className="font-mono text-[10px] uppercase tracking-wider text-blue-700 border border-blue-700 px-2 py-0.5">
                                {t('resumeViewer.versionHistoryCurrent')}
                              </span>
                            ) : null}
                            {version.is_master ? (
                              <span className="font-mono text-[10px] uppercase tracking-wider text-green-700 border border-green-700 px-2 py-0.5">
                                {t('resumeViewer.versionHistoryMaster')}
                              </span>
                            ) : null}
                            {version.parent_id ? (
                              <span className="font-mono text-[10px] uppercase tracking-wider text-gray-600 border border-gray-300 px-2 py-0.5">
                                {t('resumeViewer.versionHistoryTailored')}
                              </span>
                            ) : null}
                            {version.restored_from_version_id ? (
                              <span className="font-mono text-[10px] uppercase tracking-wider text-amber-700 border border-amber-700 px-2 py-0.5">
                                restored snapshot
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                            {formatDate(version.created_at)}
                          </p>
                          {version.restored_from_version_id ? (
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-amber-700">
                              restored from {restoredFromLabel}
                              {version.restored_at ? ` on ${formatDate(version.restored_at)}` : ''}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {onSelectVersion ? (
                            <Button
                              variant={isCurrent ? 'outline' : 'default'}
                              size="sm"
                              onClick={() => onSelectVersion(version.resume_id)}
                              disabled={isCurrent || isRestoring}
                            >
                              {isCurrent
                                ? t('resumeViewer.versionHistoryViewing')
                                : t('resumeViewer.versionHistoryOpen')}
                            </Button>
                          ) : null}
                          {onCompare ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onCompare(version.resume_id)}
                              disabled={isRestoring}
                            >
                              Compare
                            </Button>
                          ) : null}
                          {onRestore && !isCurrent ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreClick(version.resume_id)}
                              disabled={isRestoring}
                            >
                              {t('resumeViewer.versionHistoryRestore')}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-3 font-mono text-[10px] uppercase tracking-wider text-gray-600">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeCurrentPage <= 1}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {safeCurrentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safeCurrentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="font-mono text-xs uppercase text-gray-500">
              {t('resumeViewer.versionHistoryEmpty')}
            </p>
          )}
        </div>
      </section>

      {restoreConfirmId && restoreVersion ? (
        <ConfirmDialog
          open={Boolean(restoreConfirmId)}
          onOpenChange={(open) => {
            if (!open) {
              handleCancelRestore();
            }
          }}
          title={t('resumeViewer.confirmRestoreTitle')}
          description={`Restore ${restoreVersionLabel}. The current version will be archived first so you can undo later.`}
          errorMessage={restoreError || undefined}
          confirmLabel={isRestoring ? t('common.loading') : t('common.confirm')}
          cancelLabel={t('common.cancel')}
          confirmDisabled={isRestoring}
          variant="warning"
          closeOnConfirm={false}
          onConfirm={handleConfirmRestore}
          onCancel={handleCancelRestore}
        />
      ) : null}
    </>
  );
}

export default ResumeVersionHistory;
