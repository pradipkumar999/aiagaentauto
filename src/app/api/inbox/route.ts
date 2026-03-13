import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET() {
  try {
    const { data: emails, error } = await supabase
      .from('emails')
      .select(`
        *,
        contact:contacts(name, email)
      `)
      .order('sent_at', { ascending: false });

    if (error) throw error;

    const formatted = emails.map((e: any) => ({
      ...e,
      contact_name: e.contact?.name,
      contact_email: e.contact?.email
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
