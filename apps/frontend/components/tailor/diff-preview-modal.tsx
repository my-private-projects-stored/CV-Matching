'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslations } from '@/lib/i18n';
import type {
  ResumeDiffSummary,
  ResumeFieldDiff,
} from '@/components/common/resume_previewer_context';

interface DiffPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReject: () => void;
  onConfirm: () => void;
  diffSummary?: ResumeDiffSummary;
  detailedChanges?: ResumeFieldDiff[];
  errorMessage?: string;
}

export function DiffPreviewModal({
  isOpen,
  onClose,
  onReject,
  onConfirm,
  diffSummary,
  detailedChanges,
  errorMessage,
}: DiffPreviewModalProps) {
  const { t } = useTranslations();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'skills', 'descriptions', 'experience'])
  );

  if (!diffSummary || !detailedChanges) {
    return (
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-6 shadow-[0_24px_40px_rgba(15,27,45,0.18)]">
          <DialogHeader className="border-b border-[color:var(--border)] pb-4 bg-white -mx-6 -mt-6 px-6 pt-6">
            <DialogTitle className="font-serif text-2xl font-bold uppercase tracking-tight">
              {t('tailor.missingDiffDialog.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6 rounded-xl border border-[color:var(--border)] bg-white p-4 text-xs text-[color:var(--text-subtle)]">
            {t('tailor.missingDiffDialog.description')}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            <span>{t('tailor.missingDiffDialog.confirmLabel')}</span>
          </div>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-[color:var(--border)] bg-white -mx-6 -mb-6 px-6 py-4">
            <Button variant="outline" onClick={onClose} className="gap-2">
              {t('common.cancel')}
            </Button>
            <Button variant="warning" onClick={onConfirm} className="gap-2">
              {t('tailor.missingDiffDialog.confirmLabel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Group changes by type
  const summaryChanges = detailedChanges.filter((c) => c.field_type === 'summary');
  const skillChanges = detailedChanges.filter((c) => c.field_type === 'skill');
  const descChanges = detailedChanges.filter((c) => c.field_type === 'description');
  const certChanges = detailedChanges.filter((c) => c.field_type === 'certification');
  const experienceChanges = detailedChanges.filter((c) => c.field_type === 'experience');
  const educationChanges = detailedChanges.filter((c) => c.field_type === 'education');
  const projectChanges = detailedChanges.filter((c) => c.field_type === 'project');

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-6 shadow-[0_24px_40px_rgba(15,27,45,0.18)]">
        <DialogHeader className="border-b border-[color:var(--border)] pb-4 bg-white -mx-6 -mt-6 px-6 pt-6">
          <DialogTitle className="font-serif text-2xl font-bold uppercase tracking-tight">
            {t('tailor.diffModal.title')}
          </DialogTitle>
          <p className="text-xs text-[color:var(--text-subtle)] mt-2">
            {'// '}
            {t('tailor.diffModal.subtitle')}
          </p>
        </DialogHeader>

        {/* Summary cards */}
        <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-sm bg-[var(--primary)]"></div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">
              {t('tailor.diffModal.summary')}
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label={t('tailor.diffModal.skillsAdded')}
              value={diffSummary.skills_added}
              variant="success"
            />
            <StatCard
              label={t('tailor.diffModal.skillsRemoved')}
              value={diffSummary.skills_removed}
              variant="warning"
            />
            <StatCard
              label={t('tailor.diffModal.certificationsAdded')}
              value={diffSummary.certifications_added}
              variant="info"
            />
            <StatCard
              label={t('tailor.diffModal.descriptionsModified')}
              value={diffSummary.descriptions_modified}
              variant="info"
            />
            <StatCard
              label={t('tailor.diffModal.highRiskChanges')}
              value={diffSummary.high_risk_changes}
              variant={diffSummary.high_risk_changes > 0 ? 'danger' : 'success'}
            />
          </div>

          {diffSummary.high_risk_changes > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
              <AlertTriangle
                data-testid="high-risk-warning-banner-icon"
                className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-semibold uppercase text-amber-800">
                  {t('tailor.diffModal.warningTitle', {
                    count: diffSummary.high_risk_changes,
                  })}
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  {t('tailor.diffModal.warningMessage')}
                </p>
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Detailed changes list */}
        <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4">
          {/* Summary changes */}
          {summaryChanges.length > 0 && (
            <ChangeSection
              title={t('tailor.diffModal.summaryChanges')}
              count={summaryChanges.length}
              isExpanded={expandedSections.has('summary')}
              onToggle={() => toggleSection('summary')}
            >
              {summaryChanges.map((change, idx) => (
                <ChangeItem key={idx} change={change} />
              ))}
            </ChangeSection>
          )}

          {/* Skill changes */}
          {skillChanges.length > 0 && (
            <ChangeSection
              title={t('tailor.diffModal.skillChanges')}
              count={skillChanges.length}
              isExpanded={expandedSections.has('skills')}
              onToggle={() => toggleSection('skills')}
            >
              {skillChanges.map((change, idx) => (
                <ChangeItem key={idx} change={change} />
              ))}
            </ChangeSection>
          )}

          {/* Experience changes */}
          {experienceChanges.length > 0 && (
            <ChangeSection
              title={t('tailor.diffModal.experienceChanges')}
              count={experienceChanges.length}
              isExpanded={expandedSections.has('experience')}
              onToggle={() => toggleSection('experience')}
            >
              {experienceChanges.map((change, idx) => (
                <ChangeItem key={idx} change={change} />
              ))}
            </ChangeSection>
          )}

          {/* Description changes */}
          {descChanges.length > 0 && (
            <ChangeSection
              title={t('tailor.diffModal.descriptionChanges')}
              count={descChanges.length}
              isExpanded={expandedSections.has('descriptions')}
              onToggle={() => toggleSection('descriptions')}
            >
              {descChanges.map((change, idx) => (
                <ChangeItem key={idx} change={change} />
              ))}
            </ChangeSection>
          )}

          {/* Education changes */}
          {educationChanges.length > 0 && (
            <ChangeSection
              title={t('tailor.diffModal.educationChanges')}
              count={educationChanges.length}
              isExpanded={expandedSections.has('education')}
              onToggle={() => toggleSection('education')}
            >
              {educationChanges.map((change, idx) => (
                <ChangeItem key={idx} change={change} />
              ))}
            </ChangeSection>
          )}

          {/* Project changes */}
          {projectChanges.length > 0 && (
            <ChangeSection
              title={t('tailor.diffModal.projectChanges')}
              count={projectChanges.length}
              isExpanded={expandedSections.has('project')}
              onToggle={() => toggleSection('project')}
            >
              {projectChanges.map((change, idx) => (
                <ChangeItem key={idx} change={change} />
              ))}
            </ChangeSection>
          )}

          {/* Certification changes */}
          {certChanges.length > 0 && (
            <ChangeSection
              title={t('tailor.diffModal.certificationChanges')}
              count={certChanges.length}
              isExpanded={expandedSections.has('certifications')}
              onToggle={() => toggleSection('certifications')}
            >
              {certChanges.map((change, idx) => (
                <ChangeItem key={idx} change={change} />
              ))}
            </ChangeSection>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-[color:var(--border)] bg-white -mx-6 -mb-6 px-6 py-4">
          <Button variant="outline" onClick={onReject} className="gap-2">
            <X className="w-4 h-4" />
            {t('tailor.diffModal.rejectButton')}
          </Button>
          <Button onClick={onConfirm} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle className="w-4 h-4" />
            {t('tailor.diffModal.confirmButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component: stat card
interface StatCardProps {
  label: string;
  value: number;
  variant: 'success' | 'warning' | 'danger' | 'info';
}

function StatCard({ label, value, variant }: StatCardProps) {
  const colors = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-[color:var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]',
  };

  return (
    <div className={`rounded-xl border p-3 ${colors[variant]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] mt-1">{label}</div>
    </div>
  );
}

// Helper component: collapsible change section
interface ChangeSectionProps {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ChangeSection({ title, count, isExpanded, onToggle, children }: ChangeSectionProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--surface-muted)]"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">
            {title} ({count})
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-[color:var(--border)] p-4 space-y-3">{children}</div>
      )}
    </div>
  );
}

// Helper component: change item
interface ChangeItemProps {
  change: ResumeFieldDiff;
}

function ChangeItem({ change }: ChangeItemProps) {
  const typeColors = {
    added: 'border-l-4 border-emerald-500 bg-emerald-50',
    removed: 'border-l-4 border-red-500 bg-red-50',
    modified: 'border-l-4 border-[color:var(--primary)] bg-[var(--surface-muted)]',
  };

  const typeLabels = {
    added: '+',
    removed: '-',
    modified: '~',
  };

  return (
    <div className={`p-3 ${typeColors[change.change_type]}`}>
      <div className="flex items-start gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
          {typeLabels[change.change_type]}
        </span>
        <div className="flex-1">
          {change.original_value && (
            <div className="line-through text-red-600 text-sm mb-1">{change.original_value}</div>
          )}
          {change.new_value && (
            <div className="text-[var(--foreground)] text-sm">{change.new_value}</div>
          )}
        </div>
        {change.change_type === 'added' && change.confidence === 'high' && (
          <AlertTriangle
            data-testid="high-risk-change-icon"
            className="w-4 h-4 text-amber-500 shrink-0"
          />
        )}
      </div>
    </div>
  );
}
