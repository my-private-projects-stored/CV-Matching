'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Check,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Briefcase,
  FolderKanban,
  Lightbulb,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import type { RegenerateItemError, RegeneratedItem } from '@/lib/api/enrichment';

interface RegenerateDiffPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regeneratedItems: RegeneratedItem[];
  regenerateErrors?: RegenerateItemError[];
  error: string | null;
  onAccept: () => void;
  onReject: () => void;
  isApplying: boolean;
}

/**
 * RegenerateDiffPreview Component
 *
 * Third step of the regenerate wizard.
 * Shows side-by-side comparison of original vs regenerated content.
 * Swiss International Style design.
 */
export const RegenerateDiffPreview: React.FC<RegenerateDiffPreviewProps> = ({
  open,
  onOpenChange,
  regeneratedItems,
  regenerateErrors = [],
  error,
  onAccept,
  onReject,
  isApplying,
}) => {
  const { t } = useTranslations();
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
    new Set(regeneratedItems.map((item) => item.item_id))
  );

  React.useEffect(() => {
    // Expand all items when regeneratedItems changes
    setExpandedItems(new Set(regeneratedItems.map((item) => item.item_id)));
  }, [regeneratedItems]);

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  type ItemLabelSource = Pick<RegeneratedItem, 'item_id' | 'item_type' | 'title' | 'subtitle'>;

  const getItemLabel = (item: ItemLabelSource) => {
    if (item.item_type === 'skills') {
      return t('builder.regenerate.selectDialog.skills');
    }

    const title = item.title?.trim();
    const subtitle = item.subtitle?.trim();

    if (title && subtitle) {
      return `${title} | ${subtitle}`;
    }

    return title || item.item_id;
  };

  const getItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'experience':
        return <Briefcase className="w-4 h-4" />;
      case 'project':
        return <FolderKanban className="w-4 h-4" />;
      case 'skills':
        return <Lightbulb className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const resolveErrorMessage = (value: string) => {
    if (value === 'No changes to apply') {
      return t('builder.regenerate.errors.noChangesToApply');
    }

    if (/network|fetch/i.test(value) || value.includes('Failed to fetch')) {
      return t('builder.regenerate.errors.networkError');
    }

    if (/resume content changed|uniquely matched|please regenerate/i.test(value)) {
      return t('builder.regenerate.errors.resumeChanged');
    }

    return t('builder.regenerate.errors.applyFailed');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] p-0 gap-0 rounded-2xl border border-[color:var(--border)] bg-white overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-[color:var(--border)]">
          <DialogTitle className="font-serif text-xl font-bold uppercase tracking-tight">
            {t('builder.regenerate.diffPreview.title')}
          </DialogTitle>
          <DialogDescription className="text-xs text-[color:var(--text-subtle)] mt-2">
            {t('builder.regenerate.diffPreview.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {/* Stats Card */}
        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold uppercase tracking-[0.2em]">
            <Check className="w-3 h-3" />
            {t('builder.regenerate.diffPreview.changesCount').replace(
              '{count}',
              String(regeneratedItems.length)
            )}
          </div>
        </div>

        {error ? (
          <div className="px-6 pt-4">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs text-red-700">{resolveErrorMessage(error)}</p>
            </div>
          </div>
        ) : null}

        {regenerateErrors.length > 0 ? (
          <div className="px-6 pt-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs text-[var(--foreground)]">
                {t('builder.regenerate.diffPreview.partialFailures', {
                  count: regenerateErrors.length,
                })}
              </p>
              <ul className="mt-2 space-y-1">
                {regenerateErrors.map((failed) => (
                  <li key={failed.item_id} className="text-xs text-[var(--foreground)]">
                    • {getItemLabel(failed)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {/* Diff Content */}
        <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
          {regeneratedItems.map((item) => (
            <div
              key={item.item_id}
              className="rounded-2xl border border-[color:var(--border)] overflow-hidden"
            >
              {/* Item Header */}
              <button
                type="button"
                onClick={() => toggleItem(item.item_id)}
                aria-expanded={expandedItems.has(item.item_id)}
                aria-label={
                  expandedItems.has(item.item_id)
                    ? t('builder.regenerate.diffPreview.collapseItem', { item: getItemLabel(item) })
                    : t('builder.regenerate.diffPreview.expandItem', { item: getItemLabel(item) })
                }
                className="w-full p-4 flex items-center justify-between bg-[var(--surface-muted)] hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getItemIcon(item.item_type)}
                  <span className="text-sm font-semibold uppercase tracking-[0.2em] truncate">
                    {getItemLabel(item)}
                  </span>
                </div>
                {expandedItems.has(item.item_id) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {/* Item Diff Content */}
              {expandedItems.has(item.item_id) && (
                <div className="border-t border-[color:var(--border)]">
                  {/* Change Summary */}
                  {item.diff_summary && (
                    <div className="p-3 border-b border-[color:var(--border)]">
                      <p className="text-xs text-[var(--primary)]">{item.diff_summary}</p>
                    </div>
                  )}

                  {/* Original Content */}
                  <div className="p-4 border-b border-[color:var(--border)]">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)] mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-600 border border-[color:var(--border)]" />
                      {t('builder.regenerate.diffPreview.originalLabel')}
                    </div>
                    <div className="rounded-xl border border-[color:var(--border)] bg-white p-3 space-y-1">
                      {item.original_content.length > 0 ? (
                        item.original_content.map((content, idx) => (
                          <p key={idx} className="text-sm text-red-700 line-through">
                            <span className="mr-2">−</span>
                            {content}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-[color:var(--text-subtle)] italic">
                          {t('builder.regenerate.diffPreview.noContent')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* New Content */}
                  <div className="p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)] mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-600 border border-[color:var(--border)]" />
                      {t('builder.regenerate.diffPreview.newLabel')}
                    </div>
                    <div className="rounded-xl border border-[color:var(--border)] bg-white p-3 space-y-1">
                      {item.new_content.length > 0 ? (
                        item.new_content.map((content, idx) => (
                          <p key={idx} className="text-sm text-emerald-700">
                            <span className="mr-2">+</span>
                            {content}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-[color:var(--text-subtle)] italic">
                          {t('builder.regenerate.diffPreview.noContent')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="p-4 bg-[var(--surface-muted)] border-t border-[color:var(--border)] flex-row justify-between gap-3">
          <Button variant="outline" onClick={onReject} disabled={isApplying} className="rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('builder.regenerate.diffPreview.rejectButton')}
          </Button>
          <Button variant="success" onClick={onAccept} disabled={isApplying} className="rounded-xl">
            {isApplying ? (
              <>
                <span className="animate-spin mr-2">
                  <Check className="w-4 h-4" />
                </span>
                {t('builder.regenerate.diffPreview.applying')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t('builder.regenerate.diffPreview.acceptButton')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegenerateDiffPreview;
