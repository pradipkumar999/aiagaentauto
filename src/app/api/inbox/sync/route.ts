import { NextResponse } from 'next/server';
import { syncReplies, processFollowUps } from '@/lib/replies';

export async function POST() {
  try {
    const fetched = await syncReplies();
    const followUps = await processFollowUps();
    return NextResponse.json({ success: true, count: fetched, followUps });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
