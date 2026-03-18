import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET() {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const data = await req.json();
    const { error } = await supabase
      .from('settings')
      .update({
        claude_api_key: data.claude_api_key,
        claude_model: data.claude_model,
        daily_email_limit: data.daily_email_limit,
        default_tone: data.default_tone
      })
      .eq('id', 1);
    
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
