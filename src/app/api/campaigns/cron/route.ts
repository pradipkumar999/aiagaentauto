import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { processCampaignBatch } from '@/lib/campaign';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'my_secure_cron_key_123';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (key !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const origin = new URL(req.url).origin;
    const result = await processCampaignBatch(origin);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
