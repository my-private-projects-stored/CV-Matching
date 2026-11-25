'use client';

import React, { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { type ResumeData } from '@/components/dashboard/resume-component';
import { ResumeForm } from './resume-form';
import { FormattingControls } from './formatting-controls';
import { CoverLetterEditor } from './cover-letter-editor';
import { OutreachEditor } from './outreach-editor';
import { CoverLetterPreview } from './cover-letter-preview';
import { OutreachPreview } from './outreach-preview';
import { GeneratePrompt } from './generate-prompt';
import { Button } from '@/components/ui/button';
import { RetroTabs } from '@/components/ui/retro-tabs';
import { ConfirmDialog, type ConfirmDialogProps } from '@/components/ui/confirm-dialog';
import {
  Download,
  Save,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Copy,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useResumePreview } from '@/components/common/resume_previewer_context';
import { PaginatedPreview } from '@/components/preview';
import {
  downloadResumePdf,
  downloadCoverLetterPdf,
  getResumePdfUrl,
  getCoverLetterPdfUrl,
  fetchResume,
  updateResume,
  updateCoverLetter,
  updateOutreachMessage,
  generateCoverLetter,
  generateOutreachMessage,
  fetchJobDescription,
} from '@/lib/api/resume';
import { JDComparisonView } from './jd-comparison-view';
import { RegenerateWizard } from './regenerate-wizard';
import { useRegenerateWizard } from '@/hooks/use-regenerate-wizard';
import { useTranslations } from '@/lib/i18n';
import { type TemplateSettings, DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';
import { withLocalizedDefaultSections } from '@/lib/utils/section-helpers';
import { useLanguage } from '@/lib/context/language-context';
import { downloadBlobAsFile, openUrlInNewTab, sanitizeFilename } from '@/lib/utils/download';
import type { RegenerateItemInput } from '@/lib/api/enrichment';
import { logError } from '@/lib/utils/logger';
import { useAuth } from '@/lib/context/auth-context';

type TabId = 'resume' | 'cover-letter' | 'outreach' | 'jd-match';

const STORAGE_KEY = 'resume_builder_draft';
const SETTINGS_STORAGE_KEY = 'resume_builder_settings';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const buildInitialData = (t: Translate): ResumeData => ({
  personalInfo: {
    name: t('builder.personalInfoForm.placeholders.name'),
    title: t('builder.personalInfoForm.placeholders.title'),
    email: t('builder.personalInfoForm.placeholders.email'),
    phone: t('builder.personalInfoForm.placeholders.phone'),
    location: t('builder.personalInfoForm.placeholders.location'),
    website: t('builder.personalInfoForm.placeholders.website'),
    linkedin: t('builder.personalInfoForm.placeholders.linkedin'),
    github: t('builder.personalInfoForm.placeholders.github'),
  },
  summary: t('builder.placeholders.summary'),
  workExperience: [],
  education: [],
  personalProjects: [],
  additional: {
    technicalSkills: [],
    languages: [],
    certificationsTraining: [],
    awards: [],
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sanitizeResumeData = (data: any): ResumeData => {
  if (!data || typeof data !== 'object') return data;
  const sanitized = { ...data };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sanitizeArray = (arr: any[] | undefined) => {
    if (!Array.isArray(arr)) return [];

    const seenIds = new Set<number>();
    let nextId = 1;

    return arr.map((item) => {
      if (!item || typeof item !== 'object') return item;

      let id = Number(item.id);
      if (isNaN(id) || id <= 0 || seenIds.has(id)) {
        while (seenIds.has(nextId)) {
          nextId++;
        }
        id = nextId;
        nextId++;
      }
      seenIds.add(id);
      return { ...item, id };
    });
  };

  sanitized.workExperience = sanitizeArray(sanitized.workExperience);
  sanitized.education = sanitizeArray(sanitized.education);
  sanitized.personalProjects = sanitizeArray(sanitized.personalProjects);

  if (sanitized.customSections && typeof sanitized.customSections === 'object') {
    const nextCustomSections = { ...sanitized.customSections };
    for (const key in nextCustomSections) {
      if (Array.isArray(nextCustomSections[key])) {
        nextCustomSections[key] = sanitizeArray(nextCustomSections[key]);
      }
    }
    sanitized.customSections = nextCustomSections;
  }

  return sanitized as ResumeData;
};

const ResumeBuilderContent = ({ resumeId: resumeIdProp }: { resumeId?: string }) => {
  const { t } = useTranslations();
  const { uiLanguage, contentLanguage } = useLanguage();
  const { user } = useAuth();
  const [notificationDialog, setNotificationDialog] = useState<{
    title: string;
    description: string;
    variant: NonNullable<ConfirmDialogProps['variant']>;
  } | null>(null);

  const showNotification = useCallback(
    (
      description: string,
      variant: NonNullable<ConfirmDialogProps['variant']> = 'default',
      title?: string
    ) => {
      const fallbackTitle = variant === 'success' ? t('common.success') : t('common.error');
      setNotificationDialog({
        title: title ?? fallbackTitle,
        description,
        variant,
      });
    },
    [t]
  );

  const initialData = useMemo(() => buildInitialData(t), [t]);
  const [resumeData, setResumeData] = useState<ResumeData>(() => initialData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedData, setLastSavedData] = useState<ResumeData>(() => initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [, setLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [isBuilderProcessing, setIsBuilderProcessing] = useState(false);
  const builderPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [templateSettings, setTemplateSettings] =
    useState<TemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);
  const { improvedData } = useResumePreview();
  const improvedPreview = improvedData?.data?.resume_preview;
  const improvedCoverLetter = improvedData?.data?.cover_letter;
  const improvedOutreach = improvedData?.data?.outreach_message;
  const searchParams = useSearchParams();
  const router = useRouter();
  const resumeId = resumeIdProp || searchParams.get('id');

  useEffect(() => {
    if (resumeId || hasUnsavedChanges || improvedPreview) {
      return;
    }
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      return;
    }
    setResumeData(initialData);
    setLastSavedData(initialData);
  }, [initialData, resumeId, hasUnsavedChanges, improvedPreview]);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('resume');

  // Cover letter & outreach state
  const [coverLetter, setCoverLetter] = useState('');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [isCoverLetterSaving, setIsCoverLetterSaving] = useState(false);
  const [isOutreachSaving, setIsOutreachSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [resumeTitle, setResumeTitle] = useState<string | null>(null);

  // On-demand generation state
  const [isTailoredResume, setIsTailoredResume] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState<
    'cover-letter' | 'outreach' | null
  >(null);

  // JD comparison state
  const [jobDescription, setJobDescription] = useState<string | null>(null);
  const [customJD, setCustomJD] = useState('');
  const effectiveJD = jobDescription || customJD || null;

  // AI Regenerate wizard
  const regenerateWizard = useRegenerateWizard({
    resumeId: resumeId || '',
    outputLanguage: contentLanguage,
    onSuccess: async () => {
      // Reload resume data after applying changes
      if (!resumeId) {
        return;
      }

      try {
        const data = await fetchResume(resumeId);
        // Update resume title for downloads
        setResumeTitle(data.title ?? null);
        if (data.processed_resume) {
          const sanitized = sanitizeResumeData(data.processed_resume);
          setResumeData(sanitized);
          setLastSavedData(sanitized);
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        logError(
          'resume-builder',
          'Failed to reload resume after applying regenerated changes',
          error
        );
        showNotification(t('builder.alerts.reloadFailed'), 'danger');
        throw error;
      }
    },
    onError: (errorMessage) => {
      logError(
        'resume-builder',
        'Error during regeneration or applying regenerated changes',
        errorMessage
      );

      if (/network|fetch/i.test(errorMessage) || errorMessage.includes('Failed to fetch')) {
        showNotification(t('builder.regenerate.errors.networkError'), 'danger');
        return;
      }

      if (/resume content changed|uniquely matched|please regenerate/i.test(errorMessage)) {
        showNotification(t('builder.regenerate.errors.resumeChanged'), 'danger');
        return;
      }

      if (/generate/i.test(errorMessage)) {
        showNotification(t('builder.regenerate.errors.generationFailed'), 'danger');
        return;
      }

      showNotification(t('builder.regenerate.errors.applyFailed'), 'danger');
    },
  });

  // Build regenerate items from resume data
  const experienceItemsForRegenerate: RegenerateItemInput[] = useMemo(() => {
    return (resumeData.workExperience || []).map((exp, idx) => ({
      item_id: `exp_${idx}`,
      item_type: 'experience' as const,
      title: exp.title ?? '',
      subtitle: exp.company || undefined,
      current_content: Array.isArray(exp.description)
        ? exp.description
        : exp.description
          ? [String(exp.description)]
          : [],
    }));
  }, [resumeData.workExperience]);

  const projectItemsForRegenerate: RegenerateItemInput[] = useMemo(() => {
    return (resumeData.personalProjects || []).map((proj, idx) => ({
      item_id: `proj_${idx}`,
      item_type: 'project' as const,
      title: proj.name ?? '',
      subtitle: proj.role || undefined,
      current_content: Array.isArray(proj.description)
        ? proj.description
        : proj.description
          ? [String(proj.description)]
          : [],
    }));
  }, [resumeData.personalProjects]);

  const skillsItemForRegenerate: RegenerateItemInput | null = useMemo(() => {
    const skills = resumeData.additional?.technicalSkills;
    if (skills && skills.length > 0) {
      return {
        item_id: 'skills',
        item_type: 'skills' as const,
        title: t('builder.regenerate.selectDialog.skills'),
        current_content: skills,
      };
    }
    return null;
  }, [resumeData.additional?.technicalSkills, t]);

  const localizedResumeDataForPreview = useMemo(
    () => withLocalizedDefaultSections(resumeData, t),
    [resumeData, t]
  );

  // Load template settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setTemplateSettings({
          ...DEFAULT_TEMPLATE_SETTINGS,
          ...parsed,
          margins: { ...DEFAULT_TEMPLATE_SETTINGS.margins, ...parsed.margins },
          spacing: { ...DEFAULT_TEMPLATE_SETTINGS.spacing, ...parsed.spacing },
          fontSize: { ...DEFAULT_TEMPLATE_SETTINGS.fontSize, ...parsed.fontSize },
        });
      } catch {
        // Use defaults
      }
    }
  }, []);

  // Save template settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(templateSettings));
  }, [templateSettings]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Stop any active builder polling
  const stopBuilderPolling = useCallback(() => {
    if (builderPollRef.current) {
      clearInterval(builderPollRef.current);
      builderPollRef.current = null;
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => () => stopBuilderPolling(), [stopBuilderPolling]);

  useEffect(() => {
    const loadResumeData = async () => {
      setLoadingState('loading');

      // Priority 1: Fetch from API if ID is in URL (most reliable)
      if (resumeId) {
        try {
          const data = await fetchResume(resumeId);
          // Track if this is a tailored resume (has parent_id)
          setIsTailoredResume(Boolean(data.parent_id));
          // Store resume title for downloads
          setResumeTitle(data.title ?? null);
          // Load cover letter and outreach message if available
          if (data.cover_letter) {
            setCoverLetter(data.cover_letter);
          }
          if (data.outreach_message) {
            setOutreachMessage(data.outreach_message);
          }
          // Prefer processed_resume if available
          if (data.processed_resume) {
            const sanitized = sanitizeResumeData({
              ...data.processed_resume,
              sectionMeta: data.builder_data?.sectionMeta,
              customSections: data.builder_data?.customSections,
            });
            setResumeData(sanitized);
            setLastSavedData(sanitized);
            setLoadingState('loaded');
            setIsBuilderProcessing(false);
            stopBuilderPolling();
            return;
          }
          // If resume is still being processed in background, show processing state
          // and poll until it's ready
          if (
            data.raw_resume?.processing_status === 'processing' ||
            data.raw_resume?.processing_status === 'pending'
          ) {
            setIsBuilderProcessing(true);
            setLoadingState('loaded');
            stopBuilderPolling();
            builderPollRef.current = setInterval(async () => {
              try {
                const polled = await fetchResume(resumeId);
                if (polled.processed_resume) {
                  const sanitized = sanitizeResumeData({
                    ...polled.processed_resume,
                    sectionMeta: polled.builder_data?.sectionMeta,
                    customSections: polled.builder_data?.customSections,
                  });
                  setResumeData(sanitized);
                  setLastSavedData(sanitized);
                  setIsBuilderProcessing(false);
                  stopBuilderPolling();
                } else if (
                  polled.raw_resume?.processing_status !== 'processing' &&
                  polled.raw_resume?.processing_status !== 'pending'
                ) {
                  // Finished but no parsed data — stop polling
                  setIsBuilderProcessing(false);
                  stopBuilderPolling();
                }
              } catch {
                // ignore poll errors
              }
            }, 3000);
            return;
          }
          // Fallback: use builder_data sections if available
          if (data.builder_data?.sections) {
            const sections = data.builder_data.sections;
            if (sections && typeof sections === 'object' && Object.keys(sections).length > 0) {
              const sanitized = sanitizeResumeData({
                ...sections,
                sectionMeta: data.builder_data?.sectionMeta,
                customSections: data.builder_data?.customSections,
              });
              setResumeData(sanitized);
              setLastSavedData(sanitized);
              setLoadingState('loaded');
              return;
            }
          }
          // Fallback to parsing raw content
          if (data.raw_resume?.content) {
            try {
              const parsed = sanitizeResumeData(JSON.parse(data.raw_resume.content));
              setResumeData(parsed);
              setLastSavedData(parsed);
              setLoadingState('loaded');
              return;
            } catch {
              // Raw content is markdown, not JSON
            }
          }
        } catch (err) {
          logError('resume-builder', 'Failed to load resume from API', err);
        }
      }

      // Priority 2: Improved Data from Context (Tailor Flow)
      if (improvedPreview) {
        const sanitized = sanitizeResumeData(improvedPreview);
        setResumeData(sanitized);
        setLastSavedData(sanitized);
        // Also load cover letter and outreach if present
        if (improvedCoverLetter) {
          setCoverLetter(improvedCoverLetter);
        }
        if (improvedOutreach) {
          setOutreachMessage(improvedOutreach);
        }
        // Persist to localStorage as backup
        localStorage.setItem(STORAGE_KEY, JSON.stringify(improvedPreview));
        setLoadingState('loaded');
        return;
      }

      // Priority 3: Restore from localStorage (browser refresh recovery)
      const savedDraft = localStorage.getItem(STORAGE_KEY);
      if (savedDraft) {
        try {
          const parsed = sanitizeResumeData(JSON.parse(savedDraft));
          setResumeData(parsed);
          setLastSavedData(parsed);
          setHasUnsavedChanges(true); // Mark as unsaved since it's a draft
          setLoadingState('loaded');
          return;
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Fallback: Use initial data
      setLoadingState('loaded');
    };

    loadResumeData();
  }, [improvedPreview, improvedCoverLetter, improvedOutreach, resumeId, stopBuilderPolling]);

  // Fetch job description when we have a tailored resume
  useEffect(() => {
    let cancelled = false;

    const loadJobDescription = async () => {
      if (isTailoredResume && resumeId) {
        try {
          const data = await fetchJobDescription(resumeId);
          if (!cancelled) {
            setJobDescription(data.content);
          }
        } catch (err) {
          // JD might not be available for older resumes
          if (!cancelled) {
            console.warn('Could not fetch job description:', err);
            setJobDescription(null);
          }
        }
      } else {
        // Clear job description when switching to non-tailored resume
        setJobDescription(null);
      }
    };

    loadJobDescription();
    return () => {
      cancelled = true;
    };
  }, [isTailoredResume, resumeId]);

  const handleUpdate = useCallback((newData: ResumeData) => {
    setResumeData(newData);
    setHasUnsavedChanges(true);
    // Auto-save draft to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  }, []);

  const handleSettingsChange = useCallback((newSettings: TemplateSettings) => {
    setTemplateSettings(newSettings);
  }, []);

  const handleSave = async () => {
    if (!resumeId) {
      showNotification(t('builder.alerts.saveNotAvailable'), 'warning');
      return;
    }
    try {
      setIsSaving(true);
      const updated = await updateResume(resumeId, resumeData);
      const nextData = sanitizeResumeData(updated.processed_resume || resumeData);
      setResumeData(nextData);
      setLastSavedData(nextData);
      setHasUnsavedChanges(false);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    } catch (error) {
      logError('resume-builder', 'Failed to save resume', error);
      showNotification(t('builder.alerts.saveFailed'), 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const sanitized = sanitizeResumeData(lastSavedData);
    setResumeData(sanitized);
    setHasUnsavedChanges(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  };

  const handleDownload = async () => {
    if (!resumeId) {
      showNotification(t('builder.alerts.downloadNotAvailable'), 'warning');
      return;
    }
    try {
      setIsDownloading(true);
      const blob = await downloadResumePdf(resumeId, templateSettings, uiLanguage);
      const filename = sanitizeFilename(resumeTitle, resumeId, 'resume');
      downloadBlobAsFile(blob, filename);
      showNotification(t('builder.alerts.downloadSuccess'), 'success');
    } catch (error) {
      logError('resume-builder', 'Failed to download resume', error);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const fallbackUrl = getResumePdfUrl(resumeId, templateSettings, uiLanguage);
        const didOpen = openUrlInNewTab(fallbackUrl);
        if (!didOpen) {
          showNotification(t('common.popupBlocked', { url: fallbackUrl }), 'warning');
        }
        return;
      }
      let errorMessage = t('builder.alerts.downloadFailed');
      if (error instanceof Error && error.message) {
        errorMessage = `${t('builder.alerts.downloadFailed')}: ${error.message}`;
      }
      showNotification(errorMessage, 'danger');
    } finally {
      setIsDownloading(false);
    }
  };

  // Cover letter handlers
  const handleSaveCoverLetter = async () => {
    if (!resumeId) return;
    try {
      setIsCoverLetterSaving(true);
      await updateCoverLetter(resumeId, coverLetter);
      showNotification(t('builder.alerts.coverLetterSaveSuccess'), 'success');
    } catch (error) {
      logError('resume-builder', 'Failed to save cover letter', error);
      showNotification(t('builder.alerts.coverLetterSaveFailed'), 'danger');
    } finally {
      setIsCoverLetterSaving(false);
    }
  };

  const handleDownloadCoverLetter = async () => {
    if (!resumeId) {
      showNotification(t('builder.alerts.coverLetterDownloadRequiresResume'), 'warning');
      return;
    }
    if (!coverLetter) {
      showNotification(t('builder.alerts.coverLetterMissing'), 'warning');
      return;
    }
    try {
      setIsDownloading(true);
      const blob = await downloadCoverLetterPdf(resumeId, templateSettings.pageSize, uiLanguage);
      const filename = sanitizeFilename(resumeTitle, resumeId, 'cover-letter');
      downloadBlobAsFile(blob, filename);
    } catch (error) {
      logError('resume-builder', 'Failed to download cover letter', error);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const fallbackUrl = getCoverLetterPdfUrl(resumeId, templateSettings.pageSize, uiLanguage);
        const didOpen = openUrlInNewTab(fallbackUrl);
        if (!didOpen) {
          showNotification(t('common.popupBlocked', { url: fallbackUrl }), 'warning');
        }
        return;
      }
      const errorMessage = error instanceof Error ? error.message : t('common.unknown');
      showNotification(
        t('builder.alerts.coverLetterDownloadFailed', { error: errorMessage }),
        'danger'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // Outreach handlers
  const handleSaveOutreach = async () => {
    if (!resumeId) return;
    try {
      setIsOutreachSaving(true);
      await updateOutreachMessage(resumeId, outreachMessage);
      showNotification(t('builder.alerts.outreachSaveSuccess'), 'success');
    } catch (error) {
      logError('resume-builder', 'Failed to save outreach message', error);
      showNotification(t('builder.alerts.outreachSaveFailed'), 'danger');
    } finally {
      setIsOutreachSaving(false);
    }
  };

  const handleCopyOutreach = async () => {
    try {
      await navigator.clipboard.writeText(outreachMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      logError('resume-builder', 'Failed to copy outreach message', error);
    }
  };

  // On-demand generation handlers
  const doGenerateCoverLetter = async () => {
    if (!resumeId) return;
    setIsGeneratingCoverLetter(true);
    setShowRegenerateDialog(null);
    try {
      const result = await generateCoverLetter(resumeId);
      setCoverLetter(result.content);
    } catch (error) {
      logError('resume-builder', 'Failed to generate cover letter', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification(
        t('builder.alerts.coverLetterGenerateFailed', { error: errorMessage }),
        'danger'
      );
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleGenerateCoverLetter = () => {
    if (!resumeId) return;
    // If content exists, show confirmation dialog
    if (coverLetter) {
      setShowRegenerateDialog('cover-letter');
      return;
    }
    doGenerateCoverLetter();
  };

  const doGenerateOutreach = async () => {
    if (!resumeId) return;
    setIsGeneratingOutreach(true);
    setShowRegenerateDialog(null);
    try {
      const result = await generateOutreachMessage(resumeId);
      setOutreachMessage(result.content);
    } catch (error) {
      logError('resume-builder', 'Failed to generate outreach message', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification(
        t('builder.alerts.outreachGenerateFailed', { error: errorMessage }),
        'danger'
      );
    } finally {
      setIsGeneratingOutreach(false);
    }
  };

  const handleGenerateOutreach = () => {
    if (!resumeId) return;
    // If content exists, show confirmation dialog
    if (outreachMessage) {
      setShowRegenerateDialog('outreach');
      return;
    }
    doGenerateOutreach();
  };

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
      {/* Top Action Toolbar */}
      <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-3.5 shadow-[var(--shadow-elev-1)] no-print">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (user?.role === 'recruiter') {
                    router.push('/recruiter/dashboard');
                  } else if (user?.role === 'admin') {
                    router.push('/admin/config');
                  } else {
                    router.push('/candidate/dashboard');
                  }
                }}
                className="-ml-2 text-[var(--text-2)] hover:text-[var(--blue-700)]"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('nav.backToDashboard')}
              </Button>
              <span className="rounded-full bg-[var(--blue-50)] px-2.5 py-0.5 text-xs font-medium text-[var(--blue-700)]">
                {resumeId ? t('builder.editMode') : t('builder.createAndPreview')}
              </span>
              {hasUnsavedChanges && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  <AlertTriangle className="w-3 h-3" />
                  {t('builder.unsavedDraft')}
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--text-1)]">
              {t('nav.builder')}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'resume' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateWizard.startRegenerate()}
                  disabled={!resumeId}
                >
                  <Sparkles className="w-4 h-4" />
                  {t('builder.regenerate.buttonLabel')}
                </Button>
                <Button
                  type="button"
                  variant="warning"
                  size="sm"
                  onClick={handleReset}
                  disabled={!hasUnsavedChanges}
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('common.reset')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={!resumeId || isSaving}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? t('common.saving') : t('common.save')}
                </Button>
                <Button
                  type="button"
                  variant="success"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!resumeId || isDownloading}
                >
                  <Download className="w-4 h-4" />
                  {isDownloading ? t('common.generating') : t('common.download')}
                </Button>
              </>
            )}

            {activeTab === 'cover-letter' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateCoverLetter}
                  disabled={isGeneratingCoverLetter || !resumeId}
                >
                  {isGeneratingCoverLetter ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {coverLetter ? t('coverLetter.regenerate') : t('coverLetter.generate')}
                </Button>
                {coverLetter && (
                  <Button
                    type="button"
                    variant="success"
                    size="sm"
                    onClick={handleDownloadCoverLetter}
                    disabled={!resumeId || isDownloading}
                  >
                    <Download className="w-4 h-4" />
                    {isDownloading ? t('common.generating') : t('common.download')}
                  </Button>
                )}
              </>
            )}

            {activeTab === 'outreach' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateOutreach}
                  disabled={isGeneratingOutreach || !resumeId}
                >
                  {isGeneratingOutreach ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {outreachMessage ? t('outreach.regenerate') : t('outreach.generate')}
                </Button>
                {outreachMessage && (
                  <Button type="button" variant="success" size="sm" onClick={handleCopyOutreach}>
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t('outreach.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        {t('outreach.copyToClipboard')}
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          <RetroTabs
            tabs={[
              { id: 'resume', label: t('builder.previewTabs.resume') },
              { id: 'cover-letter', label: t('builder.previewTabs.coverLetter') },
              { id: 'outreach', label: t('builder.previewTabs.outreach') },
              { id: 'jd-match', label: t('builder.previewTabs.jdMatch') },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as TabId)}
          />
          <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-3)]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              {templateSettings.template === 'swiss-single' ||
              templateSettings.template === 'modern'
                ? t('builder.footer.singleColumn')
                : t('builder.footer.twoColumn')}
            </span>
            <span>·</span>
            <span className="font-mono">
              {templateSettings.pageSize === 'A4' ? 'A4' : t('builder.pageSize.usLetter')}
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Split Workspace */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:h-[calc(100vh-190px)] lg:min-h-[600px]">
        {/* Left Panel: Editor */}
        <div className="space-y-4 lg:col-span-6 lg:h-full lg:overflow-y-auto lg:pr-2 pb-4 no-print">
          {/* Resume Editor */}
          {activeTab === 'resume' && (
            <>
              {isBuilderProcessing && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span>{t('builder.alerts.analyzingCv')}</span>
                </div>
              )}
              <FormattingControls settings={templateSettings} onChange={handleSettingsChange} />
              <ResumeForm resumeData={resumeData} onUpdate={handleUpdate} />
            </>
          )}

          {/* Cover Letter Editor */}
          {activeTab === 'cover-letter' &&
            (coverLetter ? (
              <CoverLetterEditor
                content={coverLetter}
                onChange={setCoverLetter}
                onSave={handleSaveCoverLetter}
                isSaving={isCoverLetterSaving}
              />
            ) : (
              <GeneratePrompt
                type="cover-letter"
                isGenerating={isGeneratingCoverLetter}
                onGenerate={handleGenerateCoverLetter}
                isTailoredResume={isTailoredResume}
              />
            ))}

          {/* Outreach Editor */}
          {activeTab === 'outreach' &&
            (outreachMessage ? (
              <OutreachEditor
                content={outreachMessage}
                onChange={setOutreachMessage}
                onSave={handleSaveOutreach}
                isSaving={isOutreachSaving}
              />
            ) : (
              <GeneratePrompt
                type="outreach"
                isGenerating={isGeneratingOutreach}
                onGenerate={handleGenerateOutreach}
                isTailoredResume={isTailoredResume}
              />
            ))}

          {/* JD Match Info Panel */}
          {activeTab === 'jd-match' && (
            <div className="space-y-4">
              {!jobDescription && (
                <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-elev-1)]">
                  <h3 className="text-sm font-semibold text-[var(--text-1)] mb-1">
                    {t('builder.jdMatch.pasteJDTitle')}
                  </h3>
                  <p className="text-xs text-[var(--text-3)] mb-3 leading-relaxed">
                    {t('builder.jdMatch.pasteJDHint')}
                  </p>
                  <textarea
                    className="w-full h-44 rounded-xl border border-[var(--border)] p-3 text-sm resize-y focus:outline-none focus:border-[var(--blue-600)] focus:ring-4 focus:ring-blue-600/10 bg-white"
                    placeholder={t('builder.jdMatch.pasteJDPlaceholder')}
                    value={customJD}
                    onChange={(e) => setCustomJD(e.target.value)}
                  />
                </div>
              )}

              {jobDescription && (
                <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-elev-1)]">
                  <h3 className="text-sm font-semibold text-[var(--text-1)] mb-2">
                    {t('builder.jdMatch.aboutTitle')}
                  </h3>
                  <p className="text-sm text-[var(--text-2)] leading-relaxed">
                    {t('builder.jdMatch.aboutDescription')}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-[var(--blue-100)] bg-[var(--blue-50)]/60 p-5">
                <h3 className="text-sm font-semibold text-[var(--text-1)] mb-2">
                  {t('builder.jdMatch.highlightedKeywordsTitle')}
                </h3>
                <p className="text-sm text-[var(--text-2)] leading-relaxed">
                  {(() => {
                    const template = t('builder.jdMatch.highlightedKeywordsDescriptionTemplate');
                    const parts = template.split('__COLOR__');
                    if (parts.length < 2) return template;
                    return (
                      <>
                        {parts[0]}
                        <mark className="rounded bg-yellow-200 px-1">
                          {t('builder.jdMatch.highlightColor')}
                        </mark>
                        {parts.slice(1).join('__COLOR__')}
                      </>
                    );
                  })()}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-elev-1)]">
                <h3 className="text-sm font-semibold text-[var(--text-1)] mb-2">
                  {t('builder.jdMatch.tipsTitle')}
                </h3>
                <ul className="text-sm text-[var(--text-2)] space-y-1.5 list-disc list-inside">
                  <li>{t('builder.jdMatch.tips.items.addMissingKeywords')}</li>
                  <li>{t('builder.jdMatch.tips.items.focusTechnicalSkills')}</li>
                  <li>{t('builder.jdMatch.tips.items.matchActionVerbs')}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Live Preview */}
        <div className="lg:col-span-6 rounded-2xl border border-[var(--border)] bg-slate-100/80 overflow-hidden shadow-[var(--shadow-elev-1)] flex flex-col min-h-[540px] lg:h-full no-print">
          <div
            className={
              activeTab === 'resume'
                ? 'flex-1 min-h-0 overflow-hidden'
                : 'flex-1 min-h-0 overflow-y-auto'
            }
          >
            {activeTab === 'resume' && (
              <PaginatedPreview
                resumeData={localizedResumeDataForPreview}
                settings={templateSettings}
              />
            )}

            {activeTab === 'cover-letter' &&
              (coverLetter && resumeData.personalInfo ? (
                <div className="p-6">
                  <CoverLetterPreview
                    content={coverLetter}
                    personalInfo={resumeData.personalInfo}
                    pageSize={templateSettings.pageSize}
                  />
                </div>
              ) : (
                <div className="p-6">
                  <GeneratePrompt
                    type="cover-letter"
                    isGenerating={isGeneratingCoverLetter}
                    onGenerate={handleGenerateCoverLetter}
                    isTailoredResume={isTailoredResume}
                  />
                </div>
              ))}

            {activeTab === 'outreach' &&
              (outreachMessage ? (
                <div className="p-6">
                  <OutreachPreview content={outreachMessage} />
                </div>
              ) : (
                <div className="p-6">
                  <GeneratePrompt
                    type="outreach"
                    isGenerating={isGeneratingOutreach}
                    onGenerate={handleGenerateOutreach}
                    isTailoredResume={isTailoredResume}
                  />
                </div>
              ))}

            {activeTab === 'jd-match' && effectiveJD && (
              <JDComparisonView jobDescription={effectiveJD} resumeData={resumeData} />
            )}
            {activeTab === 'jd-match' && !effectiveJD && (
              <div className="flex flex-col items-center justify-center h-full min-h-[360px] p-8 text-center gap-4">
                <div className="w-14 h-14 rounded-2xl border border-[var(--border)] bg-white flex items-center justify-center shadow-sm">
                  <svg
                    className="w-7 h-7 text-[var(--text-3)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-xs text-[var(--text-3)] max-w-xs">
                  {t('builder.jdMatch.noJDPlaceholder')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regenerate Confirmation Dialog */}
      <ConfirmDialog
        open={showRegenerateDialog !== null}
        onOpenChange={(open) => !open && setShowRegenerateDialog(null)}
        title={t('builder.regenerateDialog.title', {
          title:
            showRegenerateDialog === 'cover-letter' ? t('coverLetter.title') : t('outreach.title'),
        })}
        description={t('builder.regenerateDialog.description', {
          title:
            showRegenerateDialog === 'cover-letter' ? t('coverLetter.title') : t('outreach.title'),
        })}
        confirmLabel={
          showRegenerateDialog === 'cover-letter'
            ? t('coverLetter.regenerate')
            : t('outreach.regenerate')
        }
        cancelLabel={t('common.cancel')}
        variant="warning"
        onConfirm={
          showRegenerateDialog === 'cover-letter' ? doGenerateCoverLetter : doGenerateOutreach
        }
      />

      {/* Notification Dialog (replaces native alert()) */}
      <ConfirmDialog
        open={notificationDialog !== null}
        onOpenChange={(open) => !open && setNotificationDialog(null)}
        title={notificationDialog?.title ?? ''}
        description={notificationDialog?.description ?? ''}
        confirmLabel={t('common.ok')}
        showCancelButton={false}
        variant={notificationDialog?.variant ?? 'default'}
        onConfirm={() => setNotificationDialog(null)}
      />

      {/* AI Regenerate Wizard */}
      <RegenerateWizard
        step={regenerateWizard.step}
        onStepChange={regenerateWizard.setStep}
        experienceItems={experienceItemsForRegenerate}
        projectItems={projectItemsForRegenerate}
        skillsItem={skillsItemForRegenerate}
        selectedItems={regenerateWizard.selectedItems}
        onSelectionChange={regenerateWizard.setSelectedItems}
        instruction={regenerateWizard.instruction}
        onInstructionChange={regenerateWizard.setInstruction}
        regeneratedItems={regenerateWizard.regeneratedItems}
        regenerateErrors={regenerateWizard.regenerateErrors}
        isGenerating={regenerateWizard.isGenerating}
        isApplying={regenerateWizard.isApplying}
        error={regenerateWizard.error}
        onGenerate={regenerateWizard.generate}
        onAccept={regenerateWizard.acceptChanges}
        onReject={regenerateWizard.rejectAndRegenerate}
        onClose={regenerateWizard.reset}
      />
    </div>
  );
};

export const ResumeBuilder = ({ resumeId }: { resumeId?: string } = {}) => {
  const { t } = useTranslations();
  return (
    <Suspense fallback={<div>{t('common.loading')}</div>}>
      <ResumeBuilderContent resumeId={resumeId} />
    </Suspense>
  );
};
