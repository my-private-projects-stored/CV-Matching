import { cn } from '@/lib/utils';

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-12 w-full rounded-lg bg-slate-100', className)}
      style={{
        backgroundImage: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '400% auto',
        animation: 'shimmer 1.5s linear infinite',
      }}
    />
  );
}
