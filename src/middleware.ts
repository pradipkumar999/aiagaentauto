import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// In Next.js middleware (Edge Runtime), we can't easily access the SQLite DB.
// For a production app, you should set this in your environment variables.
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_fallback_key_123'; 

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Define public paths
  const isPublicPath = 
    pathname.startsWith('/login') || 
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/api/track') ||
    pathname.includes('.');

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 2. Check for session cookie
  const token = request.cookies.get('session')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // 3. Verify token
    const secret = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Invalid token
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
