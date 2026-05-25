import { scoreColor, scoreLabel } from '@/lib/utils';
import { ScoreBar } from './ScoreBar';
import { KeywordBadge } from './KeywordBadge';

export function AiScoreWidget({
  semanticScore,
  keywordScore,
  hybridScore,
  matchedKeywords,
  missingKeywords,
}: {
  semanticScore: number;
  keywordScore: number;
  hybridScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
}) {
  const ringScore = Math.round(hybridScore * 100);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (ringScore / 100) * circumference;
  const color = scoreColor(hybridScore);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow">
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="45" stroke="#e2e8f0" strokeWidth="8" fill="none" />
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={color}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-semibold tabular-nums">{ringScore}</span>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">/100</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {scoreLabel(hybridScore)}
            </span>
            <span className="text-sm text-[var(--text-2)]">Hybrid score</span>
          </div>
          <ScoreBar label="Semantic" value={semanticScore} color="var(--blue-600)" />
          <ScoreBar label="Keyword" value={keywordScore} color="var(--success)" />
          <ScoreBar label="Hybrid" value={hybridScore} color="var(--gold)" />
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--success)]">
            Matched keywords
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {matchedKeywords.map((item) => (
              <KeywordBadge key={item} label={item} type="matched" />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--danger)]">
            Missing keywords
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingKeywords.map((item) => (
              <KeywordBadge key={item} label={item} type="missing" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
