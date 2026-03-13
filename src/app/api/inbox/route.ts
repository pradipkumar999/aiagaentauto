import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const emails = db.prepare(`
    SELECT e.*, c.name as contact_name, c.email as contact_email
    FROM emails e
    JOIN contacts c ON e.contact_id = c.id
    ORDER BY e.sent_at DESC
  `).all();
  return NextResponse.json(emails);
}
