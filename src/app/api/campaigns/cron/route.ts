import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { generateEmail } from '@/lib/gemini';
import { sendEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
  }

  // Security check for Cron (optional but recommended)
  // const authHeader = req.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new Response('Unauthorized', { status: 401 });
  // }

  console.log('--- STARTING CAMPAIGN CRON JOB ---');

  try {
    // 1. Find all active campaigns
    const { data: activeCampaigns, error: campError } = await supabase
      .from('campaigns')
      .select('*, product:affiliate_products(*)')
      .eq('status', 'active');

    if (campError) throw campError;
    if (!activeCampaigns || activeCampaigns.length === 0) {
      return NextResponse.json({ message: 'No active campaigns to process.' });
    }

    // 2. Get global settings
    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
    const perSmtpLimit = settings?.daily_email_limit || 50;

    // 3. Get Active SMTPs
    const { data: activeSmtps } = await supabase.from('smtps').select('*').eq('is_active', true);
    if (!activeSmtps || activeSmtps.length === 0) {
      return NextResponse.json({ error: 'No active SMTPs' }, { status: 500 });
    }

    // 4. Calculate Capacity
    const today = new Date().toISOString().split('T')[0];
    const smtpCapacityMap: { id: number, user: string, remaining: number, host: string, port: number, pass: string, from_name: string, from_email: string }[] = [];
    let totalCapacity = 0;

    for (const smtp of activeSmtps) {
      const { count } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('smtp_id', smtp.id)
        .gte('sent_at', `${today}T00:00:00`);
      
      const sentToday = count || 0;
      const remaining = Math.max(0, perSmtpLimit - sentToday);
      if (remaining > 0) {
        totalCapacity += remaining;
        smtpCapacityMap.push({ ...smtp, remaining });
      }
    }

    if (totalCapacity === 0) {
      console.log('Daily limit reached for all SMTPs. Waiting for tomorrow.');
      return NextResponse.json({ message: 'Daily limit reached. Resuming tomorrow.' });
    }

    // 5. Process Campaigns
    let totalProcessed = 0;
    const origin = new URL(req.url).origin;

    for (const campaign of activeCampaigns) {
      if (totalCapacity <= 0) break;

      // Get batch of contacts for this campaign
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('status', 'pending')
        .limit(Math.min(10, totalCapacity)); // Process in small batches per cron run

      if (!contacts || contacts.length === 0) {
        await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaign.id);
        continue;
      }

      let smtpIndex = 0;
      for (const contact of contacts) {
        // Find SMTP with remaining capacity
        while (smtpIndex < smtpCapacityMap.length && smtpCapacityMap[smtpIndex].remaining <= 0) {
          smtpIndex++;
        }
        if (smtpIndex >= smtpCapacityMap.length) break;
        const currentSmtp = smtpCapacityMap[smtpIndex];

        try {
          const trackingId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          const emailData = await generateEmail(
            contact.name || contact.email.split('@')[0], 
            campaign.product?.name || 'Product', 
            campaign.product?.link || '', 
            settings?.default_tone || 'friendly'
          );

          const trackedLink = `${origin}/api/track/click?id=${trackingId}&url=${encodeURIComponent(campaign.product?.link || '')}`;
          const linkRegex = new RegExp((campaign.product?.link || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const maskedLink = `<a href="${trackedLink}">${campaign.product?.link}</a>`;
          const htmlContent = emailData.content.replace(linkRegex, maskedLink).replace(/\n/g, '<br>') + `<img src="${origin}/api/track/open?id=${trackingId}" width="1" height="1" style="display:none;" />`;

          await sendEmail({
            to: contact.email,
            subject: emailData.subject,
            text: emailData.content,
            html: htmlContent,
            smtpId: currentSmtp.id
          });

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
          totalCapacity--;
          totalProcessed++;

          // Log to campaign logs
          await supabase.from('campaign_logs').insert({
            campaign_id: campaign.id,
            msg: `Sent email to ${contact.email}`,
            type: 'success'
          });

        } catch (err) {
          console.error(`Cron error for ${contact.email}:`, err);
        }
      }
    }

    return NextResponse.json({ success: true, processed: totalProcessed });

  } catch (error) {
    console.error('CRON FATAL ERROR:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
