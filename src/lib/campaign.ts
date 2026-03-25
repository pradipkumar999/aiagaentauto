import supabase from './db';
import { generateEmail } from './claude';
import { sendEmail, getRecentEmailCount } from './mailer';

const BATCH_SIZE = 5;

export async function processCampaignBatch(origin: string, campaignId?: number) {
  if (!supabase) throw new Error('Database connection error');

  console.log('--- STARTING CAMPAIGN BATCH PROCESSOR ---');

  // 1. Rate Limiting Check (5 emails per 2 mins)
  const recentCount = await getRecentEmailCount(2);
  if (recentCount >= 5) {
    const msg = 'Rate limit reached (5 emails per 2 mins). Skipping this run.';
    console.log(`--- ${msg.toUpperCase()} ---`);
    return { success: false, message: msg };
  }

  // 2. Get Active Campaigns
  let query = supabase
    .from('campaigns')
    .select('*, product:affiliate_products(*)')
    .eq('status', 'active');
  
  if (campaignId) {
    query = query.eq('id', campaignId);
  }

  const { data: activeCampaigns } = await query;

  if (!activeCampaigns || activeCampaigns.length === 0) {
    return { success: true, message: 'No active campaigns.' };
  }

  // 3. Get Global Settings
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  const perSmtpLimit = settings?.daily_email_limit || 50;

  // 4. Get Active SMTPs
  const { data: activeSmtps } = await supabase.from('smtps').select('*').eq('is_active', true);
  if (!activeSmtps || activeSmtps.length === 0) {
    throw new Error('No active SMTPs');
  }

  // 5. Check SMTP Capacity for Today
  const today = new Date().toISOString().split('T')[0];
  const smtpCapacityMap: { id: number, user: string, remaining: number }[] = [];
  
  for (const smtp of activeSmtps) {
    const { count } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('smtp_id', smtp.id)
      .gte('sent_at', `${today}T00:00:00`);
    
    const remaining = Math.max(0, perSmtpLimit - (count || 0));
    if (remaining > 0) {
      smtpCapacityMap.push({ id: smtp.id, user: smtp.user, remaining });
    }
  }

  if (smtpCapacityMap.length === 0) {
    return { success: true, message: 'All SMTPs hit daily limit. Resuming tomorrow.' };
  }

  // 6. Process Batch
  let totalProcessed = 0;
  const timeStr = new Date().toLocaleTimeString([], { hour12: false });

  for (const campaign of activeCampaigns) {
    if (totalProcessed >= BATCH_SIZE) break;

    // ATOMIC PICKUP: Fetch pending contacts and immediately mark them as processing
    // First, get the IDs of the contacts we want to process
    const { data: pendingContacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('status', 'pending')
      .limit(BATCH_SIZE - totalProcessed);

    if (!pendingContacts || pendingContacts.length === 0) {
      await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaign.id);
      continue;
    }

    const contactIds = pendingContacts.map(c => c.id);

    // Mark them as processing so no other process picks them up
    const { data: contacts } = await supabase
      .from('contacts')
      .update({ status: 'processing' })
      .in('id', contactIds)
      .select();

    if (!contacts || contacts.length === 0) continue;

    for (const contact of contacts) {
      const currentSmtp = smtpCapacityMap[totalProcessed % smtpCapacityMap.length];
      if (!currentSmtp || currentSmtp.remaining <= 0) continue;

      try {
        // PRE-SEND VERIFICATION: Check if contact still exists and is still 'processing'
        // This handles cases where they were deleted or reset during the batch run
        const { data: verifyContact } = await supabase
          .from('contacts')
          .select('id, status')
          .eq('id', contact.id)
          .single();
        
        if (!verifyContact || verifyContact.status !== 'processing') {
          console.log(`[${timeStr}] Skipping contact ${contact.email} (already deleted or processed)`);
          continue;
        }

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

        // Final update to sent
        await supabase.from('contacts').update({ status: 'sent' }).eq('id', contact.id);
        
        currentSmtp.remaining--;
        totalProcessed++;

        await supabase.from('campaign_logs').insert({
          campaign_id: campaign.id,
          msg: `Successfully sent to ${contact.email} via ${currentSmtp.user}`,
          type: 'success'
        });

      } catch (err) {
        console.error(`Error processing ${contact.email}:`, err);
        // Reset status to pending only if it's still 'processing'
        await supabase.from('contacts').update({ status: 'pending' }).match({ id: contact.id, status: 'processing' });
        
        await supabase.from('campaign_logs').insert({
          campaign_id: campaign.id,
          msg: `Failed for ${contact.email}: ${(err as Error).message}`,
          type: 'error'
        });
      }
    }
  }

  return { success: true, processed: totalProcessed };
}
