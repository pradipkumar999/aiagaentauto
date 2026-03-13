import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { login } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // ENV Fallback check for Vercel
    const adminEmail = process.env.ADMIN_EMAIL || 'pradipchoudhary11@gmail.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'password';

    console.log('Login attempt for:', email);

    if (email === adminEmail && password === adminPass) {
      await login({ id: 1, email: adminEmail });
      return NextResponse.json({ success: true });
    }

    if (!supabase) {
      console.error('Supabase client is null. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error) {
      console.error('Supabase login error:', error.message);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await login({ id: user.id as unknown as number, email: user.email });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
