import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { login } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    // ENV Fallback check for Vercel
    const adminEmail = process.env.ADMIN_EMAIL || 'pradipchoudhary11@gmail.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'password';

    if (email === adminEmail && password === adminPass) {
      await login({ id: 1, email: adminEmail });
      return NextResponse.json({ success: true });
    }

    const user = db.prepare('SELECT id, email FROM users WHERE email = ? AND password = ?').get(email, password) as { id: number, email: string } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await login({ id: user.id, email: user.email });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
