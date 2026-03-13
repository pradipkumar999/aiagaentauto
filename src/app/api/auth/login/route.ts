import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
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

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client unavailable and ENV login failed' }, { status: 500 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await login({ id: user.id as unknown as number, email: user.email });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
