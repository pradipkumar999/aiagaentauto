import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function POST() {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const { error } = await supabase
      .from('contacts')
      .update({ status: 'pending' })
      .not('id', 'is', null); // Update all rows
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
