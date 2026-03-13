import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const stmt = db.prepare(`
      UPDATE settings 
      SET gemini_api_key = ?, 
          gemini_model = ?,
          daily_email_limit = ?, 
          default_tone = ?
      WHERE id = 1
    `);
    
    stmt.run(
      data.gemini_api_key,
      data.gemini_model,
      data.daily_email_limit,
      data.default_tone
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
