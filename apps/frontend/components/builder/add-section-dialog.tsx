'use client';

import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, FileText, List, ListOrdered } from 'lucide-react';
import type { SectionType } from '@/components/dashboard/resume-component';
import { useTranslations } from '@/lib/i18n';

interface AddSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (displayName: string, sectionType: SectionType) => void;
}

type SelectableSectionType = Exclude<SectionType, 'personalInfo'>;

/**
 * AddSectionDialog Component
 *
 * Dialog for creating new custom sections.
 * Allows user to enter a name and select a section type.
 */
export const AddSectionDialog: React.FC<AddSectionDialogProps> = ({
  open,
  onOpenChange,
  onAdd,
}) => {
  const { t } = useTranslations();
  const [displayName, setDisplayName] = useState('');
  const [sectionType, setSectionType] = useState<SelectableSectionType>('text');

  const handleSubmit = () => {
    if (displayName.trim()) {
      onAdd(displayName.trim(), sectionType);
      setDisplayName('');
      setSectionType('text');
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && displayName.trim()) {
      handleSubmit();
    }
  };

  const sectionTypes: {
    type: SelectableSectionType;
    label: string;
    icon: React.ReactNode;
    description: string;
  }[] = [
    {
      type: 'text',
      label: t('builder.customSections.sectionTypes.textBlockLabel'),
      icon: <FileText className="w-5 h-5" />,
      description: t('builder.customSections.sectionTypes.textBlockDescription'),
    },
    {
      type: 'itemList',
      label: t('builder.customSections.sectionTypes.itemListLabel'),
      icon: <ListOrdered className="w-5 h-5" />,
      description: t('builder.customSections.sectionTypes.itemListDescription'),
    },
    {
      type: 'stringList',
      label: t('builder.customSections.sectionTypes.stringListLabel'),
      icon: <List className="w-5 h-5" />,
      description: t('builder.customSections.sectionTypes.stringListDescription'),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0">
        <DialogHeader className="border-b border-[color:var(--border)] p-6 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {t('builder.customSections.dialogTitle')}
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs">
            {t('builder.customSections.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Section Name */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.2em]">
              {t('builder.customSections.sectionNameLabel')}
            </Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('builder.customSections.sectionNamePlaceholder')}
              autoFocus
            />
          </div>

          {/* Section Type */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-[0.2em]">
              {t('builder.customSections.sectionTypeLabel')}
            </Label>
            <div className="space-y-2">
              {sectionTypes.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSectionType(item.type)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    sectionType === item.type
                      ? 'border-[color:var(--primary)] bg-[var(--surface-muted)] shadow-[0_12px_24px_rgba(15,27,45,0.14)]'
                      : 'border-[color:var(--border)] hover:bg-[var(--surface-muted)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-lg border p-2 ${
                        sectionType === item.type
                          ? 'border-[color:var(--primary)] bg-white text-[var(--primary)]'
                          : 'border-[color:var(--border)] bg-[var(--surface-muted)] text-[color:var(--text-subtle)]'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-sans font-medium text-sm">{item.label}</div>
                      <div className="mt-0.5 text-xs text-[color:var(--text-subtle)]">
                        {item.description}
                      </div>
                    </div>
                    {sectionType === item.type && (
                      <div className="h-4 w-4 rounded-full border border-[color:var(--primary)] bg-[var(--primary)]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-3 border-t border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
          <DialogClose asChild>
            <Button variant="outline">{t('common.cancel')}</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!displayName.trim()}>
            <Plus className="w-4 h-4 mr-2" />
            {t('builder.addSection')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * AddSectionButton Component
 *
 * Button that triggers the AddSectionDialog.
 */
interface AddSectionButtonProps {
  onAdd: (displayName: string, sectionType: SectionType) => void;
}

export const AddSectionButton: React.FC<AddSectionButtonProps> = ({ onAdd }) => {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-[color:var(--border)] py-6 hover:bg-[var(--surface-muted)]"
      >
        <Plus className="w-5 h-5 mr-2" />
        {t('builder.customSections.addCustomSectionButton')}
      </Button>
      <AddSectionDialog open={open} onOpenChange={setOpen} onAdd={onAdd} />
    </>
  );
};
