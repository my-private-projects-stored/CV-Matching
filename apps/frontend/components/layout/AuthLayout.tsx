import type { ReactNode } from 'react';
import { uiText } from '@/lib/constants/ui-text';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="grid min-h-screen lg:grid-cols-[52%_48%]">
        <section className="relative hidden overflow-hidden bg-[var(--blue-900)] text-white lg:block">
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, rgba(201,168,76,0.2), transparent 40%), radial-gradient(circle at 80% 10%, rgba(37,99,235,0.25), transparent 45%), radial-gradient(circle at 50% 80%, rgba(29,78,216,0.18), transparent 45%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          </div>
          <div className="relative flex h-full flex-col justify-between p-10">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--gold)] font-mono text-sm font-semibold text-[var(--blue-900)]">
                CV
              </span>
              <div>
                <p className="text-sm font-semibold">{uiText.appName}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                  {uiText.appSubtitle}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div
                className="w-64 rounded-2xl border border-white/20 bg-white/10 p-4 shadow"
                style={{ animation: 'bob 4s ease-in-out infinite' }}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">AI Score</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Semantic</span>
                    <span className="font-mono">0.82</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/20">
                    <div className="h-1.5 w-3/4 rounded-full bg-[var(--blue-600)]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Keyword</span>
                    <span className="font-mono">0.65</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/20">
                    <div className="h-1.5 w-2/3 rounded-full bg-[var(--success)]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Hybrid</span>
                    <span className="font-mono">0.76</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/20">
                    <div className="h-1.5 w-4/5 rounded-full bg-[var(--gold)]" />
                  </div>
                </div>
              </div>
              <div>
                <span className="inline-flex items-center rounded-full border border-[var(--gold-border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--gold)]">
                  AI-Powered Recruitment
                </span>
                <h1 className="mt-4 max-w-md font-display text-4xl">
                  Connect talent with <span className="italic text-[var(--gold)]">opportunity</span>{' '}
                  intelligently.
                </h1>
                <p className="mt-3 max-w-md text-sm text-white/60">
                  Hybrid SBERT + BM25 engine to rank candidates and guide improvements.
                </p>
                <div className="mt-6 flex gap-4 text-xs text-white/60">
                  <span>98% Accuracy</span>
                  <span className="h-4 w-px bg-white/20" />
                  <span>3x Faster</span>
                  <span className="h-4 w-px bg-white/20" />
                  <span>SBERT+BM25</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </div>
    </div>
  );
}
