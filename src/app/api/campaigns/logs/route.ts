import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('id');
    
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const { data: logs, error } = await supabase
      .from('campaign_logs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
