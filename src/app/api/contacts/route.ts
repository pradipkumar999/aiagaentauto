import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error) throw error;
    return NextResponse.json(data);
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
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const data = await req.json();
    const contacts: ContactInput[] = Array.isArray(data) ? data : [data];

    const toInsert = contacts
      .filter(c => c.email)
      .map(c => ({
        name: c.name || c.email.split('@')[0],
        email: c.email,
        website: c.website || ''
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const { error } = await supabase
      .from('contacts')
      .upsert(toInsert, { onConflict: 'email' });
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, count: toInsert.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all');

    if (all === 'true') {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .neq('id', -1); // Filter required for delete in Supabase/PostgREST
      
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
