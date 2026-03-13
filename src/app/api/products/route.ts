import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const products = db.prepare('SELECT * FROM affiliate_products').all();
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, description, link, audience, commission } = await req.json();
    const stmt = db.prepare('INSERT INTO affiliate_products (name, description, link, audience, commission) VALUES (?, ?, ?, ?, ?)');
    stmt.run(name, description, link, audience, commission);
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

    const stmt = db.prepare('DELETE FROM affiliate_products WHERE id = ?');
    stmt.run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
