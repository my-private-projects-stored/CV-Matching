'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Briefcase, FolderKanban, Lightbulb, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import type { RegenerateItemInput } from '@/lib/api/enrichment';

interface RegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experienceItems: RegenerateItemInput[];
  projectItems: RegenerateItemInput[];
  skillsItem: RegenerateItemInput | null;
  selectedItems: RegenerateItemInput[];
  onSelectionChange: (items: RegenerateItemInput[]) => void;
  onContinue: () => void;
}

/**
 * RegenerateDialog Component
 *
 * First step of the regenerate wizard.
 * Allows user to select which resume items to regenerate.
 * Swiss International Style design.
 */
export const RegenerateDialog: React.FC<RegenerateDialogProps> = ({
  open,
  onOpenChange,
  experienceItems,
  projectItems,
  skillsItem,
  selectedItems,
  onSelectionChange,
  onContinue,
}) => {
  const { t } = useTranslations();
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['experience', 'projects', 'skills'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const isSelected = (item: RegenerateItemInput) => {
    return selectedItems.some((s) => s.item_id === item.item_id);
  };

  const toggleItem = (item: RegenerateItemInput) => {
    if (isSelected(item)) {
      onSelectionChange(selectedItems.filter((s) => s.item_id !== item.item_id));
    } else {
      onSelectionChange([...selectedItems, item]);
    }
  };

  const hasItems = experienceItems.length > 0 || projectItems.length > 0 || skillsItem !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 rounded-2xl border border-[color:var(--border)] bg-white">
        <DialogHeader className="p-6 pb-4 border-b border-[color:var(--border)]">
          <DialogTitle className="font-serif text-xl font-bold uppercase tracking-tight">
            {t('builder.regenerate.selectDialog.title')}
          </DialogTitle>
          <DialogDescription className="text-xs text-[color:var(--text-subtle)] mt-2">
            {t('builder.regenerate.selectDialog.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
          {!hasItems && (
            <div className="text-center py-8 text-[color:var(--text-subtle)] text-sm">
              {t('builder.regenerate.selectDialog.noItemsAvailable')}
            </div>
          )}

          {/* Experience Section */}
          {experienceItems.length > 0 && (
            <div className="rounded-2xl border border-[color:var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('experience')}
                aria-expanded={expandedSections.has('experience')}
                className="w-full p-4 flex items-center justify-between bg-[var(--surface-muted)] hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5" />
                  <span className="text-sm uppercase tracking-[0.2em] font-semibold">
                    {t('builder.regenerate.selectDialog.experience')}
                  </span>
                  <span className="text-xs text-[color:var(--text-subtle)]">
                    ({experienceItems.length})
                  </span>
                </div>
                {expandedSections.has('experience') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              {expandedSections.has('experience') && (
                <div className="border-t border-[color:var(--border)]">
                  {experienceItems.map((item) => (
                    <ItemRow
                      key={item.item_id}
                      item={item}
                      isSelected={isSelected(item)}
                      onToggle={() => toggleItem(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Projects Section */}
          {projectItems.length > 0 && (
            <div className="rounded-2xl border border-[color:var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('projects')}
                aria-expanded={expandedSections.has('projects')}
                className="w-full p-4 flex items-center justify-between bg-[var(--surface-muted)] hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FolderKanban className="w-5 h-5" />
                  <span className="text-sm uppercase tracking-[0.2em] font-semibold">
                    {t('builder.regenerate.selectDialog.projects')}
                  </span>
                  <span className="text-xs text-[color:var(--text-subtle)]">
                    ({projectItems.length})
                  </span>
                </div>
                {expandedSections.has('projects') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              {expandedSections.has('projects') && (
                <div className="border-t border-[color:var(--border)]">
                  {projectItems.map((item) => (
                    <ItemRow
                      key={item.item_id}
                      item={item}
                      isSelected={isSelected(item)}
                      onToggle={() => toggleItem(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Skills Section */}
          {skillsItem && (
            <div className="rounded-2xl border border-[color:var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('skills')}
                aria-expanded={expandedSections.has('skills')}
                className="w-full p-4 flex items-center justify-between bg-[var(--surface-muted)] hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Lightbulb className="w-5 h-5" />
                  <span className="text-sm uppercase tracking-[0.2em] font-semibold">
                    {t('builder.regenerate.selectDialog.skills')}
                  </span>
                </div>
                {expandedSections.has('skills') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              {expandedSections.has('skills') && (
                <div className="border-t border-[color:var(--border)]">
                  <ItemRow
                    item={skillsItem}
                    isSelected={isSelected(skillsItem)}
                    onToggle={() => toggleItem(skillsItem)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-[var(--surface-muted)] border-t border-[color:var(--border)] flex-row justify-end gap-3">
          <DialogClose asChild>
            <Button variant="outline" className="rounded-xl">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button onClick={onContinue} disabled={selectedItems.length === 0} className="rounded-xl">
            {t('builder.regenerate.selectDialog.continueButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * ItemRow - Individual selectable item row
 */
interface ItemRowProps {
  item: RegenerateItemInput;
  isSelected: boolean;
  onToggle: () => void;
}

const ItemRow: React.FC<ItemRowProps> = ({ item, isSelected, onToggle }) => {
  const { t } = useTranslations();

  const contentCount = item.current_content.length;
  const itemCountKey =
    contentCount === 1
      ? 'builder.regenerate.selectDialog.itemCount.one'
      : 'builder.regenerate.selectDialog.itemCount.other';
  const itemCountLabel = t(itemCountKey).replace('{count}', String(contentCount));

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full p-4 flex items-center gap-4 text-left transition-colors ${
        isSelected ? 'bg-[var(--surface-muted)]' : 'bg-white hover:bg-[var(--surface-muted)]'
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 border-2 flex items-center justify-center transition-colors ${
          isSelected
            ? 'border-[var(--primary)] bg-[var(--primary)]'
            : 'border-[color:var(--border)] bg-white'
        }`}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <div className="font-sans font-medium text-sm truncate">{item.title}</div>
        {item.subtitle && (
          <div className="text-xs text-[color:var(--text-subtle)] truncate">{item.subtitle}</div>
        )}
      </div>

      {/* Content preview */}
      <div className="text-xs text-[color:var(--text-subtle)]">{itemCountLabel}</div>
    </button>
  );
};

export default RegenerateDialog;
