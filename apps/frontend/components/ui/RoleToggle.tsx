import { cn } from '@/lib/utils';

export function RoleToggle({
  value,
  onChange,
}: {
  value: 'candidate' | 'recruiter';
  onChange: (value: 'candidate' | 'recruiter') => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full border border-[var(--border)] bg-white p-1">
      {(['candidate', 'recruiter'] as const).map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange(role)}
          className={cn(
            'rounded-full px-3 py-2 text-sm font-semibold',
            value === role ? 'bg-[var(--blue-700)] text-white' : 'text-[var(--text-2)]'
          )}
        >
          {role === 'candidate' ? 'Candidate' : 'Recruiter'}
        </button>
      ))}
    </div>
  );
}
