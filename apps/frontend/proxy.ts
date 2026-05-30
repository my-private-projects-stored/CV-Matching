import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
      const dest =
        role === 'admin'
          ? '/admin/config'
          : role === 'recruiter'
            ? '/recruiter/dashboard'
            : '/candidate/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  const isAppRoute =
    pathname.startsWith('/candidate') ||
    pathname.startsWith('/recruiter') ||
    pathname.startsWith('/admin');

  if (!isAppRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = decodeRole(token);
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/candidate/dashboard', request.url));
  }
  if (pathname.startsWith('/recruiter') && role !== 'recruiter' && role !== 'admin') {
    return NextResponse.redirect(new URL('/candidate/dashboard', request.url));
  }
  if (pathname.startsWith('/candidate') && role === 'recruiter') {
    return NextResponse.redirect(new URL('/recruiter/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
