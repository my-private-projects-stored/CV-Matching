'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/i18n/translations';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { ErrorBanner, SkeletonCard } from '@/components/ui';
import { getOne, putOne } from '@/lib/api';
import {
  reorderResumeSections,
  addResumeSection,
  deleteResumeSection,
  downloadResumePdf,
} from '@/lib/api/resume';
import type { Resume } from '@/types';

const templates = [
  'classic-single',
  'modern-single',
  'classic-two-column',
  'modern-two-column',
] as const;

const TEMPLATE_I18N: Record<(typeof templates)[number], string> = {
  'classic-single': 'builder.templates.classicSingle',
  'modern-single': 'builder.templates.modernSingle',
  'classic-two-column': 'builder.templates.classicTwoColumn',
  'modern-two-column': 'builder.templates.modernTwoColumn',
};

type BuilderData = NonNullable<Resume['builderData']>;
type SectionMeta = {
  id: string;
  key: string;
  displayName: string;
  sectionType?: string;
  isDefault?: boolean;
  isVisible?: boolean;
  order?: number;
};

const DEFAULT_SECTION_I18N: Record<string, string> = {
  personalInfo: 'resume.sections.personalInfo',
  summary: 'resume.sections.summary',
  workExperience: 'resume.sections.experience',
  education: 'resume.sections.education',
  personalProjects: 'resume.sections.projects',
  additional: 'resume.sections.additional',
};

const defaultSectionMeta: SectionMeta[] = [
  {
    id: 'personalInfo',
    key: 'personalInfo',
    displayName: 'personalInfo',
    sectionType: 'personalInfo',
    isDefault: true,
    isVisible: true,
    order: 0,
  },
  {
    id: 'summary',
    key: 'summary',
    displayName: 'summary',
    sectionType: 'summary',
    isDefault: true,
    isVisible: true,
    order: 1,
  },
  {
    id: 'workExperience',
    key: 'workExperience',
    displayName: 'workExperience',
    sectionType: 'experience',
    isDefault: true,
    isVisible: true,
    order: 2,
  },
  {
    id: 'education',
    key: 'education',
    displayName: 'education',
    sectionType: 'education',
    isDefault: true,
    isVisible: true,
    order: 3,
  },
  {
    id: 'personalProjects',
    key: 'personalProjects',
    displayName: 'personalProjects',
    sectionType: 'projects',
    isDefault: true,
    isVisible: true,
    order: 4,
  },
  {
    id: 'additional',
    key: 'additional',
    displayName: 'additional',
    sectionType: 'additional',
    isDefault: true,
    isVisible: true,
    order: 5,
  },
];

function resolveSectionDisplayName(
  t: (key: string) => string,
  section: SectionMeta,
  fallback: string
): string {
  const i18nKey = DEFAULT_SECTION_I18N[section.key];
  if (i18nKey && section.isDefault !== false) {
    return t(i18nKey);
  }
  return section.displayName || fallback;
}

function defaultBuilderData(resume: Resume | null): BuilderData {
  return {
    sections: resume?.parsedData ?? {},
    sectionMeta: [],
    template: 'classic-single',
    formatSettings: {
      pageSize: 'A4',
      margins: { top: 16, right: 16, bottom: 16, left: 16 },
      fontSize: { base: 10 },
      spacing: { lineHeight: 1.4, section: 12, item: 8 },
      compactMode: false,
    },
    customSections: {},
  };
}

function getSummary(builderData: BuilderData) {
  const sections = builderData.sections ?? {};
  return typeof sections.summary === 'string' ? sections.summary : '';
}

function normalizeSectionMeta(builderData: BuilderData): SectionMeta[] {
  const sections = builderData.sections ?? {};
  const provided = (builderData.sectionMeta ?? [])
    .map((item, index) => ({
      id: String(item.id ?? item.key ?? ''),
      key: String(item.key ?? item.id ?? ''),
      displayName: String(item.displayName ?? item.name ?? item.key ?? item.id ?? ''),
      sectionType: typeof item.sectionType === 'string' ? item.sectionType : undefined,
      isDefault: item.isDefault !== false,
      isVisible: item.isVisible !== false,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
    }))
    .filter((item) => item.id && item.key);
  const byId = new Map<string, SectionMeta>(provided.map((item) => [item.id, item]));

  defaultSectionMeta.forEach((meta) => {
    if (!byId.has(meta.id) && Object.prototype.hasOwnProperty.call(sections, meta.key)) {
      byId.set(meta.id, meta);
    }
  });

  Object.keys(sections).forEach((key) => {
    if (!byId.has(key)) {
      byId.set(key, {
        id: key,
        key,
        displayName: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
        sectionType: 'custom',
        isDefault: false,
        isVisible: true,
        order: byId.size,
      });
    }
  });

  return [...byId.values()]
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((meta, index) => ({ ...meta, order: index }));
}

function renderSectionValue(value: unknown, emptyLabel: string) {
  if (typeof value === 'string') return value || emptyLabel;
  if (Array.isArray(value)) {
    return value
      .slice(0, 4)
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return String(
            record.title ?? record.name ?? record.degree ?? record.company ?? JSON.stringify(record)
          );
        }
        return String(item);
      })
      .join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .slice(0, 6)
      .map(
        ([key, entry]) => `${key}: ${Array.isArray(entry) ? entry.join(', ') : String(entry ?? '')}`
      )
      .join('\n');
  }
  return emptyLabel;
}

function getFormatNumber(
  formatSettings: BuilderData['formatSettings'],
  path: 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft' | 'section' | 'item',
  fallback: number
) {
  const margins = (formatSettings?.margins as Record<string, unknown> | undefined) ?? {};
  const spacing = (formatSettings?.spacing as Record<string, unknown> | undefined) ?? {};
  const value =
    path === 'marginTop'
      ? margins.top
      : path === 'marginRight'
        ? margins.right
        : path === 'marginBottom'
          ? margins.bottom
          : path === 'marginLeft'
            ? margins.left
            : spacing[path];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatContact(personalInfo: unknown) {
  const info =
    personalInfo && typeof personalInfo === 'object'
      ? (personalInfo as Record<string, unknown>)
      : {};
  return [info.email, info.phone, info.location, info.website, info.linkedin]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .join(' | ');
}

function sectionText(
  section: SectionMeta,
  sections: Record<string, unknown>,
  builderData: BuilderData,
  t: (key: string) => string
) {
  return section.key === 'summary'
    ? getSummary(builderData) || t('builder.noSummary')
    : renderSectionValue(sections[section.key], t('builder.emptySection'));
}

export default function ResumeBuilderPage() {
  const { t } = useTranslations();
  const params = useParams();
  const resumeId = params?.id as string;
  const [resume, setResume] = useState<Resume | null>(null);
  const [builderData, setBuilderData] = useState<BuilderData>(defaultBuilderData(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');

  useEffect(() => {
    let active = true;
    getOne<Resume>('resumes', resumeId).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setResume(null);
      } else {
        const loaded = res.data ?? null;
        setError(null);
        setResume(loaded);
        const nextBuilderData = { ...defaultBuilderData(loaded), ...(loaded?.builderData ?? {}) };
        setBuilderData({ ...nextBuilderData, sectionMeta: normalizeSectionMeta(nextBuilderData) });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [resumeId]);

  const sectionMeta = useMemo(() => normalizeSectionMeta(builderData), [builderData]);
  const previewSections = useMemo(() => builderData.sections ?? {}, [builderData.sections]);
  const visibleSections = useMemo(
    () => sectionMeta.filter((meta) => meta.isVisible !== false),
    [sectionMeta]
  );

  function updateSectionMeta(nextMeta: SectionMeta[]) {
    setBuilderData({
      ...builderData,
      sectionMeta: nextMeta.map((meta, index) => ({ ...meta, order: index })),
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    const next = [...sectionMeta];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    updateSectionMeta(next);
    void persistSectionOrder(next);
  }

  async function persistSectionOrder(meta: SectionMeta[]) {
    try {
      await reorderResumeSections(
        resumeId,
        meta.map((item) => item.id)
      );
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : t('errors.reorderSections'));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionMeta.findIndex((item) => item.id === active.id);
    const newIndex = sectionMeta.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sectionMeta, oldIndex, newIndex);
    updateSectionMeta(next);
    void persistSectionOrder(next);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function toggleSection(sectionId: string) {
    updateSectionMeta(
      sectionMeta.map((meta) =>
        meta.id === sectionId ? { ...meta, isVisible: !meta.isVisible } : meta
      )
    );
  }

  function renameSection(sectionId: string, displayName: string) {
    updateSectionMeta(
      sectionMeta.map((meta) => (meta.id === sectionId ? { ...meta, displayName } : meta))
    );
  }

  async function addCustomSection() {
    const label = newSectionName.trim();
    if (!label) return;
    const key =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;
    if (Object.prototype.hasOwnProperty.call(builderData.sections ?? {}, key)) return;
    setSaving(true);
    setError(null);
    try {
      await addResumeSection(resumeId, {
        id: key,
        key,
        displayName: label,
        sectionType: 'custom',
        isDefault: false,
        isVisible: true,
        content: '',
      });
      setBuilderData({
        ...builderData,
        sections: { ...(builderData.sections ?? {}), [key]: '' },
        customSections: { ...(builderData.customSections ?? {}), [key]: '' },
        sectionMeta: [
          ...sectionMeta,
          {
            id: key,
            key,
            displayName: label,
            sectionType: 'custom',
            isDefault: false,
            isVisible: true,
            order: sectionMeta.length,
          },
        ],
      });
      setNewSectionName('');
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : t('errors.addSection'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomSection(sectionId: string) {
    const meta = sectionMeta.find((item) => item.id === sectionId);
    if (!meta || meta.isDefault) return;
    setSaving(true);
    setError(null);
    try {
      await deleteResumeSection(resumeId, sectionId);
      const nextSections = { ...(builderData.sections ?? {}) };
      const nextCustomSections = { ...(builderData.customSections ?? {}) };
      delete nextSections[meta.key];
      delete nextCustomSections[meta.key];
      setBuilderData({
        ...builderData,
        sections: nextSections,
        customSections: nextCustomSections,
        sectionMeta: sectionMeta
          .filter((item) => item.id !== sectionId)
          .map((item, index) => ({ ...item, order: index })),
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('errors.deleteSection'));
    } finally {
      setSaving(false);
    }
  }

  function updateCustomContent(sectionKey: string, content: string) {
    setBuilderData({
      ...builderData,
      sections: { ...(builderData.sections ?? {}), [sectionKey]: content },
      customSections: { ...(builderData.customSections ?? {}), [sectionKey]: content },
    });
  }

  async function saveBuilderData() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await putOne<Resume, Partial<Resume>>('resumes', resumeId, {
      builderData,
      parsedData: builderData.sections ?? resume?.parsedData ?? {},
    });
    if (res.error) {
      setError(res.error);
    } else {
      setMessage(t('builder.saved'));
      setResume(res.data ?? resume);
    }
    setSaving(false);
  }

  async function exportPdf() {
    setExporting(true);
    setError(null);
    try {
      await saveBuilderData();
      const blob = await downloadResumePdf(resumeId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resume?.title || 'resume'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('errors.exportPdf'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <a className="text-sm text-[var(--blue-700)]" href="/candidate/resumes">
          {t('builder.back')}
        </a>
        <a
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-gray-50"
          href={`/candidate/resumes/${resumeId}/history`}
        >
          {t('builder.versionHistory')}
        </a>
        <a
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-gray-50"
          href={`/candidate/resumes/${resumeId}/cover-letter`}
        >
          {t('builder.coverLetter')}
        </a>
        <select
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          value={builderData.template}
          onChange={(event) =>
            setBuilderData({
              ...builderData,
              template: event.target.value as BuilderData['template'],
            })
          }
        >
          {templates.map((template) => (
            <option key={template} value={template}>
              {t(TEMPLATE_I18N[template])}
            </option>
          ))}
        </select>
        <button
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
          onClick={saveBuilderData}
          disabled={saving}
        >
          {saving ? t('builder.saving') : t('common.save')}
        </button>
        <button
          className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={exportPdf}
          disabled={exporting}
        >
          {exporting ? t('builder.exporting') : t('builder.exportPdf')}
        </button>
      </div>
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {message ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
          {message}
        </p>
      ) : null}
      {!loading && !error ? (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-4">
            <div>
              <p className="text-sm font-semibold">
                {resume?.title || t('resumes.defaultTitle')}
              </p>
              <p className="text-xs text-[var(--text-2)]">{resume?.updatedAt}</p>
            </div>
            <label className="block text-xs font-semibold text-[var(--text-2)]">
              {t('resume.sections.summary')}
              <textarea
                className="mt-2 min-h-32 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
                value={getSummary(builderData)}
                onChange={(event) =>
                  setBuilderData({
                    ...builderData,
                    sections: { ...(builderData.sections ?? {}), summary: event.target.value },
                  })
                }
              />
            </label>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-2)]">{t('builder.sectionsLabel')}</p>
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sectionMeta.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  {sectionMeta.map((section, index) => (
                    <SortableSectionRow
                      key={section.id}
                      section={section}
                      index={index}
                      builderData={builderData}
                      onRename={renameSection}
                      onMove={moveSection}
                      onToggle={toggleSection}
                      onDelete={deleteCustomSection}
                      onContentChange={updateCustomContent}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] px-2 py-2 text-xs"
                  placeholder={t('builder.customSectionPlaceholder')}
                  value={newSectionName}
                  onChange={(event) => setNewSectionName(event.target.value)}
                />
                <button
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                  onClick={addCustomSection}
                  type="button"
                >
                  {t('builder.add')}
                </button>
              </div>
            </div>
            <label className="block text-xs font-semibold text-[var(--text-2)]">
              {t('builder.pageSize')}
              <select
                className="mt-2 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                value={String(builderData.formatSettings?.pageSize ?? 'A4')}
                onChange={(event) =>
                  setBuilderData({
                    ...builderData,
                    formatSettings: {
                      ...(builderData.formatSettings ?? {}),
                      pageSize: event.target.value,
                    },
                  })
                }
              >
                <option value="A4">{t('builder.pageSizeA4')}</option>
                <option value="LETTER">{t('builder.pageSizeLetter')}</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-[var(--text-2)]">
              {t('builder.baseFontSize')}
              <input
                className="mt-2 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                min={8}
                max={14}
                type="number"
                value={Number(
                  (builderData.formatSettings?.fontSize as { base?: number } | undefined)?.base ??
                    10
                )}
                onChange={(event) =>
                  setBuilderData({
                    ...builderData,
                    formatSettings: {
                      ...(builderData.formatSettings ?? {}),
                      fontSize: {
                        ...((builderData.formatSettings?.fontSize as
                          | Record<string, unknown>
                          | undefined) ?? {}),
                        base: Number(event.target.value),
                      },
                    },
                  })
                }
              />
            </label>
            <label className="block text-xs font-semibold text-[var(--text-2)]">
              {t('builder.lineHeight')}
              <input
                className="mt-2 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                min={1}
                max={2}
                step={0.1}
                type="number"
                value={Number(
                  (builderData.formatSettings?.spacing as { lineHeight?: number } | undefined)
                    ?.lineHeight ?? 1.4
                )}
                onChange={(event) =>
                  setBuilderData({
                    ...builderData,
                    formatSettings: {
                      ...(builderData.formatSettings ?? {}),
                      spacing: {
                        ...((builderData.formatSettings?.spacing as
                          | Record<string, unknown>
                          | undefined) ?? {}),
                        lineHeight: Number(event.target.value),
                      },
                    },
                  })
                }
              />
            </label>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-2)]">{t('builder.margins')}</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['top', t('builder.marginTop')],
                    ['right', t('builder.marginRight')],
                    ['bottom', t('builder.marginBottom')],
                    ['left', t('builder.marginLeft')],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-xs text-[var(--text-2)]">
                    {label}
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                      min={4}
                      max={40}
                      type="number"
                      value={Number(
                        ((builderData.formatSettings?.margins as
                          | Record<string, unknown>
                          | undefined) ?? {})[key] ?? 16
                      )}
                      onChange={(event) =>
                        setBuilderData({
                          ...builderData,
                          formatSettings: {
                            ...(builderData.formatSettings ?? {}),
                            margins: {
                              ...((builderData.formatSettings?.margins as
                                | Record<string, unknown>
                                | undefined) ?? {}),
                              [key]: Number(event.target.value),
                            },
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-[var(--text-2)]">
                {t('builder.sectionGap')}
                <input
                  className="mt-2 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                  min={4}
                  max={32}
                  type="number"
                  value={getFormatNumber(builderData.formatSettings, 'section', 12)}
                  onChange={(event) =>
                    setBuilderData({
                      ...builderData,
                      formatSettings: {
                        ...(builderData.formatSettings ?? {}),
                        spacing: {
                          ...((builderData.formatSettings?.spacing as
                            | Record<string, unknown>
                            | undefined) ?? {}),
                          section: Number(event.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <label className="text-xs font-semibold text-[var(--text-2)]">
                {t('builder.itemGap')}
                <input
                  className="mt-2 w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm"
                  min={2}
                  max={24}
                  type="number"
                  value={getFormatNumber(builderData.formatSettings, 'item', 8)}
                  onChange={(event) =>
                    setBuilderData({
                      ...builderData,
                      formatSettings: {
                        ...(builderData.formatSettings ?? {}),
                        spacing: {
                          ...((builderData.formatSettings?.spacing as
                            | Record<string, unknown>
                            | undefined) ?? {}),
                          item: Number(event.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
            <label className="flex items-center justify-between text-xs font-semibold text-[var(--text-2)]">
              {t('builder.compactMode')}
              <input
                type="checkbox"
                checked={Boolean(builderData.formatSettings?.compactMode)}
                onChange={(event) =>
                  setBuilderData({
                    ...builderData,
                    formatSettings: {
                      ...(builderData.formatSettings ?? {}),
                      compactMode: event.target.checked,
                    },
                  })
                }
              />
            </label>
          </aside>
          <section className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[#f1f0ec] p-6">
            {(() => {
              const template = builderData.template ?? 'classic-single';
              const isModern = template.startsWith('modern');
              const isTwoColumn = template.endsWith('two-column');
              const accent = isModern ? '#1d4ed8' : '#7c5b18';
              const lineHeight = Number(
                (builderData.formatSettings?.spacing as { lineHeight?: number } | undefined)
                  ?.lineHeight ?? 1.4
              );
              const baseFontSize = Number(
                (builderData.formatSettings?.fontSize as { base?: number } | undefined)?.base ?? 10
              );
              const marginTop = getFormatNumber(builderData.formatSettings, 'marginTop', 16);
              const marginRight = getFormatNumber(builderData.formatSettings, 'marginRight', 16);
              const marginBottom = getFormatNumber(builderData.formatSettings, 'marginBottom', 16);
              const marginLeft = getFormatNumber(builderData.formatSettings, 'marginLeft', 16);
              const sectionGap = getFormatNumber(builderData.formatSettings, 'section', 12);
              const name = String(
                (previewSections.personalInfo as { name?: string } | undefined)?.name ||
                  resume?.title ||
                  t('resumes.defaultTitle')
              );
              const contact = formatContact(previewSections.personalInfo);
              const bodySections = visibleSections.filter(
                (section) => section.key !== 'personalInfo'
              );
              const sideKeys = new Set(['additional', 'skills', 'education']);
              const sidebarSections = bodySections.filter((section) => sideKeys.has(section.key));
              const mainSections = isTwoColumn
                ? bodySections.filter((section) => !sideKeys.has(section.key))
                : bodySections;
              const sectionClass = isModern
                ? 'border-l-2 pl-3'
                : 'border-b border-[var(--border)] pb-4 last:border-b-0';

              const renderPreviewSection = (section: SectionMeta, compact = false) => (
                <section
                  key={section.id}
                  className={sectionClass}
                  style={{
                    borderColor: isModern ? accent : undefined,
                    marginBottom: sectionGap,
                  }}
                >
                  <h2
                    className="text-xs font-bold uppercase tracking-normal"
                    style={{ color: accent }}
                  >
                    {resolveSectionDisplayName(t, section, t('builder.sectionFallback'))}
                  </h2>
                  <p
                    className={`mt-2 whitespace-pre-line text-[var(--text-2)] ${compact ? 'text-xs' : 'text-sm'}`}
                    style={{ lineHeight }}
                  >
                    {sectionText(section, previewSections, builderData, t)}
                  </p>
                </section>
              );

              return (
                <div
                  className={`min-h-[640px] w-full max-w-[620px] overflow-hidden rounded-xl bg-white shadow ${isModern ? 'font-sans' : 'font-serif'}`}
                  style={{
                    fontSize: baseFontSize,
                    padding: `${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`,
                  }}
                >
                  {isTwoColumn ? (
                    <div
                      className={`grid min-h-[590px] ${template === 'modern-two-column' ? 'grid-cols-[190px_1fr]' : 'grid-cols-[170px_1fr]'} gap-6`}
                    >
                      <aside
                        className={
                          template === 'modern-two-column'
                            ? 'rounded-lg p-4 text-white'
                            : 'border-r border-[var(--border)] pr-4'
                        }
                        style={{
                          backgroundColor: template === 'modern-two-column' ? accent : undefined,
                          borderColor: template === 'classic-two-column' ? accent : undefined,
                        }}
                      >
                        <p className="text-xl font-bold leading-tight">{name}</p>
                        {contact ? (
                          <p
                            className={`mt-3 whitespace-pre-line text-xs leading-5 ${template === 'modern-two-column' ? 'text-white/85' : 'text-[var(--text-2)]'}`}
                          >
                            {contact}
                          </p>
                        ) : null}
                        <div className="mt-6">
                          {sidebarSections.map((section) => renderPreviewSection(section, true))}
                        </div>
                      </aside>
                      <main>
                        <p className="text-3xl font-bold" style={{ color: accent }}>
                          {name}
                        </p>
                        {contact ? (
                          <p className="mt-2 text-xs text-[var(--text-3)]">{contact}</p>
                        ) : null}
                        <div className="mt-6">
                          {mainSections.map((section) => renderPreviewSection(section))}
                        </div>
                      </main>
                    </div>
                  ) : (
                    <>
                      <p
                        className={`font-display ${isModern ? 'text-4xl font-bold' : 'text-3xl'}`}
                        style={{ color: isModern ? accent : undefined }}
                      >
                        {name}
                      </p>
                      {contact ? (
                        <p className="mt-2 text-xs text-[var(--text-3)]">{contact}</p>
                      ) : null}
                      <div className="mt-6">
                        {mainSections.map((section) => renderPreviewSection(section))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SortableSectionRow({
  section,
  index,
  builderData,
  onRename,
  onMove,
  onToggle,
  onDelete,
  onContentChange,
}: {
  section: SectionMeta;
  index: number;
  builderData: BuilderData;
  onRename: (id: string, name: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onContentChange: (key: string, content: string) => void;
}) {
  const { t } = useTranslations();
  const sectionFallback = t('builder.sectionFallback');
  const displayValue = resolveSectionDisplayName(t, section, sectionFallback);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-[var(--border)] p-2">
      <div className="flex items-center gap-1">
        <button
          className="cursor-grab rounded border border-[var(--border)] p-1 text-[var(--text-3)]"
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t('builder.dragToReorder')}
        >
          <GripVertical className="size-3.5" />
        </button>
        <input
          className="min-w-0 flex-1 rounded border border-[var(--border)] px-2 py-1 text-xs"
          value={displayValue}
          onChange={(event) => onRename(section.id, event.target.value)}
        />
        <button
          className="rounded border border-[var(--border)] px-2 py-1 text-xs"
          onClick={() => onMove(index, -1)}
          type="button"
        >
          {t('builder.up')}
        </button>
        <button
          className="rounded border border-[var(--border)] px-2 py-1 text-xs"
          onClick={() => onMove(index, 1)}
          type="button"
        >
          {t('builder.down')}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-2)]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={section.isVisible !== false}
            onChange={() => onToggle(section.id)}
          />
          {t('builder.visible')}
        </label>
        {!section.isDefault ? (
          <button className="text-[var(--danger)]" onClick={() => onDelete(section.id)} type="button">
            {t('common.delete')}
          </button>
        ) : null}
      </div>
      {!section.isDefault ? (
        <textarea
          className="mt-2 min-h-20 w-full rounded border border-[var(--border)] p-2 text-xs"
          value={String((builderData.sections ?? {})[section.key] ?? '')}
          onChange={(event) => onContentChange(section.key, event.target.value)}
        />
      ) : null}
    </div>
  );
}
