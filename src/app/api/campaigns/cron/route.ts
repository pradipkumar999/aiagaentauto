import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { generateEmail } from '@/lib/gemini';
import { sendEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'my_secure_cron_key_123';
const BATCH_SIZE = 5; // Process 5 emails per cron run to stay under 10s Vercel limit

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (key !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
  }

  console.log('--- STARTING CAMPAIGN BATCH PROCESSOR ---');

  try {
    // 1. Get Active Campaign
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('*, product:affiliate_products(*)')
      .eq('status', 'active');

    if (!activeCampaigns || activeCampaigns.length === 0) {
      return NextResponse.json({ message: 'No active campaigns.' });
    }

    // 2. Get Global Settings
    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
    const perSmtpLimit = settings?.daily_email_limit || 50;

    // 3. Get Active SMTPs
    const { data: activeSmtps } = await supabase.from('smtps').select('*').eq('is_active', true);
    if (!activeSmtps || activeSmtps.length === 0) {
      return NextResponse.json({ error: 'No active SMTPs' }, { status: 500 });
    }

    // 4. Check SMTP Capacity for Today
    const today = new Date().toISOString().split('T')[0];
    
    interface SMTPWithCapacity {
      id: number;
      user: string;
      remaining: number;
    }
    
    const smtpCapacityMap: SMTPWithCapacity[] = [];
    
    for (const smtp of activeSmtps) {
      const { count } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('smtp_id', smtp.id)
        .gte('sent_at', `${today}T00:00:00`);
      
      const remaining = Math.max(0, perSmtpLimit - (count || 0));
      if (remaining > 0) {
        smtpCapacityMap.push({ 
          id: smtp.id, 
          user: smtp.user, 
          remaining 
        });
      }
    }

    if (smtpCapacityMap.length === 0) {
      return NextResponse.json({ message: 'All SMTPs hit daily limit. Resuming tomorrow.' });
    }

    // 5. Pick Batch of Contacts
    let totalProcessed = 0;
    const origin = new URL(req.url).origin;

    for (const campaign of activeCampaigns) {
      if (totalProcessed >= BATCH_SIZE) break;

      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('status', 'pending')
        .limit(BATCH_SIZE - totalProcessed);

      if (!contacts || contacts.length === 0) {
        // If no more pending contacts, mark campaign as completed
        await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaign.id);
        continue;
      }

      // 6. Process Batch (AI + Send)
      for (const contact of contacts) {
        // Pick SMTP (Round Robin / Rotation)
        const currentSmtp = smtpCapacityMap[totalProcessed % smtpCapacityMap.length];
        if (!currentSmtp || currentSmtp.remaining <= 0) continue;

        try {
          // Generate AI Content (Slow)
          const emailData = await generateEmail(
            contact.name || contact.email.split('@')[0], 
            campaign.product?.name || 'Product', 
            campaign.product?.link || '', 
            settings?.default_tone || 'friendly'
          );

          const trackingId = Math.random().toString(36).substring(2, 15);
          const trackedLink = `${origin}/api/track/click?id=${trackingId}&url=${encodeURIComponent(campaign.product?.link || '')}`;
          const linkRegex = new RegExp((campaign.product?.link || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const maskedLink = `<a href="${trackedLink}">${campaign.product?.link}</a>`;
          const htmlContent = emailData.content.replace(linkRegex, maskedLink).replace(/\n/g, '<br>') + `<img src="${origin}/api/track/open?id=${trackingId}" width="1" height="1" style="display:none;" />`;

          // Send Email (Fast)
          await sendEmail({
            to: contact.email,
            subject: emailData.subject,
            text: emailData.content,
            html: htmlContent,
            smtpId: currentSmtp.id
          });

          // Update DB
          await supabase.from('emails').insert({
            contact_id: contact.id,
            smtp_id: currentSmtp.id,
            campaign_id: campaign.id,
            subject: emailData.subject,
            content: emailData.content,
            status: 'sent',
            tracking_id: trackingId
          });

          await supabase.from('contacts').update({ status: 'sent' }).eq('id', contact.id);
          
          currentSmtp.remaining--;
          totalProcessed++;

          // Log Progress
          await supabase.from('campaign_logs').insert({
            campaign_id: campaign.id,
            msg: `Successfully sent to ${contact.email} via ${currentSmtp.user}`,
            type: 'success'
          });

        } catch (err) {
          console.error(`Error processing ${contact.email}:`, err);
          await supabase.from('campaign_logs').insert({
            campaign_id: campaign.id,
            msg: `Failed for ${contact.email}: ${(err as Error).message}`,
            type: 'error'
          });
        }
      }
    }

    return NextResponse.json({ success: true, processed: totalProcessed });

  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
