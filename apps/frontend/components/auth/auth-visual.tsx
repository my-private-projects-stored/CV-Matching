import Link from 'next/link';

type AuthVisualProps = {
  mode: 'login' | 'signup';
  children: React.ReactNode;
};

const SCORE_ROWS = [
  { label: 'Ngữ nghĩa', value: '0.82', width: '82%', color: '#60a5fa' },
  { label: 'Từ khóa', value: '0.65', width: '65%', color: '#34d399' },
  { label: 'Hybrid', value: '0.76', width: '76%', color: '#c9a84c' },
];

export function AuthVisual({ mode, children }: AuthVisualProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f7f4] text-[#0f172a]">
      <div className="grid min-h-screen lg:grid-cols-[52fr_48fr]">
        <section className="auth-brand-panel">
          <div className="auth-grid-overlay" />
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
          <div className="auth-orb auth-orb-3" />

          <div className="relative z-10 flex min-h-full flex-col">
            <Link href="/" className="flex items-center gap-3" aria-label="Trang chủ CV Matching">
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-[var(--gold)] font-[var(--font-display)] text-[17px] text-[var(--blue-900)]">
                CV
              </span>
              <span>
                <span className="block text-[15px] font-semibold leading-tight text-white">
                  CV Matching
                </span>
                <span className="block text-[10px] uppercase tracking-[0.06em] text-white/40">
                  Recruitment Platform
                </span>
              </span>
            </Link>

            <div className="auth-score-card">
              <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">
                <span className="auth-score-dot" />
                AI Match Score
              </div>
              <div className="space-y-2">
                {SCORE_ROWS.map((row) => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[11px] text-white/50">{row.label}</span>
                    <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="auth-score-fill block h-full rounded-full"
                        style={{ width: row.width, backgroundColor: row.color }}
                      />
                    </span>
                    <span className="metric-number w-8 text-right text-[11px] font-medium text-white">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 mt-auto max-w-[520px] pb-2">
              <div className="mb-5 inline-flex rounded-full border border-[rgba(201,168,76,0.28)] bg-[var(--gold-dim)] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--gold)]">
                AI-Powered Recruitment
              </div>
              <h1 className="font-[var(--font-display)] text-[46px] font-normal leading-[1.08] text-white md:text-[54px]">
                Kết nối nhân tài với{' '}
                <em className="font-normal italic text-[var(--gold)]">cơ hội</em>
                <br />
                bằng trí tuệ tuyển dụng.
              </h1>
              <p className="mt-5 max-w-[420px] text-sm leading-7 text-white/55">
                Bộ máy hybrid AI chấm điểm ứng viên theo JD bằng SBERT, BM25 và hybridScore để rút
                ngắn sàng lọc nhưng vẫn giữ tín hiệu minh bạch.
              </p>

              <div className="mt-9 flex flex-wrap gap-7">
                {[
                  ['98', '%', 'Độ chính xác ghép nối'],
                  ['3', 'x', 'Sàng lọc nhanh hơn'],
                  ['SBERT', '', '+ BM25 engine'],
                ].map(([value, suffix, label], index) => (
                  <div key={label} className="flex items-stretch gap-7">
                    {index > 0 ? <span className="w-px bg-white/10" /> : null}
                    <div>
                      <p className="font-[var(--font-display)] text-[28px] leading-none text-white">
                        {value}
                        {suffix ? <sup className="text-base text-[var(--gold)]">{suffix}</sup> : null}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.06em] text-white/40">
                        {label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-[52px]">
          <div className="absolute right-6 top-6 flex items-center gap-3 text-sm text-[#475569] sm:right-9">
            <span className="rounded-md border border-[#e2e8f0] px-2.5 py-1 text-xs">VI / EN</span>
            <span>
              {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
              <Link
                href={mode === 'login' ? '/signup' : '/login'}
                className="font-semibold text-[#2563eb]"
              >
                {mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}
              </Link>
            </span>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
