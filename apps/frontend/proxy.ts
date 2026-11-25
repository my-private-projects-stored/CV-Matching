import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canonicalizeRole, defaultDashboardForRole } from './lib/auth/roles';

const AUTH_COOKIE = 'cvm_token';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function decodeRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: string;
    };
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    const token = request.cookies.get(AUTH_COOKIE)?.value;
    if (token) {
      const role = decodeRole(token);
      return NextResponse.redirect(new URL(defaultDashboardForRole(role), request.url));
    }
    return NextResponse.next();
  }

  const isAppRoute =
    pathname.startsWith('/candidate') ||
    pathname.startsWith('/recruiter') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/owner');

  if (!isAppRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const canonicalRole = canonicalizeRole(decodeRole(token));
  const fallbackDest = defaultDashboardForRole(canonicalRole);

  if (pathname.startsWith('/owner') && canonicalRole !== 'platform_owner') {
    return NextResponse.redirect(new URL(fallbackDest, request.url));
  }
  if (pathname.startsWith('/admin') && canonicalRole !== 'tech_staff') {
    return NextResponse.redirect(new URL(fallbackDest, request.url));
  }
  if (
    pathname.startsWith('/recruiter') &&
    canonicalRole !== 'recruiter' &&
    canonicalRole !== 'tech_staff'
  ) {
    return NextResponse.redirect(new URL(fallbackDest, request.url));
  }
  if (
    pathname.startsWith('/candidate') &&
    canonicalRole !== 'candidate' &&
    canonicalRole !== 'tech_staff'
  ) {
    return NextResponse.redirect(new URL(fallbackDest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
