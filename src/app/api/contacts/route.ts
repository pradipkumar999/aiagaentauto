import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 1000').all();
    return NextResponse.json(contacts);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

interface ContactInput {
  name?: string;
  email: string;
  website?: string;
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const contacts: ContactInput[] = Array.isArray(data) ? data : [data];

    const insert = db.prepare('INSERT OR IGNORE INTO contacts (name, email, website) VALUES (?, ?, ?)');
    
    let successCount = 0;
    const transaction = db.transaction((rows: ContactInput[]) => {
      for (const row of rows) {
        if (row.email) {
          insert.run(row.name || row.email.split('@')[0], row.email, row.website || '');
          successCount++;
        }
      }
    });

    transaction(contacts);
    return NextResponse.json({ success: true, count: successCount });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const all = searchParams.get('all');

  if (all === 'true') {
    db.prepare('DELETE FROM contacts').run();
    return NextResponse.json({ success: true });
  }

  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
