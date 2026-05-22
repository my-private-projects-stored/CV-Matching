import type { LucideIcon } from 'lucide-react';
import BrainCircuit from 'lucide-react/dist/esm/icons/brain-circuit';
import BriefcaseBusiness from 'lucide-react/dist/esm/icons/briefcase-business';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Network from 'lucide-react/dist/esm/icons/network';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import UsersRound from 'lucide-react/dist/esm/icons/users-round';

type PlatformHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  compact?: boolean;
};

type FlowItem = {
  label: string;
  description: string;
  icon: LucideIcon;
};

const FLOW_ITEMS: FlowItem[] = [
  {
    label: 'Ứng viên',
    description: 'CV, hồ sơ, lịch sử ứng tuyển',
    icon: FileText,
  },
  {
    label: 'AI đánh giá',
    description: 'Embedding, từ khóa, hybridScore',
    icon: BrainCircuit,
  },
  {
    label: 'Doanh nghiệp',
    description: 'JD, danh sách chọn lọc, quy trình tuyển dụng',
    icon: BriefcaseBusiness,
  },
];

export function PlatformHero({ eyebrow, title, description, actions, compact = false }: PlatformHeroProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-blue-900/10 bg-[var(--blue-900)] text-white shadow-[var(--shadow-elev-2)]">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className={compact ? 'p-6 md:p-8' : 'p-7 md:p-10'}>
          <div className="inline-flex items-center gap-2 rounded-[7px] border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {eyebrow}
          </div>
          <h1 className="mt-5 max-w-3xl font-[var(--font-display)] text-[36px] font-normal leading-[1.02] md:text-[52px]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
            {description}
          </p>
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {FLOW_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border border-white/15 bg-white/10 p-4">
                  <Icon className="h-5 w-5 text-[var(--gold)]" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/[0.06] p-6 md:p-8 lg:border-l lg:border-t-0">
          <div className="rounded-xl border border-white/15 bg-white p-4 text-slate-950 shadow-[0_22px_60px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <Network className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Bộ máy ghép nối ứng viên</p>
                  <p className="text-xs text-slate-500">Xếp hạng bằng hybridScore</p>
                </div>
              </div>
              <span className="rounded-[7px] bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                Phù hợp cao
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {[
                ['Độ tương đồng ngữ nghĩa', 84, 'bg-blue-600'],
                ['Độ phủ từ khóa', 73, 'bg-cyan-600'],
                ['Điểm hybrid', 80, 'bg-green-600'],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500">{label}</span>
                    <span className="metric-number font-semibold">{value}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <UsersRound className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-slate-500">Danh sách chọn lọc</p>
                <p className="metric-number text-xl font-semibold">24</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <BrainCircuit className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-slate-500">AI hoàn tất</p>
                <p className="metric-number text-xl font-semibold">91%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
