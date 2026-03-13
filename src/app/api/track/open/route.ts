import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trackingId = searchParams.get('id');

  if (trackingId) {
    try {
      db.prepare('UPDATE emails SET opened = opened + 1 WHERE tracking_id = ?').run(trackingId);
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
