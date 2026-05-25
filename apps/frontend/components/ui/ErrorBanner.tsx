import { cn } from '@/lib/utils';

export function ErrorBanner({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-[var(--danger)]',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-[var(--danger)]"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
