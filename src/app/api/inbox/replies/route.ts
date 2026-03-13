import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const emailId = searchParams.get('emailId');
    const contactId = searchParams.get('contactId');

    if (emailId) {
      const { data: replies, error } = await supabase
        .from('replies')
        .select('*')
        .eq('email_id', emailId)
        .order('received_at', { ascending: true });
      
      if (error) throw error;
      return NextResponse.json(replies);
    }

    if (contactId) {
      const { data: replies, error } = await supabase
        .from('replies')
        .select('*')
        .eq('contact_id', contactId)
        .order('received_at', { ascending: true });

      if (error) throw error;
      return NextResponse.json(replies);
    }

    return NextResponse.json({ error: 'Missing emailId or contactId' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
