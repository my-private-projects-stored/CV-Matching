'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';
import { useAuth } from '@/lib/context/auth-context';

export const SwissGrid = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslations();
  const { user } = useAuth();
  const isRecruiterOrAdmin = user?.role === 'recruiter' || user?.role === 'admin';

  return (
    // 1. Outer Wrapper: Fixed height with grid background
    <div
      className="h-screen w-full flex justify-center items-start py-12 px-4 md:px-8 overflow-hidden bg-[var(--canvas)]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(21, 94, 239, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(21, 94, 239, 0.08) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    >
      {/* 2. The Main Container: Sharp black borders, creating the "Canvas" */}
      <div className="w-full max-w-[86rem] max-h-full rounded-3xl border border-[color:var(--border)] bg-[var(--surface-muted)] shadow-[0_24px_48px_rgba(15,27,45,0.16)] flex flex-col overflow-hidden">
        {/* Header Section - stays above hovered cards */}
        <div className="border-b border-[color:var(--border)] p-8 md:p-12 shrink-0 bg-[var(--surface-muted)] relative z-30">
          <h1 className="font-serif text-5xl md:text-7xl text-black tracking-tight leading-[0.95] uppercase">
            {t('nav.dashboard')}
          </h1>
          <p className="mt-6 text-sm text-[var(--primary)] uppercase tracking-[0.2em] max-w-md font-semibold">
            {'// '}
            {t('dashboard.selectModule')}
          </p>
        </div>

        {/* Content Grid - Scrollable area with NO padding */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
          <div className="p-[1.5px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 bg-[color:var(--border)] gap-[1px] border-b border-[color:var(--border)]">
              {children}
            </div>
          </div>
        </div>

        {/* Footer - stays above hovered cards */}
        <div className="p-4 bg-[var(--surface-muted)] flex justify-between items-center text-xs text-[var(--primary)] border-t border-[color:var(--border)] shrink-0 relative z-30">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Resume Matcher"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            <span className="uppercase font-semibold tracking-[0.2em]">Resume Matcher</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/flow"
              className="bg-[var(--primary)] text-white border border-[color:var(--border)] px-6 py-2 uppercase font-semibold tracking-[0.2em] shadow-[0_10px_20px_rgba(15,27,45,0.18)] hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(15,27,45,0.22)] transition-all min-w-[140px] text-center rounded-xl"
            >
              {t('nav.flow')}
            </Link>
            {isRecruiterOrAdmin ? (
              <Link
                href="/settings"
                className="bg-amber-500 text-black border border-[color:var(--border)] px-6 py-2 uppercase font-semibold tracking-[0.2em] shadow-[0_10px_20px_rgba(15,27,45,0.18)] hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(15,27,45,0.22)] transition-all min-w-[140px] text-center rounded-xl"
              >
                {t('nav.settings')}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
