import { cn } from '@/lib/utils';

export function ScoreBar({
  label,
  value,
  color,
  className,
}: {
  label: string;
  value: number;
  color: string;
  className?: string;
}) {
  const percent = Math.round(value * 100);
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-xs text-[var(--text-2)]">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--blue-50)]">
        <div
          className="h-2 rounded-full"
          style={{
            width: `${percent}%`,
            backgroundColor: color,
            animation: 'barGrow 1.5s ease 0.8s both',
          }}
        />
      </div>
    </div>
  );
}
