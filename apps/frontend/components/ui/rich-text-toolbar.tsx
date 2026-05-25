'use client';

import React from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Link } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';

interface RichTextToolbarProps {
  editor: Editor;
  onLinkClick: () => void;
}

/**
 * Rich Text Toolbar Component
 *
 * Swiss International Style formatting toolbar with B/I/U/Link buttons.
 * Active states shown with Hyper Blue background.
 */
export const RichTextToolbar: React.FC<RichTextToolbarProps> = ({ editor, onLinkClick }) => {
  const { t } = useTranslations();
  const tools = [
    {
      icon: Bold,
      label: t('editor.bold'),
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      shortcut: 'Ctrl+B',
    },
    {
      icon: Italic,
      label: t('editor.italic'),
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      shortcut: 'Ctrl+I',
    },
    {
      icon: Underline,
      label: t('editor.underline'),
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      shortcut: 'Ctrl+U',
    },
    {
      icon: Link,
      label: t('editor.link'),
      action: onLinkClick,
      isActive: editor.isActive('link'),
      shortcut: 'Ctrl+K',
    },
  ];

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-1">
      {tools.map((tool) => (
        <Button
          key={tool.label}
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            tool.action();
          }}
          title={`${tool.label} (${tool.shortcut})`}
          className={cn(
            'h-7 w-7 rounded-lg',
            tool.isActive && 'bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]'
          )}
        >
          <tool.icon className="w-4 h-4" />
        </Button>
      ))}
    </div>
  );
};
