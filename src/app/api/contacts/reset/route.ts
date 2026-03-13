import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST() {
  try {
    db.prepare("UPDATE contacts SET status = 'pending'").run();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
