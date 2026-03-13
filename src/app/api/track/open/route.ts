import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trackingId = searchParams.get('id');

  if (trackingId) {
    try {
      // In Postgres/Supabase, we can use RPC or fetch-then-update for increments
      // Fetch current count
      const { data } = await supabase
        .from('emails')
        .select('opened')
        .eq('tracking_id', trackingId)
        .single();

      if (data) {
        await supabase
          .from('emails')
          .update({ opened: (data.opened || 0) + 1 })
          .eq('tracking_id', trackingId);
      }
    } catch (err) {
      console.error('Failed to track email open:', err);
    }
  }

  // Return a 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  return new NextResponse(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
