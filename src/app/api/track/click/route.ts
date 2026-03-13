import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trackingId = searchParams.get('id');
  const targetUrl = searchParams.get('url');

  if (trackingId) {
    try {
      db.prepare('UPDATE emails SET clicked = clicked + 1 WHERE tracking_id = ?').run(trackingId);
    } catch (err) {
      console.error('Failed to track email click:', err);
    }
  }

  if (!targetUrl) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Redirect to the final URL
  return NextResponse.redirect(new URL(targetUrl));
}
