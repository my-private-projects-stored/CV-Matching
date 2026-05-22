'use client';

import { Button } from '@/components/ui/button';
import { Check, X, Briefcase, FolderKanban } from 'lucide-react';
import type { EnhancedDescription } from '@/lib/api/enrichment';
import { useTranslations } from '@/lib/i18n';

interface PreviewStepProps {
  enhancements: EnhancedDescription[];
  onApply: () => void;
  onCancel: () => void;
}

export function PreviewStep({ enhancements, onApply, onCancel }: PreviewStepProps) {
  const { t } = useTranslations();
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{t('enrichment.preview.title')}</h2>
        <p className="text-[color:var(--text-subtle)] text-sm">
          {t('enrichment.preview.description')}
        </p>
      </div>

      {/* Enhancements list */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {enhancements.map((enhancement) => (
          <EnhancementCard key={enhancement.item_id} enhancement={enhancement} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-[color:var(--border)] mt-6">
        <Button variant="outline" onClick={onCancel} className="gap-2">
          <X className="w-4 h-4" />
          {t('common.cancel')}
        </Button>
        <Button onClick={onApply} className="gap-2">
          <Check className="w-4 h-4" />
          {t('enrichment.preview.applyButton')}
        </Button>
      </div>
    </div>
  );
}

interface EnhancementCardProps {
  enhancement: EnhancedDescription;
}

function EnhancementCard({ enhancement }: EnhancementCardProps) {
  const { t } = useTranslations();
  const itemTypeLabel =
    enhancement.item_type === 'experience'
      ? t('enrichment.itemType.experience')
      : t('enrichment.itemType.project');

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-white shadow-[0_16px_28px_rgba(15,27,45,0.12)]">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--border)] bg-[var(--surface-muted)]">
        {enhancement.item_type === 'experience' ? (
          <Briefcase className="w-4 h-4" />
        ) : (
          <FolderKanban className="w-4 h-4" />
        )}
        <span className="text-sm font-semibold uppercase tracking-[0.2em]">{itemTypeLabel}</span>
        <span className="text-[color:var(--text-subtle)]">|</span>
        <span className="font-semibold">{enhancement.title}</span>
      </div>

      {/* Content preview */}
      <div className="p-4">
        <div className="space-y-4">
          {/* Existing bullets - keeping */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]">
                {t('enrichment.preview.keepingLabel')}
              </span>
              <span className="text-xs text-[color:var(--text-subtle)]">
                {t('enrichment.preview.existingCount', {
                  count: enhancement.original_description.length,
                })}
              </span>
            </div>
            <ul className="space-y-2">
              {enhancement.original_description.map((bullet, i) => (
                <li
                  key={i}
                  className="text-sm text-[var(--foreground)] pl-4 border-l-2 border-[color:var(--border)]"
                >
                  {bullet}
                </li>
              ))}
              {enhancement.original_description.length === 0 && (
                <li className="text-sm text-[color:var(--text-subtle)] italic">
                  {t('enrichment.preview.noExistingDescription')}
                </li>
              )}
            </ul>
          </div>

          {/* New bullets - adding */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                {t('enrichment.preview.addingLabel')}
              </span>
              <span className="text-xs text-emerald-700">
                {t('enrichment.preview.newCount', {
                  count: enhancement.enhanced_description.length,
                })}
              </span>
            </div>
            <ul className="space-y-2">
              {enhancement.enhanced_description.map((bullet, i) => (
                <li
                  key={i}
                  className="text-sm text-[var(--foreground)] pl-4 border-l-2 border-emerald-500 bg-emerald-50 py-1 pr-2"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
