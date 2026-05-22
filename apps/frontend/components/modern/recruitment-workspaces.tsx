'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Columns2,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  GripVertical,
  History,
  KeyRound,
  Layers3,
  Loader2,
  Lock,
  Mail,
  PanelLeft,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  WandSparkles,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { forgotPassword, resetPassword } from '@/lib/api/auth';
import { useAuth } from '@/lib/context/auth-context';

type Role = 'candidate' | 'recruiter';
type AiStatus = 'pending' | 'parsing' | 'scoring' | 'completed' | 'failed';
type PipelineStatus = 'new' | 'screening' | 'interview' | 'hired' | 'rejected';
type JobCategory = 'Engineering' | 'Data' | 'Product' | 'Marketing';
type TemplateMode = 'classic' | 'modern';
type TemplateColumns = 'one' | 'two';
type GeneratorTab = 'cover' | 'outreach';
type Provider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'deepseek';

type RankedCandidate = {
  id: string;
  name: string;
  role: string;
  hybridScore: number;
  aiStatus: AiStatus;
  pipeline: PipelineStatus;
  skills: string[];
  updated: string;
};

const statusCopy: Record<AiStatus, { label: string; className: string }> = {
  pending: { label: 'Đang chờ', className: 'bg-slate-100 text-slate-600' },
  parsing: { label: 'Đang phân tích', className: 'bg-teal-50 text-teal-700' },
  scoring: { label: 'Đang chấm điểm', className: 'bg-indigo-50 text-indigo-700' },
  completed: { label: 'Hoàn tất', className: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Lỗi', className: 'bg-red-50 text-red-700' },
};

const pipelineOptions: PipelineStatus[] = ['new', 'screening', 'interview', 'hired', 'rejected'];
const pipelineLabels: Record<PipelineStatus, string> = {
  new: 'Mới',
  screening: 'Sàng lọc',
  interview: 'Phỏng vấn',
  hired: 'Đã tuyển',
  rejected: 'Từ chối',
};
const categoryLabels: Record<JobCategory, string> = {
  Engineering: 'Kỹ thuật',
  Data: 'Dữ liệu',
  Product: 'Sản phẩm',
  Marketing: 'Marketing',
};

const initialCandidates: RankedCandidate[] = [
  {
    id: 'app-1082',
    name: 'Maya Tran',
    role: 'Kỹ sư Frontend cấp cao',
    hybridScore: 94.8,
    aiStatus: 'completed',
    pipeline: 'interview',
    skills: ['React 19', 'Next.js', 'Design System'],
    updated: '2 phút trước',
  },
  {
    id: 'app-1034',
    name: 'Daniel Pham',
    role: 'Kỹ sư sản phẩm AI',
    hybridScore: 91.4,
    aiStatus: 'scoring',
    pipeline: 'screening',
    skills: ['SBERT', 'Node.js', 'Tìm kiếm vector'],
    updated: '7 phút trước',
  },
  {
    id: 'app-987',
    name: 'Linh Nguyen',
    role: 'Lập trình viên Full Stack',
    hybridScore: 88.2,
    aiStatus: 'parsing',
    pipeline: 'new',
    skills: ['TypeScript', 'PostgreSQL', 'BM25'],
    updated: '13 phút trước',
  },
  {
    id: 'app-944',
    name: 'Jordan Lee',
    role: 'Kỹ sư nền tảng',
    hybridScore: 82.9,
    aiStatus: 'failed',
    pipeline: 'new',
    skills: ['Hàng đợi', 'Giám sát hệ thống', 'Docker'],
    updated: '22 phút trước',
  },
];

const keywordBank: Record<JobCategory, string[]> = {
  Engineering: ['React', 'Next.js', 'TypeScript', 'Thiết kế API', 'Kiểm thử', 'Truy cập dễ dàng'],
  Data: ['SBERT', 'BM25', 'Kho đặc trưng', 'Python', 'Đánh giá mô hình', 'Embedding'],
  Product: ['Khám phá nhu cầu', 'Lộ trình', 'Phân tích dữ liệu', 'Thử nghiệm', 'Các bên liên quan'],
  Marketing: ['SEO', 'Vòng đời khách hàng', 'Viết nội dung', 'Chiến dịch', 'Đo lường đóng góp'],
};

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="min-h-28 justify-between rounded-[8px] border-white/70 bg-white/80 p-5 shadow-none backdrop-blur">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </Card>
  );
}

function WorkspaceHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-[8px] border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase text-indigo-600">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function AiStatusBadge({ status }: { status: AiStatus }) {
  const copy = statusCopy[status];
  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold ${copy.className}`}
    >
      {status === 'pending' ? <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" /> : null}
      {status === 'parsing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {status === 'scoring' ? <span className="h-2 w-6 overflow-hidden rounded-full bg-indigo-200"><span className="block h-full w-1/2 animate-pulse bg-indigo-600" /></span> : null}
      {status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      {status === 'failed' ? <XCircle className="h-3.5 w-3.5" /> : null}
      {copy.label}
    </span>
  );
}

function PasswordMeter({ value }: { value: string }) {
  const score = [
    value.length >= 8,
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  const labels = ['Quá ngắn', 'Tạm ổn', 'Tốt', 'Mạnh'];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((item) => (
          <span
            key={item}
            className={`h-1.5 rounded-full ${item < score ? 'bg-emerald-500' : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">{value ? labels[Math.max(score - 1, 0)] : 'Dùng ít nhất 8 ký tự và có chữ số.'}</p>
    </div>
  );
}

export function AuthOnboardingWorkspace({ mode = 'signup' }: { mode?: 'signup' | 'login' | 'forgot' | 'reset' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [role, setRole] = useState<Role>('candidate');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(42);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isPasswordFlow = mode === 'reset' || mode === 'signup' || mode === 'login';
  const nextPath = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/dashboard';
  const title =
    mode === 'forgot'
      ? 'Khôi phục tài khoản'
      : mode === 'reset'
        ? 'Đặt mật khẩu mới'
        : mode === 'login'
          ? 'Chào mừng trở lại'
          : 'Tham gia Smart CV Matching';

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
        <section className="hidden bg-slate-950 px-10 py-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white text-slate-950">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Smart CV Matching</p>
              <p className="text-xs text-slate-400">Nền tảng tuyển dụng AI hybrid</p>
            </div>
          </div>
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase text-teal-300">SBERT + BM25</p>
            <h2 className="mt-5 text-5xl font-semibold leading-tight tracking-normal">
              Một giao diện gọn gàng cho ứng viên, nhà tuyển dụng và các quyết định AI.
            </h2>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <MetricCard label="Điểm hybrid" value="94.8" helper="Tín hiệu xếp hạng duy nhất" />
              <MetricCard label="Pipeline" value="Trực tiếp" helper="Phân tích và chấm điểm" />
              <MetricCard label="Vai trò" value="2" helper="Ứng viên và nhà tuyển dụng" />
            </div>
          </div>
          <p className="text-sm text-slate-400">Chấm điểm minh bạch, quy trình dễ đọc, không rối mắt.</p>
        </section>

        <section className="flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-md">
            <p className="text-xs font-semibold uppercase text-indigo-600">{mode === 'signup' ? 'Bắt đầu dùng chung' : 'Truy cập an toàn'}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Chọn vai trò một lần, hệ thống sẽ điều chỉnh không gian làm việc theo đúng quy trình bạn cần.
            </p>

            {mode === 'signup' || mode === 'login' ? (
              <div className="mt-6 grid grid-cols-2 gap-2 rounded-[8px] border border-slate-200 bg-white p-1">
                {(['candidate', 'recruiter'] as Role[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRole(item)}
                    className={`rounded-[7px] px-3 py-3 text-left transition ${
                      role === item ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {item === 'candidate' ? <UserRound className="h-4 w-4" /> : <BriefcaseBusiness className="h-4 w-4" />}
                      {item === 'candidate' ? 'Ứng viên' : 'Nhà tuyển dụng'}
                    </span>
                    <span className="mt-1 block text-xs opacity-80">
                      {item === 'candidate' ? 'CV, đối sánh JD, phiên bản' : 'Tin tuyển dụng, xếp hạng, pipeline'}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <form
              className="mt-6 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setError(null);
                setMessage(null);
                setSubmitting(true);

                try {
                  if (mode === 'login') {
                    await signIn({ email: email.trim(), password });
                    router.replace(nextPath);
                    return;
                  }

                  if (mode === 'signup') {
                    await signUp({
                      email: email.trim(),
                      password,
                      full_name: fullName.trim() || email.trim(),
                      role,
                    });
                    router.replace('/dashboard');
                    return;
                  }

                  if (mode === 'forgot') {
                    const result = await forgotPassword(email.trim());
                    setSent(true);
                    setCountdown((value) => Math.max(value - 1, 0));
                    setMessage(result.reset_token ? 'Liên kết đặt lại mật khẩu đã sẵn sàng.' : result.message);
                    if (result.reset_token) {
                      router.push(`/reset-password?token=${encodeURIComponent(result.reset_token)}`);
                    }
                    return;
                  }

                  if (!token.trim()) {
                    setError('Cần có mã đặt lại mật khẩu.');
                    return;
                  }

                  if (password !== confirmPassword) {
                    setError('Hai mật khẩu không khớp.');
                    return;
                  }

                  const result = await resetPassword({
                    token: token.trim(),
                    new_password: password,
                  });
                  setMessage(result.message || 'Đã cập nhật mật khẩu. Bạn có thể đăng nhập ngay.');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Xác thực thất bại.');
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {mode === 'signup' ? (
                <div className="space-y-2">
                  <Label htmlFor="modern-name">{role === 'candidate' ? 'Họ và tên' : 'Người phụ trách'}</Label>
                  <div className="relative">
                    <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="modern-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="pl-9"
                      placeholder={role === 'candidate' ? 'Maya Tran' : 'Quản lý tuyển dụng'}
                      required
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="modern-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="modern-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" placeholder="ban@congty.com" required />
                </div>
                {email && !email.includes('@') ? <p className="text-xs text-red-600">Vui lòng nhập email hợp lệ.</p> : null}
              </div>

              {isPasswordFlow ? (
                <div className="space-y-2">
                  <Label htmlFor="modern-password">Mật khẩu</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="modern-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pl-9 pr-10"
                      required
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShowPassword((value) => !value)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode !== 'login' ? <PasswordMeter value={password} /> : null}
                </div>
              ) : null}

              {mode === 'reset' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="modern-token">Mã đặt lại mật khẩu</Label>
                    <Input
                      id="modern-token"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      autoComplete="one-time-code"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modern-confirm-password">Xác nhận mật khẩu</Label>
                    <Input
                      id="modern-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </>
              ) : null}

              {sent ? (
                <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Đã gửi email. Bạn có thể yêu cầu lại sau {countdown} giây.
                </div>
              ) : null}

              {message ? (
                <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {message}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button className="w-full" size="lg" type="submit" disabled={submitting}>
                {submitting
                  ? 'Vui lòng chờ'
                  : mode === 'forgot'
                    ? 'Gửi liên kết đặt lại'
                    : mode === 'reset'
                      ? 'Cập nhật mật khẩu'
                      : mode === 'login'
                        ? 'Đăng nhập'
                        : 'Tạo tài khoản'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-5 flex justify-between text-sm text-slate-600">
              <Link href="/login" className="hover:text-indigo-700">Đăng nhập</Link>
              <Link href="/forgot-password" className="hover:text-indigo-700">Quên mật khẩu</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function RecruiterRankedDashboard() {
  const [items, setItems] = useState(initialCandidates);
  const [query, setQuery] = useState('');
  const [selectedJobClosed, setSelectedJobClosed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const ranked = useMemo(() => {
    return items
      .filter((item) => `${item.name} ${item.role} ${item.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.hybridScore - a.hybridScore);
  }, [items, query]);

  const updatePipeline = (id: string, pipeline: PipelineStatus) => {
    startTransition(() => {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, pipeline } : item)));
    });
  };

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        eyebrow="Bảng điều khiển tuyển dụng"
        title="Ứng viên đã xếp hạng"
        description="Ứng viên chỉ được sắp xếp theo hybridScore, kết hợp 0.65 điểm ngữ nghĩa SBERT và 0.35 bằng chứng từ khóa BM25."
        action={<Button variant={selectedJobClosed ? 'success' : 'outline'} onClick={() => setSelectedJobClosed((value) => !value)}>{selectedJobClosed ? 'Mở lại tin' : 'Đóng tin'}</Button>}
      />

      {selectedJobClosed ? (
        <div className="flex items-center gap-3 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          Tin tuyển dụng đang được đóng mềm. Bảng xếp hạng vẫn xem được, nhưng các thao tác ứng viên mới đã bị hạn chế.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Ứng viên" value={String(items.length)} helper="Đã tải cho JD này" />
        <MetricCard label="Điểm cao nhất" value={items[0]?.hybridScore.toFixed(1) ?? '0'} helper="hybridScore giảm dần" />
        <MetricCard label="Hoàn tất" value={String(items.filter((item) => item.aiStatus === 'completed').length)} helper="Vòng đời AI đã xong" />
        <MetricCard label="Trạng thái" value={isPending ? 'Đồng bộ' : 'Sẵn sàng'} helper="Chuyển trạng thái" />
      </div>

      <Card className="rounded-[8px] p-0 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Hàng đợi xử lý AI</h2>
            <p className="text-sm text-slate-500">Không hiển thị điểm phụ thô để quyết định xếp hạng luôn rõ ràng.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm ứng viên hoặc kỹ năng" className="pl-9" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Hạng</th>
                <th className="px-4 py-3">Ứng viên</th>
                <th className="px-4 py-3">hybridScore</th>
                <th className="px-4 py-3">Kỹ năng khớp</th>
                <th className="px-4 py-3">Trạng thái AI</th>
                <th className="px-4 py-3">Quy trình</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranked.map((candidate, index) => (
                <tr key={candidate.id} className={selectedJobClosed ? 'opacity-70' : 'hover:bg-slate-50/70'}>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-500">#{index + 1}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-950">{candidate.name}</p>
                    <p className="text-sm text-slate-500">{candidate.role} · {candidate.updated}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-semibold text-slate-950">{candidate.hybridScore.toFixed(1)}</span>
                      <span className="h-2 w-20 rounded-full bg-slate-100">
                        <span className="block h-2 rounded-full bg-indigo-600" style={{ width: `${candidate.hybridScore}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.skills.map((skill) => (
                        <span key={skill} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{skill}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4"><AiStatusBadge status={candidate.aiStatus} /></td>
                  <td className="px-4 py-4">
                    <select
                      value={candidate.pipeline}
                      disabled={selectedJobClosed}
                      onChange={(event) => updatePipeline(candidate.id, event.target.value as PipelineStatus)}
                      className="h-9 rounded-[7px] border border-slate-200 bg-white px-3 text-sm capitalize"
                    >
                      {pipelineOptions.map((option) => <option key={option} value={option}>{pipelineLabels[option]}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function RecruiterJDCreator() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<JobCategory>('Engineering');
  const [requirements, setRequirements] = useState('Xây dựng giao diện React dễ truy cập, phối hợp với API contract và cải thiện quy trình ghép nối ứng viên.');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(['React', 'TypeScript']);
  const [closing, setClosing] = useState(false);
  const steps = ['Vai trò', 'Yêu cầu', 'Rà soát'];

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords((current) => current.includes(keyword) ? current.filter((item) => item !== keyword) : [...current, keyword]);
  };

  return (
    <div className="space-y-6">
      <WorkspaceHeader eyebrow="Tạo JD" title="Trình tạo mô tả công việc tương tác" description="Quy trình có cấu trúc giúp nhà tuyển dụng tập trung, còn chip từ khóa AI giúp chuẩn hóa bằng chứng ghép nối." />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="rounded-[8px] shadow-sm">
          <div className="space-y-3">
            {steps.map((label, index) => (
              <button key={label} onClick={() => setStep(index)} className={`flex w-full items-center gap-3 rounded-[8px] p-3 text-left ${step === index ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold ring-1 ring-slate-200">{index + 1}</span>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="rounded-[8px] shadow-sm">
          {step === 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Tiêu đề</Label>
                <Input defaultValue="Kỹ sư Frontend cấp cao" />
              </div>
              <div className="space-y-2">
                <Label>Danh mục</Label>
                <select className="h-10 w-full rounded-[7px] border border-slate-200 bg-white px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as JobCategory)}>
                  {(Object.keys(keywordBank) as JobCategory[]).map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cấp kinh nghiệm</Label>
                <Input defaultValue="Senior, trên 5 năm" />
              </div>
            </div>
          ) : null}
          {step === 1 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Yêu cầu</Label>
                <Textarea className="min-h-44" value={requirements} onChange={(event) => setRequirements(event.target.value)} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Từ khóa chuẩn do AI gợi ý</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywordBank[category].map((keyword) => (
                    <button key={keyword} type="button" onClick={() => toggleKeyword(keyword)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${selectedKeywords.includes(keyword) ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-600'}`}>{keyword}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="space-y-5">
              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Bằng chứng đã chọn</p>
                <p className="mt-2 text-sm text-slate-700">{selectedKeywords.join(', ')}</p>
              </div>
              <div className="rounded-[8px] border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-950">Cảnh báo đóng mềm</p>
                <p className="mt-1 text-sm text-slate-600">Đóng tin sẽ ẩn với ứng viên mới nhưng vẫn giữ xếp hạng, lịch sử kiểm toán và ngữ cảnh ứng viên.</p>
                {closing ? <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Đang xác nhận trạng thái đóng. Các dòng ứng viên hiện có vẫn được giữ.</div> : null}
              </div>
            </div>
          ) : null}
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStep((value) => Math.max(value - 1, 0))}>Quay lại</Button>
            {step === 2 ? <Button variant="warning" onClick={() => setClosing(true)}>Đóng tin</Button> : <Button onClick={() => setStep((value) => Math.min(value + 1, 2))}>Tiếp tục</Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function CandidateResumeWorkspace() {
  const [openSection, setOpenSection] = useState('Hồ sơ');
  const [template, setTemplate] = useState<TemplateMode>('modern');
  const [columns, setColumns] = useState<TemplateColumns>('two');
  const [compact, setCompact] = useState(42);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sections = ['Hồ sơ', 'Kinh nghiệm làm việc', 'Học vấn', 'Kỹ năng'];

  return (
    <div className="space-y-6">
      <WorkspaceHeader eyebrow="Không gian ứng viên" title="Trình dựng CV và xem trước trực tiếp" description="Không gian chia đôi màn hình để chỉnh sửa cấu trúc, trạng thái định dạng, chuyển mẫu và khôi phục phiên bản qua parentResumeId." action={<Button variant="outline" onClick={() => setDrawerOpen((value) => !value)}><History className="h-4 w-4" /> Phiên bản</Button>} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="rounded-[8px] shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Cấu trúc</h2>
            <PanelLeft className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-4 space-y-2">
            {sections.map((section) => (
              <div key={section} className="rounded-[8px] border border-slate-200">
                <button className="flex w-full items-center justify-between p-3" onClick={() => setOpenSection(openSection === section ? '' : section)}>
                  <span className="flex items-center gap-2 text-sm font-semibold"><GripVertical className="h-4 w-4 text-slate-400" /> {section}</span>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
                {openSection === section ? (
                  <div className="space-y-3 border-t border-slate-100 p-3">
                    <Input defaultValue={section === 'Hồ sơ' ? 'Maya Tran, Kỹ sư Frontend cấp cao' : section} />
                    <Textarea className="min-h-24" defaultValue="Mô tả kết quả, công cụ và tác động kinh doanh có thể đo lường." />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-4 rounded-[8px] bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">Định dạng</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={template === 'classic' ? 'default' : 'outline'} onClick={() => setTemplate('classic')}><FileText className="h-4 w-4" /> Cổ điển</Button>
              <Button variant={template === 'modern' ? 'default' : 'outline'} onClick={() => setTemplate('modern')}><Sparkles className="h-4 w-4" /> Hiện đại</Button>
              <Button variant={columns === 'one' ? 'default' : 'outline'} onClick={() => setColumns('one')}><Layers3 className="h-4 w-4" /> 1 cột</Button>
              <Button variant={columns === 'two' ? 'default' : 'outline'} onClick={() => setColumns('two')}><Columns2 className="h-4 w-4" /> 2 cột</Button>
            </div>
            <div>
              <Label>Chế độ gọn</Label>
              <input type="range" min="0" max="100" value={compact} onChange={(event) => setCompact(Number(event.target.value))} className="mt-2 w-full accent-indigo-600" />
            </div>
          </div>
        </Card>
        <Card className="min-h-[720px] rounded-[8px] bg-slate-100 p-5 shadow-sm">
          <div className="mx-auto min-h-[660px] max-w-[760px] rounded-[8px] bg-white p-8 shadow-sm" style={{ fontSize: `${15 - compact / 50}px` }}>
            <div className={columns === 'two' ? 'grid gap-8 md:grid-cols-[1fr_240px]' : 'space-y-8'}>
              <main>
                <p className="text-xs font-semibold uppercase text-indigo-600">Mẫu {template === 'classic' ? 'cổ điển' : 'hiện đại'}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Maya Tran</h2>
                <p className="mt-1 text-slate-600">Kỹ sư Frontend cấp cao chuyên về sản phẩm tuyển dụng tích hợp AI.</p>
                <section className="mt-8">
                  <h3 className="text-sm font-semibold uppercase text-slate-500">Kinh nghiệm</h3>
                  <p className="mt-3 font-semibold text-slate-950">Trưởng nhóm Frontend · TalentOS</p>
                  <p className="mt-1 text-slate-600">Xây dựng không gian ghép nối CV theo thời gian thực với quy trình giàu dữ liệu và dễ truy cập.</p>
                </section>
              </main>
              <aside className="space-y-5">
                <section>
                  <h3 className="text-sm font-semibold uppercase text-slate-500">Kỹ năng</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['React', 'Next.js', 'TypeScript', 'AI UX'].map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{skill}</span>)}
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </Card>
      </div>
      {drawerOpen ? (
        <Card className="fixed bottom-6 right-6 z-40 w-[360px] rounded-[8px] shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-950">Lịch sử phiên bản</h2>
            <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}><XCircle className="h-4 w-4" /></Button>
          </div>
          {['CV gốc', 'JD Frontend v2', 'Bản nháp AI tối ưu'].map((item, index) => (
            <div key={item} className="mt-3 rounded-[8px] border border-slate-200 p-3">
              <p className="text-sm font-semibold">{item}</p>
              <p className="text-xs text-slate-500">parentResumeId: {index === 0 ? 'null' : 'res-base-001'}</p>
              <Button className="mt-2" size="sm" variant="outline"><RefreshCw className="h-4 w-4" /> Khôi phục</Button>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

export function CandidateMatchWorkspace() {
  const [tab, setTab] = useState<GeneratorTab>('cover');
  const matched = ['React', 'Next.js', 'Truy cập dễ dàng', 'TypeScript'];
  const missing = ['Playwright', 'Design token', 'Giám sát hàng đợi'];

  return (
    <div className="space-y-6">
      <WorkspaceHeader eyebrow="Phản hồi AI" title="Đối sánh JD và tạo tài liệu" description="So sánh bằng chứng trong CV với JD mục tiêu, sau đó tạo thư ứng tuyển hoặc email tiếp cận ngay trong báo cáo." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="h-[360px] rounded-[8px] shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Mô tả công việc</p>
              <p className="mt-4 text-sm leading-6 text-slate-600">Chúng tôi cần một kỹ sư frontend có thể xây dựng giao diện Next.js, vận hành design token và phối hợp với đội nền tảng AI.</p>
            </Card>
            <Card className="h-[360px] rounded-[8px] shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Bằng chứng từ CV</p>
              <p className="mt-4 text-sm leading-6 text-slate-600">Dẫn dắt giao diện sản phẩm React và TypeScript, tạo component quy trình dễ truy cập và cải thiện chuyển đổi ghép nối CV.</p>
            </Card>
          </div>
          <Card className="rounded-[8px] shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Ma trận đối sánh</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Từ khóa đã khớp</p>
                <div className="mt-3 flex flex-wrap gap-2">{matched.map((item) => <span key={item} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">{item}</span>)}</div>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-700">Từ khóa còn thiếu</p>
                <div className="mt-3 flex flex-wrap gap-2">{missing.map((item) => <span key={item} className="rounded-full border border-dashed border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">{item}</span>)}</div>
              </div>
            </div>
          </Card>
        </div>
        <Card className="rounded-[8px] shadow-sm">
          <div className="flex rounded-[8px] bg-slate-100 p-1">
            <button className={`flex-1 rounded-[7px] px-3 py-2 text-sm font-semibold ${tab === 'cover' ? 'bg-white shadow-sm' : ''}`} onClick={() => setTab('cover')}>Thư ứng tuyển</button>
            <button className={`flex-1 rounded-[7px] px-3 py-2 text-sm font-semibold ${tab === 'outreach' ? 'bg-white shadow-sm' : ''}`} onClick={() => setTab('outreach')}>Email tiếp cận</button>
          </div>
          <div className="mt-5 rounded-[8px] bg-indigo-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-indigo-800"><Bot className="h-4 w-4" /> Gợi ý từ AI</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-indigo-900">
              <li>Diễn đạt lại kinh nghiệm nền tảng với trách nhiệm Next.js 16 rõ ràng.</li>
              <li>Bổ sung một kết quả đo được về khả năng truy cập hoặc hiệu năng.</li>
              <li>Nhắc đến giám sát hàng đợi nếu bạn từng làm theo dõi vận hành cho worker.</li>
            </ul>
          </div>
          <Textarea className="mt-5 min-h-64" value={tab === 'cover' ? 'Kính gửi đội ngũ tuyển dụng,\n\nTôi rất hào hứng khi ứng tuyển và áp dụng kinh nghiệm React, Next.js cùng quy trình AI vào vai trò này...' : 'Xin chào,\n\nTôi thấy đội ngũ của anh/chị đang tuyển kỹ sư frontend tập trung vào quy trình sản phẩm AI...'} readOnly />
          <Button className="mt-4 w-full"><Send className="h-4 w-4" /> Tạo {tab === 'cover' ? 'thư ứng tuyển' : 'email tiếp cận'}</Button>
        </Card>
      </div>
    </div>
  );
}

export function SystemConfigWorkspace() {
  const [role, setRole] = useState<'admin' | 'recruiter' | 'candidate'>('admin');
  const [provider, setProvider] = useState<Provider>('openai');
  const [showKey, setShowKey] = useState(false);
  const [alpha, setAlpha] = useState(0.65);
  const [locales, setLocales] = useState(['EN', 'JA']);
  const readOnly = role !== 'admin';
  const providers: Provider[] = ['ollama', 'openai', 'anthropic', 'gemini', 'deepseek'];
  const allLocales = ['EN', 'ES', 'ZH', 'JA', 'PT'];
  const roleLabels: Record<'admin' | 'recruiter' | 'candidate', string> = {
    admin: 'Quản trị',
    recruiter: 'Nhà tuyển dụng',
    candidate: 'Ứng viên',
  };

  return (
    <div className="space-y-6">
      <WorkspaceHeader eyebrow="Cấu hình hệ thống" title="Thiết lập LLM" description="Nhà tuyển dụng và ứng viên chỉ có quyền xem; chỉ Quản trị viên mới được sửa nhà cung cấp AI và tham số chấm điểm nhạy cảm." action={<select className="h-10 rounded-[7px] border border-slate-200 bg-white px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'recruiter' | 'candidate')}><option value="admin">Quản trị</option><option value="recruiter">Nhà tuyển dụng</option><option value="candidate">Ứng viên</option></select>} />
      {readOnly ? <div className="flex items-center gap-2 rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><ShieldCheck className="h-4 w-4" /> Chế độ chỉ xem cho {roleLabels[role]}. Cần quyền Quản trị để lưu thay đổi.</div> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="rounded-[8px] shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            {providers.map((item) => (
              <button key={item} disabled={readOnly} onClick={() => setProvider(item)} className={`rounded-[8px] border p-4 text-left transition ${provider === item ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <p className="flex items-center gap-2 text-sm font-semibold capitalize text-slate-950"><KeyRound className="h-4 w-4 text-indigo-600" /> {item}</p>
                <p className="mt-2 text-xs text-slate-500">{item === 'ollama' ? 'Endpoint nội bộ' : 'Nhà cung cấp API trên cloud'}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>URL endpoint</Label>
              <Input disabled={readOnly} defaultValue={provider === 'ollama' ? 'http://localhost:11434' : 'https://api.provider.com/v1'} />
            </div>
            <div className="space-y-2">
              <Label>Mô hình</Label>
              <Input disabled={readOnly} defaultValue={provider === 'openai' ? 'gpt-5.4' : 'mo-hinh-mac-dinh'} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Khóa API</Label>
              <div className="relative">
                <Input disabled={readOnly} type={showKey ? 'text' : 'password'} defaultValue="sk-prod-••••••••••" className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShowKey((value) => !value)}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
          </div>
          <Button disabled={readOnly} className="mt-6"><Save className="h-4 w-4" /> Lưu nhà cung cấp</Button>
        </Card>
        <Card className="rounded-[8px] shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950"><Settings2 className="h-5 w-5" /> Tham số hệ thống</h2>
          <div className="mt-5 space-y-5">
            <div>
              <div className="flex justify-between text-sm font-semibold"><span>Alpha của hybridScore</span><span>{alpha.toFixed(2)} SBERT / {(1 - alpha).toFixed(2)} BM25</span></div>
              <input disabled={readOnly} type="range" min="0.4" max="0.8" step="0.01" value={alpha} onChange={(event) => setAlpha(Number(event.target.value))} className="mt-3 w-full accent-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Ngôn ngữ giao diện</p>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {allLocales.map((locale) => (
                  <button key={locale} disabled={readOnly} onClick={() => setLocales((current) => current.includes(locale) ? current.filter((item) => item !== locale) : [...current, locale])} className={`rounded-[7px] border px-2 py-2 text-xs font-semibold ${locales.includes(locale) ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500'}`}>{locale}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-[8px] border border-slate-200 p-3 text-sm font-semibold">
              Cảnh báo thuật toán từ khóa
              <input disabled={readOnly} type="checkbox" defaultChecked className="h-4 w-4 accent-indigo-600" />
            </label>
            <label className="flex items-center justify-between rounded-[8px] border border-slate-200 p-3 text-sm font-semibold">
              Tạo thư ứng tuyển
              <input disabled={readOnly} type="checkbox" defaultChecked className="h-4 w-4 accent-indigo-600" />
            </label>
          </div>
        </Card>
      </div>
    </div>
  );
}
