import { cn } from '@/lib/utils';

export function KeywordBadge({ label, type }: { label: string; type: 'matched' | 'missing' }) {
  const isMatched = type === 'matched';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        isMatched ? 'bg-green-50 text-[var(--success)]' : 'bg-red-50 text-[var(--danger)]'
      )}
    >
      {label}
    </span>
  );
}
