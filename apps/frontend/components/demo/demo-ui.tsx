'use client';

import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  GripVertical,
  KeyRound,
  Languages,
  Lock,
  Mail,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  WandSparkles,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';
type PipelineStatus = 'new' | 'screening' | 'interview' | 'hired' | 'rejected';
type AiStatus = 'pending' | 'parsing' | 'scoring' | 'completed' | 'failed';

const jobs = [
  {
    id: 'job-2401',
    title: 'Kỹ sư Backend cấp cao',
    company: 'Aster Talent',
    location: 'TP. Hồ Chí Minh',
    category: 'IT',
    status: 'active',
    deadline: '30/06/2026',
    score: 86,
    keywords: ['Node.js', 'Qdrant', 'Redis', 'Docker'],
  },
  {
    id: 'job-2402',
    title: 'Chuyên viên phân tích dữ liệu',
    company: 'Blue Ocean Analytics',
    location: 'Hà Nội',
    category: 'Data',
    status: 'active',
    deadline: '15/07/2026',
    score: 78,
    keywords: ['Python', 'SBERT', 'BM25', 'Dashboard'],
  },
  {
    id: 'job-2403',
    title: 'Product Marketing Executive',
    company: 'Nova Retail',
    location: 'Đà Nẵng',
    category: 'Marketing',
    status: 'closed',
    deadline: 'Đã đóng',
    score: 62,
    keywords: ['SEO', 'CRM', 'Campaign', 'Content'],
  },
];

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
    aiStatus: 'completed' as AiStatus,
    resume: 'maya-tran-senior-frontend.pdf',
    skills: ['React', 'Next.js', 'TypeScript'],
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
    aiStatus: 'scoring' as AiStatus,
    resume: 'daniel-pham-ai-product.pdf',
    skills: ['SBERT', 'FastAPI', 'Qdrant'],
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
    aiStatus: 'parsing' as AiStatus,
    resume: 'linh-nguyen-fullstack.pdf',
    skills: ['MongoDB', 'Node.js', 'Docker'],
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
    aiStatus: 'failed' as AiStatus,
    resume: 'jordan-lee-platform.pdf',
    skills: ['Queue', 'Monitoring', 'Linux'],
  },
];

const resumes = [
  {
    id: 'res-master',
    title: 'CV gốc - Kỹ sư Frontend',
    status: 'ready',
    updated: '21/05/2026',
    version: 'Master',
  },
  {
    id: 'res-job-2401',
    title: 'CV tối ưu cho Backend AI',
    status: 'ready',
    updated: '20/05/2026',
    version: 'parentResumeId: res-master',
  },
  {
    id: 'res-job-2402',
    title: 'CV tối ưu cho Data Analyst',
    status: 'processing',
    updated: '19/05/2026',
    version: 'parentResumeId: res-master',
  },
];

const pipelineLabels: Record<PipelineStatus, string> = {
  new: 'Mới',
  screening: 'Sàng lọc',
  interview: 'Phỏng vấn',
  hired: 'Đã tuyển',
  rejected: 'Từ chối',
};

const aiStatusLabels: Record<AiStatus, string> = {
  pending: 'Đang chờ',
  parsing: 'Đang phân tích',
  scoring: 'Đang chấm điểm',
  completed: 'Hoàn tất',
  failed: 'Lỗi',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function scoreBand(score: number) {
  if (score >= 75)
    return {
      label: 'Rất phù hợp',
      color: 'var(--success)',
      className: 'bg-green-50 text-[var(--success)]',
    };
  if (score >= 50)
    return {
      label: 'Có tiềm năng',
      color: 'var(--warning)',
      className: 'bg-amber-50 text-[var(--warning)]',
    };
  return {
    label: 'Chưa phù hợp',
    color: 'var(--danger)',
    className: 'bg-red-50 text-[var(--danger)]',
  };
}

function panelClass(extra = '') {
  return `rounded-[12px] border border-[color:var(--border)] bg-white shadow-[var(--shadow-elev-1)] ${extra}`;
}

export function DemoPageHeader({
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
    <header className={panelClass('p-6')}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-5xl leading-none text-[var(--text-1)]">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-2)]">{description}</p>
        </div>
        {action}
      </div>
    </header>
  );
}

function DemoMetric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className={panelClass('p-5')}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">
          {label}
        </p>
        <Icon className="h-4 w-4 text-[var(--blue-700)]" />
      </div>
      <p className="mt-4 font-mono text-3xl font-bold text-[var(--text-1)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--text-2)]">{helper}</p>
    </div>
  );
}

export function DemoAuthPage({ mode }: { mode: AuthMode }) {
  const [role, setRole] = useState<'candidate' | 'recruiter'>('candidate');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const title =
    mode === 'login'
      ? 'Đăng nhập'
      : mode === 'signup'
        ? 'Đăng ký tài khoản'
        : mode === 'forgot'
          ? 'Quên mật khẩu'
          : 'Đặt lại mật khẩu';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
        <section className="relative hidden overflow-hidden bg-[var(--blue-900)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-white font-mono text-sm font-bold text-[var(--blue-900)]">
              CV
            </span>
            <div>
              <p className="font-bold">CV Matching</p>
              <p className="text-sm text-white/65">Demo UI tuyển dụng tích hợp AI</p>
            </div>
          </div>
          <div className="relative max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
              SBERT + BM25
            </p>
            <h1 className="mt-5 font-display text-6xl leading-[0.96]">
              Kết nối <span className="italic text-[var(--gold)]">ứng viên</span> và doanh nghiệp
              bằng dữ liệu rõ ràng.
            </h1>
            <div className="mt-9 max-w-sm rounded-[14px] border border-white/15 bg-slate-950/50 p-5 shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white/75">Điểm phù hợp hybrid</p>
                <span className="rounded-full bg-[var(--gold-dim)] px-3 py-1 font-mono text-xs text-[var(--gold)]">
                  ranking
                </span>
              </div>
              <p className="mt-4 font-mono text-5xl font-bold">92%</p>
              {[
                ['Ngữ nghĩa SBERT', 88],
                ['Từ khóa BM25', 74],
                ['Hybrid', 92],
              ].map(([label, value]) => (
                <div key={label} className="mt-3">
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
          <p className="relative max-w-xl text-sm leading-6 text-white/68">
            Demo không kết nối API. Mọi form và bảng dữ liệu dùng dữ liệu mẫu để trình bày toàn bộ
            giao diện sản phẩm.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-md">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--blue-700)]">
              Demo xác thực
            </p>
            <h2 className="mt-3 font-display text-5xl leading-none text-[var(--text-1)]">
              {title}
            </h2>
            <p className="mt-4 text-sm leading-6 text-[var(--text-2)]">
              Màn hình mẫu cho UC-BASIC-01, UC-BASIC-02 và UC-BASIC-03.
            </p>
            {(mode === 'login' || mode === 'signup') && (
              <div className="mt-6 grid grid-cols-2 gap-2 rounded-[8px] border border-[color:var(--border)] bg-white p-1">
                {(['candidate', 'recruiter'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRole(item)}
                    className={`rounded-[7px] px-3 py-3 text-left text-sm font-bold transition ${role === item ? 'bg-[var(--blue-700)] text-white' : 'text-[var(--text-2)] hover:bg-slate-50'}`}
                  >
                    {item === 'candidate' ? 'Ứng viên' : 'Nhà tuyển dụng'}
                    <span className="mt-1 block text-xs font-medium opacity-75">
                      {item === 'candidate' ? 'CV, điểm phù hợp' : 'JD, dashboard ứng viên'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <LabeledInput
                  icon={<UserRound className="h-4 w-4" />}
                  label="Họ và tên"
                  defaultValue="Nguyễn Minh Anh"
                />
              )}
              {mode === 'reset' && (
                <LabeledInput label="Mã đặt lại mật khẩu" defaultValue="RESET-2026-DEMO" />
              )}
              {mode !== 'reset' && (
                <LabeledInput
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  defaultValue={role === 'candidate' ? 'candidate@demo.vn' : 'hr@demo.vn'}
                />
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
                      defaultValue="Demo@123456"
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
                <LabeledInput
                  label="Xác nhận mật khẩu"
                  type="password"
                  defaultValue="Demo@123456"
                />
              )}
              {submitted && (
                <p className="rounded-[8px] border border-green-200 bg-green-50 p-3 text-sm text-[var(--success)]">
                  Demo: thao tác thành công, không gọi API.
                </p>
              )}
              <Button className="w-full" size="lg" type="submit">
                {mode === 'login'
                  ? 'Đăng nhập demo'
                  : mode === 'signup'
                    ? 'Tạo tài khoản demo'
                    : mode === 'forgot'
                      ? 'Gửi liên kết đặt lại'
                      : 'Cập nhật mật khẩu'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            <div className="mt-5 flex justify-between text-sm font-semibold text-[var(--text-2)]">
              <Link href="/login">Đăng nhập</Link>
              <Link href="/signup">Đăng ký</Link>
              <Link href="/forgot-password">Quên mật khẩu</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function LabeledInput({
  label,
  defaultValue,
  icon,
  type = 'text',
}: {
  label: string;
  defaultValue?: string;
  icon?: ReactNode;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">{label}</span>
      <span className="relative block">
        {icon ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]">
            {icon}
          </span>
        ) : null}
        <Input className={icon ? 'pl-10' : ''} type={type} defaultValue={defaultValue} />
      </span>
    </label>
  );
}

export function DemoOverviewPage() {
  return (
    <div className="space-y-6">
      <DemoPageHeader
        eyebrow="Tổng quan demo"
        title="Bản thiết kế giao diện toàn hệ thống"
        description="Trang tổng hợp dữ liệu mẫu cho Candidate, Recruiter và Admin, bao phủ UC-CORE, UC-BASIC và UC-RM."
        action={
          <div className="flex gap-2">
            <Link href="/jobs">
              <Button variant="outline">Xem việc làm</Button>
            </Link>
            <Link href="/settings">
              <Button>Thiết lập LLM</Button>
            </Link>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DemoMetric
          icon={FileText}
          label="CV đã tải"
          value="18"
          helper="3 CV đang xử lý embedding"
        />
        <DemoMetric
          icon={BriefcaseBusiness}
          label="Tin đang mở"
          value="12"
          helper="2 JD cần cập nhật Qdrant"
        />
        <DemoMetric
          icon={Gauge}
          label="Hybrid trung bình"
          value="78%"
          helper="Dùng cho xếp hạng duy nhất"
        />
        <DemoMetric
          icon={Activity}
          label="Worker queue"
          value="94%"
          helper="Tỷ lệ hoàn tất trong ngày"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className={panelClass('p-5')}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-1)]">Luồng AI Pipeline</h2>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-[var(--success)]">
              demo-ready
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              ['1', 'Upload CV/JD', 'Parse text và cleanText'],
              ['2', 'Embedding', 'SBERT vector size 384'],
              ['3', 'Qdrant + BM25', 'Semantic + keyword score'],
              ['4', 'hybridScore', 'Xếp hạng và phản hồi AI'],
            ].map(([step, title, desc]) => (
              <div
                key={step}
                className="rounded-[10px] border border-[color:var(--border)] bg-slate-50 p-4"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[var(--blue-700)] font-mono text-sm font-bold text-white">
                  {step}
                </span>
                <p className="mt-3 text-sm font-bold text-[var(--text-1)]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">{desc}</p>
              </div>
            ))}
          </div>
        </section>
        <MatchScoreWidget hybridScore={82} semanticScore={0.82} keywordScore={0.65} />
      </div>
      <section className={panelClass('p-5')}>
        <h2 className="text-lg font-bold text-[var(--text-1)]">Ma trận giao diện theo use case</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ['UC-CORE', 'AI Pipeline', 'JD, CV, hybridScore, dashboard xếp hạng, feedback AI'],
            ['UC-BASIC', 'Foundation', 'Auth, profile, job listing, application history, pipeline'],
            [
              'UC-RM',
              'Resume Matcher',
              'Builder, template, JD match, enrichment, cover letter, export',
            ],
          ].map(([id, title, desc]) => (
            <div key={id} className="rounded-[10px] border border-[color:var(--border)] p-4">
              <p className="font-mono text-xs font-bold text-[var(--gold)]">{id}</p>
              <p className="mt-2 font-bold text-[var(--text-1)]">{title}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
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
    <section className={panelClass('p-5')}>
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
              ['Ngữ nghĩa SBERT', semanticScore],
              ['Từ khóa BM25', keywordScore],
              ['Hybrid ranking', hybridScore / 100],
            ].map(([label, value]) => {
              const percent = Math.round(Number(value) * 100);
              return (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--text-2)]">
                    <span>{label}</span>
                    <span className="font-mono">
                      {label === 'Hybrid ranking' ? `${hybridScore}%` : Number(value).toFixed(2)}
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
          <KeywordList title="Từ khóa đã khớp" items={matched} positive />
          <KeywordList title="Từ khóa còn thiếu" items={missing} />
        </div>
      </details>
    </section>
  );
}

function KeywordList({
  title,
  items,
  positive = false,
}: {
  title: string;
  items: string[];
  positive?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-xs font-bold uppercase tracking-[0.14em] ${positive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
      >
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${positive ? 'bg-green-50 text-[var(--success)]' : 'bg-red-50 text-[var(--danger)]'}`}
          >
            {positive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DemoJobsPage() {
  const [focusedJob, setFocusedJob] = useState(jobs[0]);
  const [closed, setClosed] = useState(false);
  return (
    <div className="space-y-6">
      <DemoPageHeader
        eyebrow="UC-CORE-01 · UC-BASIC-06/09/10/11"
        title="Tin tuyển dụng và trình tạo JD"
        description="Giao diện cho ứng viên duyệt việc làm và nhà tuyển dụng tạo, cập nhật, đóng mềm tin tuyển dụng."
        action={
          <Button>
            <Plus className="h-4 w-4" /> Tạo JD mới
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
        <section className={panelClass('p-5')}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[7px] border border-[color:var(--border)] bg-slate-50 px-3 text-sm text-[var(--text-2)]">
              <Search className="h-4 w-4 text-[var(--text-3)]" />
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Tìm theo vị trí, kỹ năng, địa điểm..."
              />
            </label>
            <div className="flex gap-2">
              <Button variant="outline">IT</Button>
              <Button variant="outline">Data</Button>
              <Button variant="outline">Marketing</Button>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setFocusedJob(job)}
                className={`w-full rounded-[10px] border p-4 text-left transition ${focusedJob.id === job.id ? 'border-[var(--blue-700)] bg-blue-50/60' : 'border-[color:var(--border)] bg-white hover:bg-slate-50'}`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-bold text-[var(--text-1)]">{job.title}</p>
                    <p className="mt-1 text-sm text-[var(--text-2)]">
                      {job.company} · {job.location}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${job.status === 'active' ? 'bg-green-50 text-[var(--success)]' : 'bg-slate-100 text-[var(--text-2)]'}`}
                  >
                    {job.status === 'active' ? 'Đang mở' : 'Đã đóng'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-2)]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
        <aside className={panelClass('p-5')}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-1)]">Biểu mẫu JD</h2>
            <span className="rounded-full bg-[var(--gold-dim)] px-3 py-1 font-mono text-xs text-[var(--gold)]">
              {focusedJob.id}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            <LabeledInput label="Tiêu đề" defaultValue={focusedJob.title} />
            <LabeledInput label="Danh mục" defaultValue={focusedJob.category} />
            <LabeledInput label="Địa điểm" defaultValue={focusedJob.location} />
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">
                Mô tả và yêu cầu
              </span>
              <Textarea
                defaultValue={
                  'Thiết kế API, tối ưu pipeline AI, phối hợp worker embedding và scoring. Yêu cầu kinh nghiệm Node.js, MongoDB, Qdrant, Redis và Docker.'
                }
                className="min-h-40"
              />
            </label>
            <div className="rounded-[10px] border border-[color:var(--border)] bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">
                Qdrant sync demo
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Khi lưu JD: cleanText → SBERT embedding → upsert jobs_vectors.
              </p>
            </div>
            {closed && (
              <p className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-[var(--warning)]">
                Demo: tin đã được đóng mềm, Qdrant point sẽ bị xóa trong cùng request.
              </p>
            )}
            <div className="flex gap-2">
              <Button className="flex-1">
                <Save className="h-4 w-4" /> Lưu JD
              </Button>
              <Button variant="warning" onClick={() => setClosed(true)}>
                Đóng tin
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function DemoApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | PipelineStatus>('all');
  const visible = candidates
    .filter((item) => statusFilter === 'all' || item.status === statusFilter)
    .sort((a, b) => b.hybridScore - a.hybridScore);

  return (
    <div className="space-y-6">
      <DemoPageHeader
        eyebrow="UC-CORE-04 · UC-BASIC-12/13"
        title="Bảng xếp hạng ứng viên"
        description="Danh sách ứng tuyển được sắp xếp theo hybridScore giảm dần, có lọc trạng thái pipeline và thao tác tải CV gốc."
      />
      <div className="flex flex-wrap gap-2 rounded-[12px] border border-[color:var(--border)] bg-white p-3">
        {(['all', 'new', 'screening', 'interview', 'hired', 'rejected'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setStatusFilter(item)}
            className={`rounded-[7px] px-3 py-2 text-sm font-bold ${statusFilter === item ? 'bg-[var(--blue-700)] text-white' : 'bg-slate-50 text-[var(--text-2)]'}`}
          >
            {item === 'all' ? 'Tất cả' : pipelineLabels[item]}
          </button>
        ))}
      </div>
      <section className="overflow-hidden rounded-[12px] border border-[color:var(--border)] bg-white shadow-[var(--shadow-elev-1)]">
        {visible.map((candidate) => {
          const band = scoreBand(candidate.hybridScore);
          return (
            <article
              key={candidate.id}
              className="grid gap-4 border-b border-[color:var(--border)] p-4 last:border-b-0 xl:grid-cols-[1fr_250px_150px_190px] xl:items-center"
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
                  <p className="mt-1 text-xs text-[var(--text-3)]">{candidate.resume}</p>
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs font-bold text-[var(--text-2)]">
                  <span>hybridScore</span>
                  <span className="font-mono">{candidate.hybridScore}%</span>
                </div>
                <span className="block h-2.5 rounded-full bg-slate-100">
                  <span
                    className="block h-2.5 rounded-full"
                    style={{ width: `${candidate.hybridScore}%`, backgroundColor: band.color }}
                  />
                </span>
              </div>
              <div className="space-y-2">
                <span className="block w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-[var(--text-2)]">
                  {pipelineLabels[candidate.status]}
                </span>
                <span className="block w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[var(--blue-700)]">
                  {aiStatusLabels[candidate.aiStatus]}
                </span>
              </div>
              <div className="flex gap-2 xl:justify-end">
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

export function DemoFlowPage() {
  const [step, setStep] = useState(2);
  return (
    <div className="space-y-6">
      <DemoPageHeader
        eyebrow="UC-CORE-02/03/05 · UC-RM-02"
        title="Luồng ứng tuyển AI"
        description="Mô phỏng upload CV, nhập JD, tạo bản xem trước tối ưu, xác nhận CV và nộp ứng tuyển."
      />
      <div className="grid gap-4 md:grid-cols-5">
        {['Tải CV gốc', 'Nhập JD', 'AI gợi ý', 'Xuất PDF', 'Nộp hồ sơ'].map((item, index) => (
          <button
            key={item}
            onClick={() => setStep(index)}
            className={`rounded-[10px] border p-4 text-left ${step >= index ? 'border-green-200 bg-green-50' : 'border-[color:var(--border)] bg-white'}`}
          >
            <span className="font-mono text-xs font-bold text-[var(--text-3)]">
              Bước {index + 1}
            </span>
            <p className="mt-2 text-sm font-bold text-[var(--text-1)]">{item}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className={panelClass('p-5')}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[10px] border border-dashed border-[var(--blue-700)] bg-blue-50 p-5">
              <FileText className="h-8 w-8 text-[var(--blue-700)]" />
              <p className="mt-4 font-bold text-[var(--text-1)]">master-resume.pdf</p>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                Đã parse rawText, đang upsert resumes_vectors.
              </p>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">JD mục tiêu</span>
              <Textarea
                className="min-h-44"
                defaultValue="Cần kỹ sư frontend có kinh nghiệm React, Next.js, TypeScript, Playwright và thiết kế hệ thống component dễ truy cập."
              />
            </label>
          </div>
          <div className="mt-5 rounded-[10px] border border-[color:var(--border)] bg-slate-50 p-4">
            <p className="text-sm font-bold text-[var(--text-1)]">Bản xem trước thay đổi AI</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-2)]">
              <li>+ Bổ sung bullet về Next.js và TypeScript trong phần kinh nghiệm.</li>
              <li>+ Gợi ý thêm Playwright vào kỹ năng còn thiếu.</li>
              <li>+ Tăng mật độ từ khóa phù hợp JD nhưng giữ văn phong tự nhiên.</li>
            </ul>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button>
              <WandSparkles className="h-4 w-4" /> Tạo gợi ý
            </Button>
            <Button variant="outline">Xác nhận tạo CV</Button>
            <Button variant="success">Nộp ứng tuyển</Button>
          </div>
        </section>
        <MatchScoreWidget hybridScore={82} semanticScore={0.82} keywordScore={0.65} />
      </div>
    </div>
  );
}

export function DemoBuilderPage() {
  const [tab, setTab] = useState<'sections' | 'format' | 'template'>('sections');
  const [columns, setColumns] = useState<'one' | 'two'>('two');
  const [compact, setCompact] = useState(30);
  const sections = ['Tóm tắt', 'Kinh nghiệm', 'Học vấn', 'Kỹ năng', 'Dự án'];
  return (
    <div className="space-y-6">
      <DemoPageHeader
        eyebrow="UC-RM-01/03/04/05/06/10"
        title="Resume Builder và xem trước trực tiếp"
        description="Quản lý CV gốc, phiên bản theo parentResumeId, kéo thả mục, chọn mẫu, định dạng và xuất PDF WYSIWYG."
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className={panelClass('p-5')}>
          <div className="grid grid-cols-3 gap-1 rounded-[8px] bg-slate-100 p-1">
            {[
              ['sections', 'Mục CV'],
              ['format', 'Định dạng'],
              ['template', 'Mẫu'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key as typeof tab)}
                className={`rounded-[7px] px-2 py-2 text-sm font-bold ${tab === key ? 'bg-white text-[var(--blue-700)] shadow-sm' : 'text-[var(--text-2)]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'sections' && (
            <div className="mt-5 space-y-2">
              {sections.map((section, index) => (
                <div
                  key={section}
                  className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] p-3"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-1)]">
                    <GripVertical className="h-4 w-4 text-[var(--text-3)]" /> {section}
                  </span>
                  <button
                    className={`flex h-6 w-11 items-center rounded-full p-1 ${index === 4 ? 'bg-slate-200' : 'bg-[var(--blue-700)]'}`}
                    aria-label={`Bật tắt mục ${section}`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-white transition ${index === 4 ? '' : 'translate-x-5'}`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
          {tab === 'format' && (
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
              <LabeledInput label="Khổ giấy" defaultValue="A4" />
              <LabeledInput label="Lề trang" defaultValue="18 mm" />
            </div>
          )}
          {tab === 'template' && (
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
              <Button variant="outline">Classic</Button>
              <Button>Modern</Button>
            </div>
          )}
          <div className="mt-6 rounded-[10px] border border-[color:var(--border)] bg-slate-50 p-4">
            <p className="text-sm font-bold text-[var(--text-1)]">Lịch sử phiên bản</p>
            {resumes.map((resume) => (
              <div key={resume.id} className="mt-3 rounded-[8px] bg-white p-3">
                <p className="text-sm font-semibold">{resume.title}</p>
                <p className="text-xs text-[var(--text-2)]">{resume.version}</p>
              </div>
            ))}
          </div>
        </aside>
        <section className="rounded-[12px] border border-[color:var(--border)] bg-slate-100 p-5">
          <div
            className="mx-auto min-h-[780px] max-w-[780px] bg-white p-10 shadow-[0_20px_50px_rgba(15,23,42,.14)]"
            style={{ fontSize: `${15 - compact / 90}px` }}
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
                <ResumeSection
                  title="Tóm tắt"
                  body="Xây dựng quy trình tuyển dụng giàu dữ liệu, dashboard dễ truy cập và hệ thống thiết kế cho ứng viên lẫn nhà tuyển dụng."
                />
                <ResumeSection
                  title="Kinh nghiệm"
                  body="Dẫn dắt nhóm React và Next.js triển khai dashboard xếp hạng ứng viên, xuất CV PDF và vòng phản hồi AI."
                />
                <ResumeSection
                  title="Học vấn"
                  body="Cử nhân Khoa học máy tính, định hướng kỹ thuật sản phẩm."
                />
              </main>
              <aside>
                <ResumeSection
                  title="Kỹ năng"
                  body="React · Next.js · TypeScript · Tailwind · Accessibility · SBERT UX"
                />
              </aside>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ResumeSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-8">
      <h3 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-2)]">
        {title}
      </h3>
      <p className="mt-3 leading-6 text-[var(--text-1)]">{body}</p>
    </section>
  );
}

export function DemoTailorPage() {
  const [tab, setTab] = useState<'cover' | 'outreach'>('cover');
  return (
    <div className="space-y-6">
      <DemoPageHeader
        eyebrow="UC-RM-07/08/09"
        title="Đối sánh JD, làm giàu CV và tạo tài liệu ứng tuyển"
        description="Giao diện so sánh JD với CV, tô sáng từ khóa, gợi ý bullet point, tạo thư ứng tuyển và email outreach."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-4 lg:grid-cols-2">
          <DocumentPanel title="Mô tả công việc mục tiêu">
            Chúng tôi cần kỹ sư frontend có kinh nghiệm với <Mark ok>React</Mark>,{' '}
            <Mark ok>Next.js</Mark>, TypeScript vững và <Mark>Playwright</Mark>. Đội ngũ ưu tiên
            design tokens, giao diện dễ truy cập và giám sát hàng đợi.
          </DocumentPanel>
          <DocumentPanel title="CV ứng viên đã tải lên">
            Dẫn dắt giao diện sản phẩm bằng <Mark ok>React</Mark> và <Mark ok>Next.js</Mark>. Xây
            dựng hệ thống component TypeScript và luồng ứng tuyển dễ truy cập cho tuyển dụng AI.
          </DocumentPanel>
        </section>
        <div className="space-y-4">
          <MatchScoreWidget hybridScore={82} semanticScore={0.82} keywordScore={0.65} />
          <section className={panelClass('p-5')}>
            <div className="grid grid-cols-2 gap-1 rounded-[8px] bg-slate-100 p-1">
              <button
                onClick={() => setTab('cover')}
                className={`rounded-[7px] px-3 py-2 text-sm font-bold ${tab === 'cover' ? 'bg-white shadow-sm' : ''}`}
              >
                Thư ứng tuyển
              </button>
              <button
                onClick={() => setTab('outreach')}
                className={`rounded-[7px] px-3 py-2 text-sm font-bold ${tab === 'outreach' ? 'bg-white shadow-sm' : ''}`}
              >
                Email outreach
              </button>
            </div>
            <Textarea
              className="mt-4 min-h-52"
              value={
                tab === 'cover'
                  ? 'Kính gửi đội ngũ tuyển dụng,\n\nTôi quan tâm tới vị trí này vì kinh nghiệm React, Next.js và thiết kế hệ thống component của tôi phù hợp với yêu cầu...'
                  : 'Xin chào,\n\nTôi thấy đội ngũ đang tìm kỹ sư frontend cho sản phẩm AI. Tôi muốn chia sẻ CV tối ưu theo JD và một vài kết quả liên quan...'
              }
              readOnly
            />
            <Button className="mt-4 w-full">
              <Sparkles className="h-4 w-4" /> Tạo nội dung bằng AI
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

function Mark({ children, ok = false }: { children: ReactNode; ok?: boolean }) {
  return (
    <mark
      className={
        ok
          ? 'rounded bg-green-100 px-1 text-green-800'
          : 'rounded bg-red-50 px-1 text-[var(--danger)] underline decoration-dotted'
      }
    >
      {children}
    </mark>
  );
}

function DocumentPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className={panelClass('min-h-[520px] p-6')}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--text-1)]">{title}</h2>
        <ChevronDown className="h-4 w-4 text-[var(--text-3)]" />
      </div>
      <p className="text-base leading-8 text-[var(--text-2)]">{children}</p>
      <div className="mt-8 flex items-center gap-2 rounded-[8px] border border-[color:var(--border)] bg-slate-50 p-3 text-sm text-[var(--text-2)]">
        <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
        Phần tô sáng giúp tách bằng chứng đã khớp khỏi yêu cầu JD còn thiếu.
      </div>
    </article>
  );
}

export function DemoProfilePage() {
  return (
    <div className="space-y-6">
      <DemoPageHeader
        eyebrow="UC-BASIC-05"
        title="Hồ sơ cá nhân ứng viên"
        description="Giao diện quản lý hồ sơ cá nhân, kỹ năng, kinh nghiệm, học vấn và portfolio."
      />
      <section className={panelClass('p-5')}>
        <div className="grid gap-4 md:grid-cols-2">
          <LabeledInput label="Tiêu đề nghề nghiệp" defaultValue="Senior Frontend Engineer" />
          <LabeledInput label="Địa điểm" defaultValue="TP. Hồ Chí Minh" />
          <LabeledInput label="Số điện thoại" defaultValue="+84 900 123 456" />
          <LabeledInput label="Website" defaultValue="https://maya.dev" />
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">
              Tóm tắt năng lực
            </span>
            <Textarea defaultValue="Kỹ sư frontend có 6 năm kinh nghiệm xây dựng sản phẩm SaaS, hệ thống thiết kế, dashboard tuyển dụng và trải nghiệm AI cho ứng viên." />
          </label>
          <LabeledInput
            label="Kỹ năng"
            defaultValue="React, Next.js, TypeScript, Tailwind, Accessibility"
          />
          <LabeledInput
            label="Portfolio"
            defaultValue="https://maya.dev/case-studies, https://github.com/maya"
          />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {['Kinh nghiệm', 'Học vấn', 'Dự án'].map((title) => (
            <div
              key={title}
              className="rounded-[10px] border border-[color:var(--border)] bg-slate-50 p-4"
            >
              <p className="font-bold text-[var(--text-1)]">{title}</p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Mục dữ liệu mẫu có thể thêm, sửa hoặc xóa trong giao diện thật.
              </p>
              <Button className="mt-3" variant="outline" size="sm">
                <Plus className="h-4 w-4" /> Thêm mục
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button>
            <Save className="h-4 w-4" /> Lưu hồ sơ
          </Button>
        </div>
      </section>
    </div>
  );
}

export function DemoSettingsPage() {
  const [provider, setProvider] = useState('openai');
  const [privacy, setPrivacy] = useState('hybrid');
  return (
    <div className="space-y-6">
      <DemoPageHeader
        eyebrow="UC-RM-11/12 · Admin systemconfigs"
        title="Thiết lập hệ thống, LLM và hồ sơ công ty"
        description="Demo giao diện quản trị systemconfigs: provider AI, privacy mode, feature flags, ngôn ngữ, hồ sơ công ty và vùng nguy hiểm."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className={panelClass('p-5')}>
          <div className="flex items-center gap-2 border-b border-[color:var(--border)] pb-3">
            <KeyRound className="h-4 w-4 text-[var(--blue-700)]" />
            <h2 className="font-bold text-[var(--text-1)]">Cấu hình LLM</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {['openai', 'anthropic', 'gemini', 'deepseek', 'openrouter', 'ollama'].map((item) => (
              <button
                key={item}
                onClick={() => setProvider(item)}
                className={`rounded-[10px] border p-4 text-left ${provider === item ? 'border-[var(--blue-700)] bg-blue-50' : 'border-[color:var(--border)] bg-white'}`}
              >
                <p className="font-bold capitalize">{item}</p>
                <p className="mt-1 text-xs text-[var(--text-2)]">
                  {item === 'ollama' ? 'Local provider' : 'Cloud provider'}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <LabeledInput
              label="Model"
              defaultValue={provider === 'ollama' ? 'gemma3:4b' : 'gpt-5-nano'}
            />
            <LabeledInput
              label="Base URL"
              defaultValue={
                provider === 'ollama' ? 'http://localhost:11434' : 'https://api.provider.com/v1'
              }
            />
            <LabeledInput label="API key" defaultValue="sk-demo-••••••••" type="password" />
            <div className="rounded-[10px] border border-green-200 bg-green-50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-[var(--success)]">
                <CheckCircle2 className="h-4 w-4" /> Kết nối thành công
              </p>
              <p className="mt-2 text-xs text-green-800">
                Demo health check: provider phản hồi trong 420ms.
              </p>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button>
              <Save className="h-4 w-4" /> Lưu cấu hình
            </Button>
            <Button variant="outline">
              <Activity className="h-4 w-4" /> Kiểm tra kết nối
            </Button>
          </div>
        </section>
        <aside className={panelClass('p-5')}>
          <h2 className="font-bold text-[var(--text-1)]">Privacy mode</h2>
          <div className="mt-4 space-y-2">
            {[
              ['hybrid', 'Hybrid', 'Ưu tiên local, dùng cloud khi cần'],
              ['local_only', 'Local only', 'Chỉ dùng Ollama nội bộ'],
              ['cloud_only', 'Cloud only', 'Dùng provider API đã cấu hình'],
            ].map(([key, label, desc]) => (
              <button
                key={key}
                onClick={() => setPrivacy(key)}
                className={`w-full rounded-[10px] border p-3 text-left ${privacy === key ? 'border-[var(--blue-700)] bg-blue-50' : 'border-[color:var(--border)] bg-white'}`}
              >
                <p className="font-bold">{label}</p>
                <p className="text-xs text-[var(--text-2)]">{desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-[10px] border border-[color:var(--border)] bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="h-4 w-4 text-[var(--blue-700)]" /> Quyền truy cập
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">
              Admin có quyền ghi systemconfigs. Recruiter và Candidate chỉ xem các khóa được phép.
            </p>
          </div>
        </aside>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <section className={panelClass('p-5 xl:col-span-2')}>
          <h2 className="flex items-center gap-2 font-bold text-[var(--text-1)]">
            <Building2 className="h-4 w-4" /> Hồ sơ công ty
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <LabeledInput label="Tên công ty" defaultValue="Aster Talent" />
            <LabeledInput label="Ngành" defaultValue="HR Tech" />
            <LabeledInput label="Quy mô" defaultValue="51-200" />
            <LabeledInput label="Website" defaultValue="https://astertalent.vn" />
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[var(--text-1)]">Giới thiệu</span>
              <Textarea defaultValue="Doanh nghiệp phát triển nền tảng tuyển dụng tích hợp AI cho ứng viên và nhà tuyển dụng." />
            </label>
          </div>
        </section>
        <section className={panelClass('p-5')}>
          <h2 className="flex items-center gap-2 font-bold text-[var(--text-1)]">
            <Languages className="h-4 w-4" /> Ngôn ngữ & tính năng
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {['VI', 'EN', 'ES', 'ZH', 'JA', 'PT'].map((lang) => (
              <button
                key={lang}
                className={`rounded-[7px] border px-3 py-2 text-sm font-bold ${lang === 'VI' ? 'border-[var(--blue-700)] bg-blue-50 text-[var(--blue-700)]' : 'border-[color:var(--border)] bg-white'}`}
              >
                {lang}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {['Tạo thư ứng tuyển', 'Tạo email outreach', 'Gợi ý bullet AI'].map((item) => (
              <label
                key={item}
                className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] p-3 text-sm font-bold"
              >
                {item}
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 accent-[var(--blue-700)]"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
      <section className={panelClass('border-red-200 bg-red-50/50 p-5')}>
        <h2 className="flex items-center gap-2 font-bold text-red-800">
          <Trash2 className="h-4 w-4" /> Vùng nguy hiểm
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="border-red-200 text-red-700">
            Xóa toàn bộ API keys
          </Button>
          <Button variant="destructive">Reset dữ liệu demo</Button>
        </div>
      </section>
    </div>
  );
}
