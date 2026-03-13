import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('id');
    
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const logs = db.prepare(`
      SELECT * FROM campaign_logs 
      WHERE campaign_id = ? 
      ORDER BY created_at ASC
    `).all(campaignId);

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
