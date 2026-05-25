import type { Application } from '@/types';
import { StatusBadge } from './StatusBadge';
import { AiStatusBadge } from './AiStatusBadge';
import { ScoreBar } from './ScoreBar';

export function CandidateRow({
  application,
  onReview,
}: {
  application: Application & { name: string; role: string; location: string };
  onReview?: () => void;
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-[var(--border)] bg-white p-4 md:grid-cols-[1fr_160px_160px_140px] md:items-center">
      <div>
        <p className="text-sm font-semibold text-[var(--text-1)]">{application.name}</p>
        <p className="text-xs text-[var(--text-2)]">
          {application.role} · {application.location}
        </p>
      </div>
      <ScoreBar label="Hybrid" value={application.aiScores.hybridScore} color="var(--gold)" />
      <div className="flex flex-wrap gap-2">
        <AiStatusBadge status={application.aiStatus} />
        <StatusBadge status={application.status} />
      </div>
      <div className="flex justify-end">
        {onReview ? (
          <button
            type="button"
            onClick={onReview}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold"
          >
            Review
          </button>
        ) : null}
      </div>
    </div>
  );
}
