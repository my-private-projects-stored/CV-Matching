import type { AiStatus } from '@/types';
import { cn } from '@/lib/utils';

const labelMap: Record<AiStatus, string> = {
  pending: 'Waiting to process',
  parsing: 'Analyzing resume',
  scoring: 'Computing score',
  completed: 'Completed',
  failed: 'Failed',
};

export function AiStatusIndicator({ status, className }: { status: AiStatus; className?: string }) {
  if (status === 'completed') return null;
  return (
    <div className={cn('rounded-lg border border-[var(--border)] bg-white p-4', className)}>
      <div className="flex items-center justify-between text-sm text-[var(--text-2)]">
        <span>{labelMap[status]}</span>
        <span className="font-mono text-xs">{status.toUpperCase()}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[var(--blue-50)]">
        <div
          className="h-2 w-1/2 rounded-full bg-[var(--blue-700)]"
          style={{
            animation: 'shimmer 1.4s linear infinite',
            backgroundImage: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
            backgroundSize: '200% auto',
          }}
        />
      </div>
      {status === 'failed' ? (
        <p className="mt-2 text-xs text-[var(--danger)]">Please retry.</p>
      ) : null}
    </div>
  );
}
