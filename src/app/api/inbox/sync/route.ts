import { NextResponse } from 'next/server';
import { syncReplies, processFollowUps } from '@/lib/replies';
import supabase from '@/lib/db';

export async function POST() {
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
  }
  try {
    const fetched = await syncReplies();
    const followUps = await processFollowUps();
    return NextResponse.json({ success: true, count: fetched, followUps });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
