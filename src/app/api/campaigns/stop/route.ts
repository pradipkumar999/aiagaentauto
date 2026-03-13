import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function POST() {
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
  }
  try {
    const { error } = await supabase
      .from('settings')
      .update({ stop_requested: 1 })
      .eq('id', 1);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
