import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(req: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const trackingId = searchParams.get('id');
  const targetUrl = searchParams.get('url');

  if (trackingId) {
    try {
      // Fetch current count
      const { data } = await supabase
        .from('emails')
        .select('clicked')
        .eq('tracking_id', trackingId)
        .single();

      if (data) {
        await supabase
          .from('emails')
          .update({ clicked: (data.clicked || 0) + 1 })
          .eq('tracking_id', trackingId);
      }
    } catch (err) {
      console.error('Failed to track email click:', err);
    }
  }

  if (!targetUrl) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Redirect to the final URL
  try {
    return NextResponse.redirect(new URL(targetUrl));
  } catch {
    return NextResponse.redirect(new URL('/', req.url));
  }
}
