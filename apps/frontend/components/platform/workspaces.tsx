'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ArrowDownToLine from 'lucide-react/dist/esm/icons/arrow-down-to-line';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import CircleAlert from 'lucide-react/dist/esm/icons/circle-alert';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Mail from 'lucide-react/dist/esm/icons/mail';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import UserRound from 'lucide-react/dist/esm/icons/user-round';
import WandSparkles from 'lucide-react/dist/esm/icons/wand-sparkles';
import X from 'lucide-react/dist/esm/icons/x';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { forgotPassword, resetPassword, type UserRole } from '@/lib/api/auth';
import { useAuth } from '@/lib/context/auth-context';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';
type PipelineStatus = 'new' | 'screening' | 'interview' | 'hired' | 'rejected';
type ScoreBand = 'Rất phù hợp' | 'Có tiềm năng' | 'Chưa phù hợp';

const candidates = [
  {
    id: 'app-1082',
    name: 'Maya Tran',
    title: 'Kỹ sư Frontend cấp cao',
    location: 'TP. Hồ Chí Minh',
    hybridScore: 92,
    semanticScore: 0.88,
    keywordScore: 0.74,
    status: 'interview' as PipelineStatus,
  },
  {
    id: 'app-1034',
    name: 'Daniel Pham',
    title: 'Kỹ sư sản phẩm AI',
    location: 'Đà Nẵng',
    hybridScore: 84,
    semanticScore: 0.82,
    keywordScore: 0.69,
    status: 'screening' as PipelineStatus,
  },
  {
    id: 'app-987',
    name: 'Linh Nguyen',
    title: 'Lập trình viên Full Stack',
    location: 'Hà Nội',
    hybridScore: 71,
    semanticScore: 0.73,
    keywordScore: 0.62,
    status: 'new' as PipelineStatus,
  },
  {
    id: 'app-944',
    name: 'Jordan Lee',
    title: 'Kỹ sư nền tảng',
    location: 'Từ xa',
    hybridScore: 48,
    semanticScore: 0.52,
    keywordScore: 0.41,
    status: 'rejected' as PipelineStatus,
  },
];

const statusStyles: Record<PipelineStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  screening: 'bg-amber-50 text-[var(--warning)]',
  interview: 'bg-cyan-50 text-[var(--info)]',
  hired: 'bg-green-50 text-[var(--success)]',
  rejected: 'bg-red-50 text-[var(--danger)]',
};

const pipelineLabels: Record<PipelineStatus, string> = {
  new: 'Mới',
  screening: 'Sàng lọc',
  interview: 'Phỏng vấn',
  hired: 'Đã tuyển',
  rejected: 'Từ chối',
};

function scoreBand(score: number): { label: ScoreBand; className: string; color: string } {
  if (score >= 75) {
    return {
      label: 'Rất phù hợp',
      className: 'bg-green-50 text-[var(--success)]',
      color: 'var(--success)',
    };
  }
  if (score >= 50) {
    return {
      label: 'Có tiềm năng',
      className: 'bg-amber-50 text-[var(--warning)]',
      color: 'var(--warning)',
    };
  }
  return {
    label: 'Chưa phù hợp',
    className: 'bg-red-50 text-[var(--danger)]',
    color: 'var(--danger)',
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function AuthVisual() {
  return (
    <section className="relative hidden min-h-screen overflow-hidden bg-[var(--blue-900)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute left-[-12%] top-[-16%] h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(201,168,76,.36),transparent_65%)]" />
      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-white font-mono text-sm font-bold text-[var(--blue-900)]">
          CV
        </span>
        <div>
          <p className="font-bold">CV Matching</p>
          <p className="text-sm text-white/65">Trí tuệ tuyển dụng SBERT + BM25</p>
        </div>
      </div>
      <div className="relative max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
          Tuyển dụng đôi bên cùng thắng
        </p>
        <h1 className="mt-5 font-display text-6xl leading-[0.96]">
          Mở lối rõ ràng hơn cho <span className="italic text-[var(--gold)]">nhân tài</span> và
          quyết định chính xác hơn cho doanh nghiệp.
        </h1>
        <div className="mt-9 max-w-sm rounded-[14px] border border-white/15 bg-slate-950/50 p-5 shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/75">Tiềm năng phù hợp hybrid</p>
            <span className="rounded-full bg-[var(--gold-dim)] px-3 py-1 font-mono text-xs text-[var(--gold)]">
              0.65 AI
            </span>
          </div>
          <p className="mt-4 font-mono text-5xl font-bold">92%</p>
          <div className="mt-5 space-y-3">
            {[
              ['Ngữ nghĩa SBERT', 88],
              ['Từ khóa BM25', 74],
              ['Xếp hạng hybrid', 92],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs text-white/65">
                  <span>{label}</span>
                  <span>{value}%</span>
                </div>
                <span className="block h-2 rounded-full bg-white/12">
                  <span
                    className="block h-2 rounded-full bg-[var(--gold)]"
                    style={{ width: `${value}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="relative max-w-xl text-sm leading-6 text-white/68">
        Tối ưu CV cho ứng viên, bảng xếp hạng ứng viên cho nhà tuyển dụng và cấu hình nhà cung cấp
        AI cho quản trị viên trong một nền tảng thống nhất.
      </p>
    </section>
  );
}

export function AuthWorkspace({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [role, setRole] = useState<UserRole>('candidate');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const nextPath = searchParams.get('next')?.startsWith('/')
    ? searchParams.get('next')!
    : '/dashboard';
  const title =
    mode === 'login'
      ? 'Chào mừng trở lại'
      : mode === 'forgot'
        ? 'Khôi phục truy cập'
        : mode === 'reset'
          ? 'Tạo mật khẩu mới'
          : 'Tạo không gian làm việc';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'login') {
        await signIn({ email: email.trim(), password });
        router.replace(nextPath);
        return;
      }
      if (mode === 'signup') {
        await signUp({ email: email.trim(), password, full_name: fullName.trim(), role });
        router.replace('/dashboard');
        return;
      }
      if (mode === 'forgot') {
        const result = await forgotPassword(email.trim());
        setMessage(result.message || 'Hướng dẫn đặt lại mật khẩu đã sẵn sàng.');
        if (result.reset_token)
          router.push(`/reset-password?token=${encodeURIComponent(result.reset_token)}`);
        return;
      }
      if (password !== confirmPassword) {
        setError('Hai mật khẩu không khớp.');
        return;
      }
      const result = await resetPassword({ token: token.trim(), new_password: password });
      setMessage(result.message || 'Đã cập nhật mật khẩu. Bạn có thể đăng nhập ngay.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác thực thất bại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
        <AuthVisual />
        <section className="flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-md">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--blue-700)]">
              CV Matching
            </p>
            <h2 className="mt-3 font-display text-5xl leading-none text-[var(--text-1)]">
              {title}
            </h2>
            <p className="mt-4 text-sm leading-6 text-[var(--text-2)]">
              Chọn vai trò để vào đúng không gian làm việc: tối ưu CV cho ứng viên hoặc xếp hạng ứng
              viên bằng AI cho nhà tuyển dụng.
            </p>
            {(mode === 'login' || mode === 'signup') && (
              <div className="mt-6 grid grid-cols-2 gap-2 rounded-[8px] border border-[color:var(--border)] bg-white p-1">
                {(['candidate', 'recruiter'] as UserRole[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRole(item)}
                    className={`rounded-[7px] px-3 py-3 text-left text-sm font-bold transition ${role === item ? 'bg-[var(--blue-700)] text-white' : 'text-[var(--text-2)] hover:bg-slate-50'}`}
                  >
                    {item === 'candidate' ? 'Ứng viên' : 'Nhà tuyển dụng'}
                    <span className="mt-1 block text-xs font-medium opacity-75">
                      {item === 'candidate'
                        ? 'CV, đối sánh, phản hồi'
                        : 'Tin tuyển dụng, xếp hạng, pipeline'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">
                    Họ và tên
                  </span>
                  <span className="relative block">
                    <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
                    <Input
                      className="pl-10"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </span>
                </label>
              )}
              {mode === 'reset' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">
                    Mã đặt lại mật khẩu
                  </span>
                  <Input value={token} onChange={(e) => setToken(e.target.value)} required />
                </label>
              )}
              {mode !== 'reset' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">Email</span>
                  <span className="relative block">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
                    <Input
                      className="pl-10"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </span>
                </label>
              )}
              {mode !== 'forgot' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">
                    Mật khẩu
                  </span>
                  <span className="relative block">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
                    <Input
                      className="pl-10 pr-10"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-2)]"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label="Bật tắt hiển thị mật khẩu"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>
              )}
              {mode === 'reset' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">
                    Xác nhận mật khẩu
                  </span>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </label>
              )}
              {error && (
                <p className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-[var(--danger)]">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-[8px] border border-green-200 bg-green-50 p-3 text-sm text-[var(--success)]">
                  {message}
                </p>
              )}
              <Button className="w-full" size="lg" type="submit" disabled={submitting}>
                {submitting
                  ? 'Đang xử lý...'
                  : mode === 'login'
                    ? 'Đăng nhập'
                    : mode === 'forgot'
                      ? 'Gửi liên kết đặt lại'
                      : mode === 'reset'
                        ? 'Cập nhật mật khẩu'
                        : 'Tạo tài khoản'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            <div className="mt-5 flex justify-between text-sm font-semibold text-[var(--text-2)]">
              <Link href="/login" className="hover:text-[var(--blue-700)]">
                Đăng nhập
              </Link>
              <Link href="/signup" className="hover:text-[var(--blue-700)]">
                Đăng ký
              </Link>
              <Link href="/forgot-password" className="hover:text-[var(--blue-700)]">
                Đặt lại mật khẩu
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function MatchScoreWidget({
  hybridScore = 82,
  semanticScore = 0.82,
  keywordScore = 0.65,
}: {
  hybridScore?: number;
  semanticScore?: number;
  keywordScore?: number;
}) {
  const band = scoreBand(hybridScore);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (hybridScore / 100) * circumference;
  const matched = ['React', 'Next.js', 'TypeScript', 'UI dễ truy cập'];
  const missing = ['Playwright', 'Giám sát hàng đợi', 'Design tokens'];

  return (
    <section className="rounded-[12px] border border-[color:var(--border)] bg-white p-5 shadow-[var(--shadow-elev-1)]">
      <div className="flex items-start gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full -rotate-90"
            aria-label={`Điểm hybrid ${hybridScore}%`}
          >
            <circle cx="50" cy="50" r="45" stroke="#e2e8f0" strokeWidth="8" fill="none" />
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={band.color}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold text-[var(--text-1)]">
              {hybridScore}%
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">
              Hybrid
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--text-1)]">Điểm phù hợp AI</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${band.className}`}>
              {band.label}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ['Ngữ nghĩa', semanticScore],
              ['Từ khóa', keywordScore],
              ['Hybrid', hybridScore / 100],
            ].map(([label, value]) => {
              const percent = Math.round(Number(value) * 100);
              return (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--text-2)]">
                    <span>{label}</span>
                    <span className="font-mono">
                      {label === 'Hybrid' ? `${hybridScore}%` : Number(value).toFixed(2)}
                    </span>
                  </div>
                  <span className="block h-2 rounded-full bg-slate-100">
                    <span
                      className="block h-2 rounded-full bg-[var(--blue-700)]"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <details className="mt-5 rounded-[8px] border border-[color:var(--border)] p-4" open>
        <summary className="cursor-pointer text-sm font-bold text-[var(--text-1)]">
          Từ khóa đã khớp và còn thiếu
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--success)]">
              Từ khóa đã khớp
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {matched.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-[var(--success)]"
                >
                  <Check className="h-3 w-3" /> {item}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--danger)]">
              Từ khóa còn thiếu
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {missing.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-[var(--danger)]"
                >
                  <X className="h-3 w-3" /> {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

export function RecruiterDashboard() {
  const [statusFilter, setStatusFilter] = useState<'all' | PipelineStatus>('all');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'strong' | 'potential'>('all');
  const visible = useMemo(
    () =>
      candidates
        .filter((item) => statusFilter === 'all' || item.status === statusFilter)
        .filter(
          (item) =>
            scoreFilter === 'all' ||
            (scoreFilter === 'strong' ? item.hybridScore >= 75 : item.hybridScore >= 50)
        )
        .sort((a, b) => b.hybridScore - a.hybridScore),
    [scoreFilter, statusFilter]
  );

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        eyebrow="Không gian nhà tuyển dụng"
        title="Bảng xếp hạng ứng viên"
        description="Hồ sơ ứng tuyển được sắp xếp theo hybridScore giảm dần. Giao diện vẫn hiển thị điểm ngữ nghĩa và từ khóa để giải thích, nhưng tín hiệu xếp hạng chỉ dùng hybridScore."
      />
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[color:var(--border)] bg-white p-3">
        {(['all', 'new', 'screening', 'interview', 'hired', 'rejected'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setStatusFilter(item)}
            className={`rounded-[7px] px-3 py-2 text-sm font-bold ${statusFilter === item ? 'bg-[var(--blue-700)] text-white' : 'bg-slate-50 text-[var(--text-2)]'}`}
          >
            {item === 'all' ? 'Tất cả' : pipelineLabels[item]}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-[var(--border)]" />
        {(['all', 'strong', 'potential'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setScoreFilter(item)}
            className={`rounded-[7px] px-3 py-2 text-sm font-bold ${scoreFilter === item ? 'bg-[var(--blue-900)] text-white' : 'bg-slate-50 text-[var(--text-2)]'}`}
          >
            {item === 'all' ? 'Tất cả điểm' : item === 'strong' ? 'Rất phù hợp' : 'Có tiềm năng'}
          </button>
        ))}
      </div>
      <section className="overflow-hidden rounded-[12px] border border-[color:var(--border)] bg-white shadow-[var(--shadow-elev-1)]">
        {visible.map((candidate) => {
          const band = scoreBand(candidate.hybridScore);
          return (
            <article
              key={candidate.id}
              className="grid gap-4 border-b border-[color:var(--border)] p-4 last:border-b-0 lg:grid-cols-[1fr_260px_150px_180px] lg:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[var(--blue-100)] font-mono text-sm font-bold text-[var(--blue-900)]">
                  {initials(candidate.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text-1)]">
                    {candidate.name}
                  </p>
                  <p className="truncate text-sm text-[var(--text-2)]">
                    {candidate.title} · {candidate.location}
                  </p>
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs font-bold text-[var(--text-2)]">
                  <span>Điểm phù hợp</span>
                  <span className="font-mono">{candidate.hybridScore}%</span>
                </div>
                <span className="block h-2.5 rounded-full bg-slate-100">
                  <span
                    className="block h-2.5 rounded-full"
                    style={{ width: `${candidate.hybridScore}%`, backgroundColor: band.color }}
                  />
                </span>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusStyles[candidate.status]}`}
              >
                {pipelineLabels[candidate.status]}
              </span>
              <div className="flex gap-2 lg:justify-end">
                <Button size="sm">Xem xét</Button>
                <Button size="icon" variant="outline" aria-label="Tải CV gốc">
                  <ArrowDownToLine className="h-4 w-4" />
                </Button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function WorkspaceHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="rounded-[14px] border border-[color:var(--border)] bg-white p-6 shadow-[var(--shadow-elev-1)]">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{eyebrow}</p>
      <h1 className="mt-2 font-display text-5xl leading-none text-[var(--text-1)]">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-2)]">{description}</p>
    </header>
  );
}

export function ResumeBuilderWorkspace() {
  const [tab, setTab] = useState<'Sections' | 'Format' | 'Template'>('Sections');
  const [columns, setColumns] = useState<'one' | 'two'>('two');
  const [compact, setCompact] = useState(34);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    Summary: true,
    Experience: true,
    Education: true,
    Skills: true,
  });
  const tabLabels: Record<typeof tab, string> = {
    Sections: 'Mục CV',
    Format: 'Định dạng',
    Template: 'Mẫu',
  };
  const sectionLabels: Record<string, string> = {
    Summary: 'Tóm tắt',
    Experience: 'Kinh nghiệm',
    Education: 'Học vấn',
    Skills: 'Kỹ năng',
  };

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        eyebrow="Không gian ứng viên"
        title="Trình dựng CV tương tác"
        description="Chỉnh sửa mục CV, mẫu trình bày, khoảng cách và trạng thái hiển thị trong khi bản xem trước dạng trang giấy cập nhật trực tiếp."
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="rounded-[12px] border border-[color:var(--border)] bg-white p-5 shadow-[var(--shadow-elev-1)]">
          <div className="grid grid-cols-3 gap-1 rounded-[8px] bg-slate-100 p-1">
            {(['Sections', 'Format', 'Template'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-[7px] px-2 py-2 text-sm font-bold ${tab === item ? 'bg-white text-[var(--blue-700)] shadow-sm' : 'text-[var(--text-2)]'}`}
              >
                {tabLabels[item]}
              </button>
            ))}
          </div>
          {tab === 'Sections' && (
            <div className="mt-5 space-y-2">
              {Object.keys(visible).map((section) => (
                <div
                  key={section}
                  className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] p-3"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-1)]">
                    <GripVertical className="h-4 w-4 text-[var(--text-3)]" />{' '}
                    {sectionLabels[section]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVisible((prev) => ({ ...prev, [section]: !prev[section] }))}
                    className={`flex h-6 w-11 items-center rounded-full p-1 ${visible[section] ? 'bg-[var(--blue-700)]' : 'bg-slate-200'}`}
                    aria-label={`Bật tắt mục ${sectionLabels[section]}`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-white transition ${visible[section] ? 'translate-x-5' : ''}`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
          {tab === 'Format' && (
            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Chế độ gọn</span>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={compact}
                  onChange={(e) => setCompact(Number(e.target.value))}
                  className="w-full accent-[var(--blue-700)]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Lề trang</span>
                <Input defaultValue="18 mm" />
              </label>
            </div>
          )}
          {tab === 'Template' && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                variant={columns === 'one' ? 'default' : 'outline'}
                onClick={() => setColumns('one')}
              >
                Một cột
              </Button>
              <Button
                variant={columns === 'two' ? 'default' : 'outline'}
                onClick={() => setColumns('two')}
              >
                Hai cột
              </Button>
            </div>
          )}
        </aside>
        <section className="rounded-[12px] border border-[color:var(--border)] bg-slate-100 p-5">
          <div
            className="mx-auto min-h-[760px] max-w-[780px] bg-white p-10 shadow-[0_20px_50px_rgba(15,23,42,.14)]"
            style={{ fontSize: `${15 - compact / 80}px` }}
          >
            <div
              className={columns === 'two' ? 'grid gap-9 md:grid-cols-[1fr_230px]' : 'space-y-8'}
            >
              <main>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--gold)]">
                  CV hiện đại
                </p>
                <h2 className="mt-3 font-display text-5xl text-[var(--text-1)]">Maya Tran</h2>
                <p className="mt-2 text-[var(--text-2)]">
                  Kỹ sư Frontend cấp cao tập trung vào sản phẩm tuyển dụng tích hợp AI.
                </p>
                {visible.Summary && (
                  <ResumePreviewSection
                    title="Tóm tắt"
                    body="Xây dựng quy trình tuyển dụng giàu dữ liệu, dashboard dễ truy cập và hệ thống thiết kế cho hành trình ứng viên lẫn nhà tuyển dụng."
                  />
                )}
                {visible.Experience && (
                  <ResumePreviewSection
                    title="Kinh nghiệm"
                    body="Dẫn dắt nhóm nền tảng React và Next.js triển khai dashboard xếp hạng ứng viên, xuất CV PDF và vòng phản hồi AI."
                  />
                )}
                {visible.Education && (
                  <ResumePreviewSection
                    title="Học vấn"
                    body="Cử nhân Khoa học máy tính, định hướng kỹ thuật sản phẩm."
                  />
                )}
              </main>
              {visible.Skills && (
                <aside>
                  <ResumePreviewSection
                    title="Kỹ năng"
                    body="React · Next.js · TypeScript · Tailwind · Accessibility · SBERT UX"
                  />
                </aside>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ResumePreviewSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-8">
      <h3 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-2)]">
        {title}
      </h3>
      <p className="mt-3 leading-6 text-[var(--text-1)]">{body}</p>
    </section>
  );
}

export function JdMatchWorkspace() {
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        eyebrow="Phản hồi AI cho ứng viên"
        title="Đối sánh JD và CV song song"
        description="Xem lại bằng chứng đã khớp và các yêu cầu còn thiếu trước khi tạo CV tối ưu hoặc tài liệu ứng tuyển."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-4 lg:grid-cols-2">
          <DocumentPanel title="Mô tả công việc mục tiêu">
            Chúng tôi cần một kỹ sư frontend có kinh nghiệm với{' '}
            <mark className="rounded bg-green-100 px-1 text-green-800">React</mark>,{' '}
            <mark className="rounded bg-green-100 px-1 text-green-800">Next.js</mark>, TypeScript
            vững và{' '}
            <mark className="rounded bg-red-50 px-1 text-[var(--danger)] underline decoration-dotted">
              Playwright
            </mark>{' '}
            . Đội ngũ ưu tiên design tokens, giao diện dễ truy cập và giám sát hàng đợi.
          </DocumentPanel>
          <DocumentPanel title="CV ứng viên đã tải lên">
            Dẫn dắt giao diện sản phẩm bằng{' '}
            <mark className="rounded bg-green-100 px-1 text-green-800">React</mark> và{' '}
            <mark className="rounded bg-green-100 px-1 text-green-800">Next.js</mark>. Xây dựng hệ
            thống component TypeScript và luồng ứng tuyển dễ truy cập cho tuyển dụng AI.
          </DocumentPanel>
        </section>
        <div className="space-y-4">
          <MatchScoreWidget hybridScore={82} semanticScore={0.82} keywordScore={0.65} />
          <section className="rounded-[12px] border border-[color:var(--border)] bg-white p-5 shadow-[var(--shadow-elev-1)]">
            <p className="flex items-center gap-2 text-sm font-bold text-[var(--blue-900)]">
              <WandSparkles className="h-4 w-4" /> Gợi ý từ AI
            </p>
            <Textarea
              className="mt-4 min-h-44"
              readOnly
              value={
                'Bổ sung một bullet về Playwright hoặc tác động của kiểm thử end-to-end.\nNêu rõ vai trò sở hữu design token nếu có.\nLàm rõ kinh nghiệm giám sát hàng đợi hoặc quan sát worker.'
              }
            />
            <Button className="mt-4 w-full">
              <Sparkles className="h-4 w-4" /> Tạo CV tối ưu
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

function DocumentPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="min-h-[520px] rounded-[12px] border border-[color:var(--border)] bg-white p-6 shadow-[var(--shadow-elev-1)]">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--text-1)]">{title}</h2>
        <ChevronDown className="h-4 w-4 text-[var(--text-3)]" />
      </div>
      <p className="text-base leading-8 text-[var(--text-2)]">{children}</p>
      <div className="mt-8 flex items-center gap-2 rounded-[8px] border border-[color:var(--border)] bg-slate-50 p-3 text-sm text-[var(--text-2)]">
        <CircleAlert className="h-4 w-4 text-[var(--info)]" />
        Phần tô sáng giúp tách bằng chứng đã khớp khỏi yêu cầu JD còn thiếu.
      </div>
    </article>
  );
}
