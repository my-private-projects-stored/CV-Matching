'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function Hero() {
  const { t } = useTranslations();

  return (
    <section className="min-h-screen w-full px-6 py-16 md:px-12 lg:px-24 app-shell">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">
              Nền tảng tuyển dụng AI
            </div>
            <h1 className="font-[var(--font-display)] text-4xl font-semibold leading-tight text-[var(--foreground)] md:text-6xl">
              Xây dựng hệ sinh thái tuyển dụng kết nối ứng viên và doanh nghiệp
            </h1>
            <p className="max-w-xl text-base text-[color:var(--text-muted)] md:text-lg">
              Trực quan hóa hành trình ứng tuyển, đo lường mức độ phù hợp bằng AI, và hỗ trợ nhà
              tuyển dụng ra quyết định dựa trên dữ liệu. Phù hợp cho đề tài nghiên cứu và triển khai
              thực tế.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(21,94,239,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(21,94,239,0.45)]"
              >
                {t('home.launchApp')}
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-white px-6 text-sm font-semibold text-[var(--foreground)] shadow-[0_10px_20px_rgba(15,27,45,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(15,27,45,0.18)]"
              >
                Đăng nhập
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: 'AI Matching', value: 'SBERT + BM25 + Qdrant' },
                { label: 'Minh bạch', value: 'Explainable AI Feedback' },
                { label: 'Quy trình', value: 'Candidate → Recruiter' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[color:var(--border)] bg-white p-6 shadow-[0_24px_48px_rgba(15,27,45,0.14)]">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--text-subtle)]">
                Insight Dashboard
              </p>
              <h2 className="mt-3 font-[var(--font-display)] text-2xl text-[var(--foreground)]">
                AI Score & Shortlist Dashboard
              </h2>
              <p className="mt-4 text-sm text-[color:var(--text-muted)]">
                Theo dõi điểm phù hợp, kỹ năng khớp và lộ trình xử lý hồ sơ theo thời gian thực.
              </p>
              <div className="mt-6 grid gap-3">
                {['Ứng viên nổi bật', 'Tín hiệu kỹ năng', 'Cảnh báo thiếu dữ liệu'].map(
                  (label, index) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3"
                    >
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {label}
                      </span>
                      <span className="text-xs font-semibold text-[color:var(--text-subtle)]">
                        #{index + 1}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-strong)] px-6 py-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                Research Focus
              </p>
              <p className="mt-3 text-sm text-white/90">
                Đề tài tập trung vào nền tảng công nghệ tuyển dụng tích hợp AI, tối ưu hóa việc kết
                nối ứng viên và doanh nghiệp bằng thuật toán đánh giá CV.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
