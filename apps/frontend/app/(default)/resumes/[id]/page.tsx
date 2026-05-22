'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import Resume, { ResumeData } from '@/components/dashboard/resume-component';
import {
  fetchResume,
  fetchResumeHistory,
  downloadOriginalResumeFile,
  downloadResumePdf,
  getResumePdfUrl,
  deleteResume,
  retryProcessing,
  renameResume,
  restoreResumeVersion,
  setResumeAsMaster,
} from '@/lib/api/resume';
import { useStatusCache } from '@/lib/context/status-cache';
import { ArrowLeft, Edit, Download, Loader2, AlertCircle, Sparkles, Pencil } from 'lucide-react';
import { EnrichmentModal } from '@/components/enrichment/enrichment-modal';
import { useTranslations } from '@/lib/i18n';
import { withLocalizedDefaultSections } from '@/lib/utils/section-helpers';
import { useLanguage } from '@/lib/context/language-context';
import { downloadBlobAsFile, openUrlInNewTab, sanitizeFilename } from '@/lib/utils/download';
import { logError, logWarn } from '@/lib/utils/logger';
import ResumeVersionHistory from '@/components/builder/resume-version-history';

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
type ResumeRecord = Awaited<ReturnType<typeof fetchResume>>;

type ResumeSnapshot = {
  title: string;
  name: string;
  role: string;
  summary: string;
  skills: string[];
  languages: string[];
  certifications: string[];
  awards: string[];
  experienceCount: number;
  educationCount: number;
  projectCount: number;
};

type ResumeComparison = {
  current: ResumeSnapshot;
  selected: ResumeSnapshot;
  rows: Array<{ label: string; current: string; selected: string }>;
  skillChanges: { added: string[]; removed: string[] };
};

const getErrorStatusCode = (err: unknown): number | null => {
  if (!err || typeof err !== 'object') return null;
  const statusCode = (err as { statusCode?: number }).statusCode;
  return typeof statusCode === 'number' ? statusCode : null;
};

const isAccessDeniedStatus = (statusCode: number | null): boolean =>
  statusCode === 401 || statusCode === 403;

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return values.map((value) => String(value || '').trim()).filter(Boolean);
}

function toSnapshotFromProcessed(
  processed: ResumeData | null,
  title: string | null
): ResumeSnapshot {
  const additional = processed?.additional || {};
  const personalInfo = processed?.personalInfo || {};

  return {
    title: String(title || personalInfo.name || 'Untitled resume').trim(),
    name: String(personalInfo.name || '').trim(),
    role: String(personalInfo.title || '').trim(),
    summary: String(processed?.summary || '').trim(),
    skills: normalizeStringList(additional.technicalSkills),
    languages: normalizeStringList(additional.languages),
    certifications: normalizeStringList(additional.certificationsTraining),
    awards: normalizeStringList(additional.awards),
    experienceCount: Array.isArray(processed?.workExperience) ? processed.workExperience.length : 0,
    educationCount: Array.isArray(processed?.education) ? processed.education.length : 0,
    projectCount: Array.isArray(processed?.personalProjects)
      ? processed.personalProjects.length
      : 0,
  };
}

function parseStructuredResume(record: ResumeRecord | null): ResumeData | null {
  if (!record) return null;
  if (record.processed_resume) {
    return record.processed_resume as ResumeData;
  }

  const raw = String(record.raw_resume?.content || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ResumeData;
  } catch {
    return null;
  }
}

function buildComparison(current: ResumeSnapshot, selected: ResumeSnapshot): ResumeComparison {
  const rows = [
    { label: 'Title', current: current.title, selected: selected.title },
    { label: 'Name', current: current.name || '-', selected: selected.name || '-' },
    { label: 'Role', current: current.role || '-', selected: selected.role || '-' },
    { label: 'Summary', current: current.summary || '-', selected: selected.summary || '-' },
    {
      label: 'Experience sections',
      current: String(current.experienceCount),
      selected: String(selected.experienceCount),
    },
    {
      label: 'Education sections',
      current: String(current.educationCount),
      selected: String(selected.educationCount),
    },
    {
      label: 'Projects',
      current: String(current.projectCount),
      selected: String(selected.projectCount),
    },
    {
      label: 'Languages',
      current: current.languages.join(', ') || '-',
      selected: selected.languages.join(', ') || '-',
    },
    {
      label: 'Certifications',
      current: current.certifications.join(', ') || '-',
      selected: selected.certifications.join(', ') || '-',
    },
    {
      label: 'Awards',
      current: current.awards.join(', ') || '-',
      selected: selected.awards.join(', ') || '-',
    },
  ];

  const currentSkills = new Set(current.skills.map((skill) => skill.toLowerCase()));
  const selectedSkills = new Set(selected.skills.map((skill) => skill.toLowerCase()));

  return {
    current,
    selected,
    rows,
    skillChanges: {
      added: selected.skills.filter((skill) => !currentSkills.has(skill.toLowerCase())),
      removed: current.skills.filter((skill) => !selectedSkills.has(skill.toLowerCase())),
    },
  };
}

export default function ResumeViewerPage() {
  const { t } = useTranslations();
  const { uiLanguage } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const { decrementResumes, setHasMasterResume } = useStatusCache();
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [isMasterResume, setIsMasterResume] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteSuccessDialog, setShowDeleteSuccessDialog] = useState(false);
  const [showDownloadSuccessDialog, setShowDownloadSuccessDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [resumeTitle, setResumeTitle] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [isSettingMaster, setIsSettingMaster] = useState(false);
  const [resumeHistory, setResumeHistory] = useState<Awaited<
    ReturnType<typeof fetchResumeHistory>
  > | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ResumeComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonTitle, setComparisonTitle] = useState<string | null>(null);

  const resumeId = params?.id as string;

  const clearMasterResumeIfNeeded = useCallback(() => {
    if (localStorage.getItem('master_resume_id') === resumeId) {
      localStorage.removeItem('master_resume_id');
      setHasMasterResume(false);
      setIsMasterResume(false);
    }
  }, [resumeId, setHasMasterResume]);

  const localizedResumeData = useMemo(() => {
    if (!resumeData) return null;
    return withLocalizedDefaultSections(resumeData, t);
  }, [resumeData, t]);

  useEffect(() => {
    if (!resumeId) return;

    const loadResume = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchResume(resumeId);

        // Get processing status
        const status = (data.raw_resume?.processing_status || 'pending') as ProcessingStatus;
        setProcessingStatus(status);

        // Capture title for editable display (always set to clear stale state)
        setResumeTitle(data.title ?? null);

        // Prioritize processed_resume if available (structured JSON)
        if (data.processed_resume) {
          setResumeData(data.processed_resume as ResumeData);
          setError(null);
        } else if (status === 'failed') {
          setError(t('resumeViewer.errors.processingFailed'));
        } else if (status === 'processing') {
          setError(t('resumeViewer.errors.stillProcessing'));
        } else if (data.raw_resume?.content) {
          // Try to parse raw_resume content as JSON (for tailored resumes stored as JSON)
          try {
            const parsed = JSON.parse(data.raw_resume.content);
            setResumeData(parsed as ResumeData);
          } catch {
            setError(t('resumeViewer.errors.notProcessedYet'));
          }
        } else {
          setError(t('resumeViewer.errors.noDataAvailable'));
        }
      } catch (err) {
        const statusCode = getErrorStatusCode(err);
        if (isAccessDeniedStatus(statusCode)) {
          logWarn('resume-viewer-page', 'Access denied while loading resume', { statusCode });
          clearMasterResumeIfNeeded();
          setError(t('errors.unauthorized'));
          return;
        }
        logError('resume-viewer-page', 'Failed to load resume', err);
        setError(t('resumeViewer.errors.failedToLoad'));
      } finally {
        setLoading(false);
      }
    };

    loadResume();
    setIsMasterResume(localStorage.getItem('master_resume_id') === resumeId);
  }, [resumeId, t, clearMasterResumeIfNeeded]);

  useEffect(() => {
    if (!resumeId) return;

    let active = true;

    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const history = await fetchResumeHistory(resumeId);
        if (active) {
          setResumeHistory(history);
        }
      } catch (err) {
        const statusCode = getErrorStatusCode(err);
        if (isAccessDeniedStatus(statusCode)) {
          logWarn('resume-viewer-page', 'Access denied while loading resume history', {
            statusCode,
          });
          if (active) {
            setHistoryError(t('errors.unauthorized'));
          }
          return;
        }
        logError('resume-viewer-page', 'Failed to load resume history', err);
        if (active) {
          setHistoryError(t('resumeViewer.versionHistoryFailed'));
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      active = false;
    };
  }, [resumeId, t]);

  const handleRetryProcessing = async () => {
    if (!resumeId) return;
    setIsRetrying(true);
    try {
      const result = await retryProcessing(resumeId);
      if (result.processing_status === 'ready') {
        // Reload the page to show the processed resume
        window.location.reload();
      } else {
        setError(t('resumeViewer.errors.processingFailed'));
      }
    } catch (err) {
      const statusCode = getErrorStatusCode(err);
      if (isAccessDeniedStatus(statusCode)) {
        logWarn('resume-viewer-page', 'Access denied while retrying processing', { statusCode });
        clearMasterResumeIfNeeded();
        setError(t('errors.unauthorized'));
        return;
      }
      logError('resume-viewer-page', 'Retry processing failed', err);
      setError(t('resumeViewer.errors.processingFailed'));
    } finally {
      setIsRetrying(false);
    }
  };

  const handleEdit = () => {
    router.push(`/builder?id=${resumeId}`);
  };

  const handleTitleSave = async () => {
    const trimmed = editingTitleValue.trim();
    if (!trimmed || trimmed === resumeTitle) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await renameResume(resumeId, trimmed);
      setResumeTitle(trimmed);
    } catch (err) {
      logError('resume-viewer-page', 'Failed to rename resume', err);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  // Reload resume data after enrichment
  const reloadResumeData = async () => {
    try {
      const data = await fetchResume(resumeId);
      if (data.processed_resume) {
        setResumeData(data.processed_resume as ResumeData);
        setError(null);
      }
    } catch (err) {
      logError('resume-viewer-page', 'Failed to reload resume', err);
    }
  };

  const handleEnrichmentComplete = () => {
    setShowEnrichmentModal(false);
    reloadResumeData();
  };

  const handleDownload = async () => {
    try {
      const blob = await downloadResumePdf(resumeId, undefined, uiLanguage);
      const filename = sanitizeFilename(resumeTitle, resumeId, 'resume');
      downloadBlobAsFile(blob, filename);
      setShowDownloadSuccessDialog(true);
    } catch (err) {
      logError('resume-viewer-page', 'Failed to download resume', err);
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        const fallbackUrl = getResumePdfUrl(resumeId, undefined, uiLanguage);
        const didOpen = openUrlInNewTab(fallbackUrl);
        if (!didOpen) {
          alert(t('common.popupBlocked', { url: fallbackUrl }));
        }
        return;
      }
    }
  };

  const handleDownloadOriginal = async () => {
    try {
      const blob = await downloadOriginalResumeFile(resumeId);
      const filename = sanitizeFilename(resumeTitle, resumeId, 'resume');
      downloadBlobAsFile(blob, filename);
      setShowDownloadSuccessDialog(true);
    } catch (err) {
      logError('resume-viewer-page', 'Failed to download original resume', err);
    }
  };

  const handleDeleteResume = async () => {
    try {
      setDeleteError(null);
      await deleteResume(resumeId);
      // Update cached counters
      decrementResumes();
      if (isMasterResume) {
        localStorage.removeItem('master_resume_id');
        setHasMasterResume(false);
      }
      setShowDeleteDialog(false);
      setShowDeleteSuccessDialog(true);
    } catch (err) {
      const statusCode = getErrorStatusCode(err);
      if (isAccessDeniedStatus(statusCode)) {
        logWarn('resume-viewer-page', 'Access denied while deleting resume', { statusCode });
        clearMasterResumeIfNeeded();
        setDeleteError(t('errors.unauthorized'));
        setShowDeleteDialog(false);
        return;
      }
      logError('resume-viewer-page', 'Failed to delete resume', err);
      setDeleteError(t('resumeViewer.errors.failedToDelete'));
      setShowDeleteDialog(false);
    }
  };

  const handleSetAsMasterResume = async () => {
    if (!resumeId || isSettingMaster || isMasterResume) return;

    setIsSettingMaster(true);
    try {
      await setResumeAsMaster(resumeId);
      localStorage.setItem('master_resume_id', resumeId);
      setIsMasterResume(true);
      setHasMasterResume(true);
    } catch (err) {
      const statusCode = getErrorStatusCode(err);
      if (isAccessDeniedStatus(statusCode)) {
        logWarn('resume-viewer-page', 'Access denied while setting master resume', {
          statusCode,
        });
        clearMasterResumeIfNeeded();
        setError(t('errors.unauthorized'));
        return;
      }
      logError('resume-viewer-page', 'Failed to set master resume', err);
      setError(t('resumeViewer.errors.failedToSetMaster'));
    } finally {
      setIsSettingMaster(false);
    }
  };

  const handleDeleteSuccessConfirm = () => {
    setShowDeleteSuccessDialog(false);
    router.push('/dashboard');
  };

  const handleDownloadSuccessConfirm = () => {
    setShowDownloadSuccessDialog(false);
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!resumeId) return;

    try {
      await restoreResumeVersion(resumeId, versionId);
      // Reload the resume data to show the restored content
      const data = await fetchResume(resumeId);
      if (data.processed_resume) {
        setResumeData(data.processed_resume as ResumeData);
        setError(null);
      }
      setResumeTitle(data.title ?? null);
      // Reload history to update version list
      const history = await fetchResumeHistory(resumeId);
      setResumeHistory(history);
    } catch (err) {
      logError('resume-viewer-page', 'Failed to restore resume version', err);
      setError(t('resumeViewer.errors.failedToRestore'));
    }
  };

  const handleCompareVersion = async (versionId: string) => {
    if (!resumeData) return;

    setComparisonError(null);
    setComparisonLoading(true);
    setComparisonTitle(null);
    setComparison(null);

    try {
      const version = await fetchResume(versionId);
      const currentSnapshot = toSnapshotFromProcessed(resumeData, resumeTitle);
      const versionSnapshot = toSnapshotFromProcessed(
        parseStructuredResume(version),
        version.title ?? null
      );

      setComparisonTitle(version.title || version.resume_id);
      setComparison(buildComparison(currentSnapshot, versionSnapshot));
    } catch (err) {
      logError('resume-viewer-page', 'Failed to compare resume version', err);
      setComparisonError('Unable to load comparison for this version.');
    } finally {
      setComparisonLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--canvas)]">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)] mb-4" />
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
          {t('resumeViewer.loading')}
        </p>
      </div>
    );
  }

  if (error || !resumeData) {
    const isProcessing = processingStatus === 'processing';
    const isFailed = processingStatus === 'failed';

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--canvas)] p-4">
        <div
          className={`rounded-2xl border p-6 text-center max-w-md shadow-[0_16px_28px_rgba(15,27,45,0.12)] ${
            isProcessing
              ? 'bg-[var(--surface-muted)] border-[color:var(--primary)]'
              : isFailed
                ? 'bg-orange-50 border-orange-200'
                : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex justify-center mb-4">
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            ) : isFailed ? (
              <AlertCircle className="w-8 h-8 text-orange-600" />
            ) : (
              <AlertCircle className="w-8 h-8 text-red-600" />
            )}
          </div>
          <p
            className={`font-semibold mb-4 ${
              isProcessing ? 'text-[var(--primary)]' : isFailed ? 'text-orange-700' : 'text-red-700'
            }`}
          >
            {error || t('resumeViewer.resumeNotFound')}
          </p>
          <div className="flex flex-col gap-2">
            {isFailed && (
              <>
                <Button onClick={handleRetryProcessing} disabled={isRetrying}>
                  {isRetrying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.processing')}
                    </>
                  ) : (
                    t('resumeViewer.retryProcessing')
                  )}
                </Button>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  {t('resumeViewer.deleteAndStartOver')}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              {t('resumeViewer.returnToDashboard')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] py-12 px-4 md:px-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header Actions */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
            {t('nav.backToDashboard')}
          </Button>

          <div className="flex gap-3">
            {isMasterResume && (
              <Button onClick={() => setShowEnrichmentModal(true)} className="gap-2">
                <Sparkles className="w-4 h-4" />
                {t('resumeViewer.enhanceResume')}
              </Button>
            )}
            {!isMasterResume && (
              <Button
                variant="outline"
                onClick={handleSetAsMasterResume}
                disabled={isSettingMaster}
              >
                {isSettingMaster ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('common.processing')}
                  </>
                ) : (
                  t('resumeViewer.setAsMaster')
                )}
              </Button>
            )}
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="w-4 h-4" />
              {t('dashboard.editResume')}
            </Button>
            <Button variant="success" onClick={handleDownload}>
              <Download className="w-4 h-4" />
              {t('resumeViewer.downloadResume')}
            </Button>
            <Button variant="outline" onClick={handleDownloadOriginal}>
              <Download className="w-4 h-4" />
              {t('resumeViewer.downloadOriginal')}
            </Button>
          </div>
        </div>

        {/* Editable Title (tailored resumes only) */}
        {!isMasterResume && (
          <div className="mb-6 no-print">
            {isEditingTitle ? (
              <input
                type="text"
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                autoFocus
                maxLength={80}
                placeholder={t('resumeViewer.titlePlaceholder')}
                className="font-serif text-2xl font-bold border-b border-[color:var(--border)] bg-transparent outline-none w-full max-w-xl px-0 py-1"
              />
            ) : (
              <button
                onClick={() => {
                  setEditingTitleValue(resumeTitle || '');
                  setIsEditingTitle(true);
                }}
                className="group flex items-center gap-2 cursor-pointer bg-transparent border-none p-0"
              >
                <h2
                  className={`font-serif text-2xl font-bold border-b border-transparent group-hover:border-[color:var(--border)] transition-colors ${!resumeTitle ? 'text-[color:var(--text-subtle)]' : ''}`}
                >
                  {resumeTitle || t('resumeViewer.titlePlaceholder')}
                </h2>
                <Pencil
                  className={`w-4 h-4 transition-opacity ${resumeTitle ? 'opacity-0 group-hover:opacity-60' : 'opacity-40 group-hover:opacity-60'}`}
                />
              </button>
            )}
          </div>
        )}

        {/* Resume Viewer */}
        <div className="flex justify-center pb-4">
          <div className="resume-print w-full max-w-[250mm] rounded-2xl shadow-[0_24px_40px_rgba(15,27,45,0.16)] border border-[color:var(--border)] bg-white">
            <Resume
              resumeData={localizedResumeData || resumeData}
              additionalSectionLabels={{
                technicalSkills: t('resume.additionalLabels.technicalSkills'),
                languages: t('resume.additionalLabels.languages'),
                certifications: t('resume.additionalLabels.certifications'),
                awards: t('resume.additionalLabels.awards'),
              }}
              sectionHeadings={{
                summary: t('resume.sections.summary'),
                experience: t('resume.sections.experience'),
                education: t('resume.sections.education'),
                projects: t('resume.sections.projects'),
                certifications: t('resume.sections.certifications'),
                skills: t('resume.sections.skillsOnly'),
                languages: t('resume.sections.languages'),
                awards: t('resume.sections.awards'),
                links: t('resume.sections.links'),
              }}
              fallbackLabels={{ name: t('resume.defaults.name') }}
            />
          </div>
        </div>

        <ResumeVersionHistory
          versions={resumeHistory?.versions || []}
          currentResumeId={resumeId}
          isLoading={historyLoading}
          error={historyError}
          onSelectVersion={(versionId) => router.push(`/resumes/${versionId}`)}
          onRestore={handleRestoreVersion}
          onCompare={handleCompareVersion}
        />

        <div className="flex justify-end pt-4 no-print">
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            {isMasterResume
              ? t('confirmations.deleteMasterResumeTitle')
              : t('dashboard.deleteResume')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={
          isMasterResume ? t('confirmations.deleteMasterResumeTitle') : t('dashboard.deleteResume')
        }
        description={
          isMasterResume
            ? t('confirmations.deleteMasterResumeDescription')
            : t('confirmations.deleteResumeFromSystemDescription')
        }
        confirmLabel={t('confirmations.deleteResumeConfirmLabel')}
        cancelLabel={t('confirmations.keepResumeCancelLabel')}
        onConfirm={handleDeleteResume}
        variant="danger"
      />

      <ConfirmDialog
        open={showDeleteSuccessDialog}
        onOpenChange={setShowDeleteSuccessDialog}
        title={t('resumeViewer.deletedTitle')}
        description={
          isMasterResume
            ? t('resumeViewer.deletedDescriptionMaster')
            : t('resumeViewer.deletedDescriptionRegular')
        }
        confirmLabel={t('resumeViewer.returnToDashboard')}
        onConfirm={handleDeleteSuccessConfirm}
        variant="success"
        showCancelButton={false}
      />

      <ConfirmDialog
        open={showDownloadSuccessDialog}
        onOpenChange={setShowDownloadSuccessDialog}
        title={t('common.success')}
        description={t('builder.alerts.downloadSuccess')}
        confirmLabel={t('common.ok')}
        onConfirm={handleDownloadSuccessConfirm}
        variant="success"
        showCancelButton={false}
      />

      {deleteError && (
        <ConfirmDialog
          open={!!deleteError}
          onOpenChange={() => setDeleteError(null)}
          title={t('resumeViewer.deleteFailedTitle')}
          description={deleteError}
          confirmLabel={t('common.ok')}
          onConfirm={() => setDeleteError(null)}
          variant="danger"
          showCancelButton={false}
        />
      )}

      {comparisonTitle ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
          <div className="w-full max-w-5xl rounded-2xl border border-[color:var(--border)] bg-white shadow-[0_24px_40px_rgba(15,27,45,0.2)]">
            <div className="border-b border-[color:var(--border)] px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl font-bold">Compare versions</h3>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                  Current version vs {comparisonTitle}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setComparisonTitle(null);
                  setComparison(null);
                  setComparisonError(null);
                }}
              >
                Close
              </Button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-auto">
              {comparisonLoading ? (
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                  Loading comparison...
                </p>
              ) : comparisonError ? (
                <p className="text-xs uppercase tracking-[0.2em] text-red-700">{comparisonError}</p>
              ) : comparison ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                        Current
                      </p>
                      <h4 className="mt-1 font-serif text-lg font-bold">
                        {comparison.current.title}
                      </h4>
                      <dl className="mt-3 space-y-2 text-xs">
                        <div>
                          <dt className="text-[color:var(--text-subtle)]">Role</dt>
                          <dd>{comparison.current.role || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--text-subtle)]">Summary</dt>
                          <dd className="whitespace-pre-wrap">
                            {comparison.current.summary || '-'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--text-subtle)]">Skills</dt>
                          <dd>{comparison.current.skills.join(', ') || '-'}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                        Selected version
                      </p>
                      <h4 className="mt-1 font-serif text-lg font-bold">
                        {comparison.selected.title}
                      </h4>
                      <dl className="mt-3 space-y-2 text-xs">
                        <div>
                          <dt className="text-[color:var(--text-subtle)]">Role</dt>
                          <dd>{comparison.selected.role || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--text-subtle)]">Summary</dt>
                          <dd className="whitespace-pre-wrap">
                            {comparison.selected.summary || '-'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--text-subtle)]">Skills</dt>
                          <dd>{comparison.selected.skills.join(', ') || '-'}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4">
                    <h4 className="font-serif text-lg font-bold">What changed</h4>
                    <div className="mt-3 space-y-3">
                      {comparison.rows.map((row) => (
                        <div
                          key={row.label}
                          className="grid gap-2 md:grid-cols-[180px_1fr_1fr] md:items-start border-b border-[color:var(--border)] pb-2 last:border-b-0 last:pb-0"
                        >
                          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                            {row.label}
                          </div>
                          <div className="text-xs">
                            <span className="text-[color:var(--text-subtle)] md:hidden">
                              Current:{' '}
                            </span>
                            {row.current}
                          </div>
                          <div className="text-xs">
                            <span className="text-[color:var(--text-subtle)] md:hidden">
                              Selected:{' '}
                            </span>
                            {row.selected}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <h4 className="font-serif text-base font-bold text-green-800">
                        Added skills
                      </h4>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-800">
                        {comparison.skillChanges.added.length
                          ? comparison.skillChanges.added.join(', ')
                          : 'No skill additions'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                      <h4 className="font-serif text-base font-bold text-red-800">
                        Removed skills
                      </h4>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-red-800">
                        {comparison.skillChanges.removed.length
                          ? comparison.skillChanges.removed.join(', ')
                          : 'No skill removals'}
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Enrichment Modal - Only for master resume */}
      {isMasterResume && (
        <EnrichmentModal
          resumeId={resumeId}
          isOpen={showEnrichmentModal}
          onClose={() => setShowEnrichmentModal(false)}
          onComplete={handleEnrichmentComplete}
        />
      )}
    </div>
  );
}
