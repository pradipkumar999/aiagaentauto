import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get('contactId');

  if (!contactId) {
    return NextResponse.json({ error: 'Missing contactId' }, { status: 400 });
  }

  const emails = db.prepare(`
    SELECT * FROM emails WHERE contact_id = ? ORDER BY sent_at ASC
  `).all(contactId);
  
  return NextResponse.json(emails);
}
