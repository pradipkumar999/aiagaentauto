import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET() {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const { data: smtps, error } = await supabase
      .from('smtps')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(smtps);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const { host, port, user, pass, from_name, from_email, secure } = await req.json();
    
    if (!host || !port || !user || !pass || !from_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('smtps')
      .insert({
        host,
        port,
        user,
        pass,
        from_name: from_name || '',
        from_email,
        secure: secure ? 1 : 0
      });

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const { id, host, port, user, pass, from_name, from_email, secure } = await req.json();
    
    if (!id || !host || !port || !user || !from_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const updateData: {
      host: string;
      port: number;
      user: string;
      from_name: string;
      from_email: string;
      secure: number;
      pass?: string;
    } = {
      host,
      port,
      user,
      from_name: from_name || '',
      from_email,
      secure: secure ? 1 : 0
    };

    if (pass) {
      updateData.pass = pass;
    }

    const { error } = await supabase
      .from('smtps')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const { id, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { error } = await supabase
      .from('smtps')
      .update({ is_active: is_active ? 1 : 0 })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { error } = await supabase
      .from('smtps')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
