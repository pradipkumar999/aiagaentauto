import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contactId' }, { status: 400 });
    }

    const { data: emails, error } = await supabase
      .from('emails')
      .select('*')
      .eq('contact_id', contactId)
      .order('sent_at', { ascending: true });

    if (error) throw error;
    
    return NextResponse.json(emails);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
