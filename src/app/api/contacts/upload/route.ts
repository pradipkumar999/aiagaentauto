import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const content = Buffer.from(buffer).toString();
    
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Record<string, string>[];

    if (records.length > 0) {
      console.log("CSV Headers detected:", Object.keys(records[0]));
    }

    const insert = db.prepare('INSERT OR IGNORE INTO contacts (name, email, website) VALUES (?, ?, ?)');
    
    let successCount = 0;
    const transaction = db.transaction((rows: Record<string, string>[]) => {
      for (const row of rows) {
        // Find keys case-insensitively
        const findKey = (search: string) => {
          const key = Object.keys(row).find(k => k.toLowerCase() === search.toLowerCase());
          return key ? row[key] : null;
        };

        let email = findKey('email');
        const name = findKey('name');
        const website = findKey('website') || '';

        // Fallback: If no 'email' column found, check all columns for an @ symbol
        if (!email) {
          for (const val of Object.values(row)) {
            if (typeof val === 'string' && val.includes('@') && val.includes('.')) {
              email = val;
              break;
            }
          }
        }

        if (email) {
          insert.run(name || email.split('@')[0], email, website);
          successCount++;
        }
      }
    });

    transaction(records);
    console.log(`Successfully inserted ${successCount} contacts.`);
    return NextResponse.json({ success: true, count: successCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
