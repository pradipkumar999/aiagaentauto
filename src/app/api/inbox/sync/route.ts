import { NextResponse } from 'next/server';
import { syncReplies, processFollowUps } from '@/lib/replies';
import supabase from '@/lib/db';

const CRON_SECRET = process.env.CRON_SECRET || 'my_secure_cron_key_123';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (key !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

export async function POST(req: Request) {
  return GET(req);
}
