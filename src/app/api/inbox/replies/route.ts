import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const emailId = searchParams.get('emailId');
  const contactId = searchParams.get('contactId');

  if (emailId) {
    const replies = db.prepare(`
      SELECT * FROM replies WHERE email_id = ? ORDER BY received_at ASC
    `).all(emailId);
    return NextResponse.json(replies);
  }

  if (contactId) {
    const replies = db.prepare(`
      SELECT * FROM replies WHERE contact_id = ? ORDER BY received_at ASC
    `).all(contactId);
    return NextResponse.json(replies);
  }

  return NextResponse.json({ error: 'Missing emailId or contactId' }, { status: 400 });
}
