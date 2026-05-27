import { cn } from '@/lib/utils';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'primary',
  disabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: 'primary' | 'danger';
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-[var(--text-1)]">{title}</h2>
        {description ? <p className="mt-2 text-sm text-[var(--text-2)]">{description}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className={cn(
              'rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60'
            )}
            onClick={onCancel}
            disabled={disabled}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60',
              confirmVariant === 'danger' ? 'bg-[var(--danger)]' : 'bg-[var(--blue-700)]'
            )}
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
