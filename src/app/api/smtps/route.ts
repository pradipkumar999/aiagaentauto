import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const smtps = db.prepare('SELECT * FROM smtps ORDER BY created_at DESC').all();
    return NextResponse.json(smtps);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { host, port, user, pass, from_name, from_email, secure } = await req.json();
    
    if (!host || !port || !user || !pass || !from_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const stmt = db.prepare(`
      INSERT INTO smtps (host, port, user, pass, from_name, from_email, secure)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(host, port, user, pass, from_name || '', from_email, secure ? 1 : 0);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, host, port, user, pass, from_name, from_email, secure } = await req.json();
    
    if (!id || !host || !port || !user || !from_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (pass) {
      const stmt = db.prepare(`
        UPDATE smtps 
        SET host = ?, port = ?, user = ?, pass = ?, from_name = ?, from_email = ?, secure = ?
        WHERE id = ?
      `);
      stmt.run(host, port, user, pass, from_name || '', from_email, secure ? 1 : 0, id);
    } else {
      const stmt = db.prepare(`
        UPDATE smtps 
        SET host = ?, port = ?, user = ?, from_name = ?, from_email = ?, secure = ?
        WHERE id = ?
      `);
      stmt.run(host, port, user, from_name || '', from_email, secure ? 1 : 0, id);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    db.prepare('UPDATE smtps SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    db.prepare('DELETE FROM smtps WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
