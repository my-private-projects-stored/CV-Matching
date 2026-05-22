type PlatformModuleHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PlatformModuleHeader({
  eyebrow,
  title,
  description,
  children,
}: PlatformModuleHeaderProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-white shadow-[var(--shadow-elev-1)]">
      <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
        <div className="p-5 md:p-6">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-[var(--font-display)] text-[34px] font-normal leading-[0.98] text-[var(--foreground)] md:text-[44px]">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            {description}
          </p>
          {children ? <div className="mt-5 flex flex-wrap gap-2">{children}</div> : null}
        </div>

        <div className="border-t border-[color:var(--border)] bg-blue-50/80 p-5 text-[var(--blue-900)] lg:border-l lg:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Đánh giá bằng AI</p>
          <p className="mt-2 text-sm leading-5">
            Ứng viên được kết nối với doanh nghiệp bằng phân tích CV, JD và thuật toán
            hybridScore.
          </p>
          <div className="mt-4 space-y-3">
            {[
              ['Ngữ nghĩa', 'Vector SBERT'],
              ['Từ khóa', 'Độ phủ BM25'],
              ['Xếp hạng', 'hybridScore giảm dần'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-[7px] border border-blue-100 bg-white/75 px-3 py-2"
              >
                <span className="text-xs font-semibold">{label}</span>
                <span className="text-xs text-[color:var(--text-muted)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
