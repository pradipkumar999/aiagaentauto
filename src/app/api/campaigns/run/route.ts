import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { generateEmail } from '@/lib/gemini';
import { sendEmail } from '@/lib/mailer';

export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
  }
  let campaignId: number | null = null;
  
  const addLog = async (msg: string, type: string = 'info') => {
    if (campaignId && supabase) {
      await supabase.from('campaign_logs').insert({ campaign_id: campaignId, msg, type });
    }
    console.log(`[CAMPAIGN LOG] [${type.toUpperCase()}] ${msg}`);
  };

  try {
    const { tone, product_id: rawProductId, name } = await req.json();
    const productId = Number(rawProductId);
    const campaignName = name || `Campaign - ${new Date().toLocaleString()}`;

    // 1. Create campaign record
    console.log('Creating campaign:', campaignName, 'for product:', productId);
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .insert({ name: campaignName, product_id: productId, status: 'active' })
      .select('id')
      .single();

    if (campaignError) {
      console.error('Campaign creation error:', campaignError);
      throw campaignError;
    }
    campaignId = campaignData.id;

    await addLog(`Campaign initialized: ${campaignName}`, 'info');

    // 2. Reset stop flag
    await supabase.from('settings').update({ stop_requested: 0 }).eq('id', 1);
    
    // 3. Get Limits
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('daily_email_limit')
      .eq('id', 1)
      .single();
    
    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
    
    const perSmtpLimit = settings?.daily_email_limit || 50;
    await addLog(`Daily limit set to ${perSmtpLimit} emails per SMTP.`, 'info');

    // 4. Get Product
    const { data: product, error: productError } = await supabase
      .from('affiliate_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      await addLog(`Error: Product ID ${productId} not found.`, 'error');
      throw new Error("Product not found.");
    }
    await addLog(`Found product: ${product.name}`, 'info');

    // 5. Get Active SMTPs and Capacity
    const { data: activeSmtps, error: smtpsError } = await supabase
      .from('smtps')
      .select('*')
      .eq('is_active', 1);

    if (smtpsError) throw smtpsError;
    if (!activeSmtps || activeSmtps.length === 0) {
      await addLog("Error: No active SMTP configurations found.", 'error');
      throw new Error("No active SMTPs.");
    }
    await addLog(`Found ${activeSmtps.length} active SMTP accounts.`, 'info');

    const today = new Date().toISOString().split('T')[0];
    let totalCapacity = 0;
    const smtpCapacityMap: { id: number, user: string, remaining: number }[] = [];

    for (const smtp of activeSmtps) {
      const { count, error: countError } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('smtp_id', smtp.id)
        .gte('sent_at', `${today}T00:00:00`)
        .lte('sent_at', `${today}T23:59:59`);
      
      if (countError) throw countError;

      const sentToday = count || 0;
      const remaining = Math.max(0, perSmtpLimit - sentToday);
      await addLog(`SMTP ${smtp.user}: ${sentToday} sent today, ${remaining} slots available.`, 'info');
      
      if (remaining > 0) {
        totalCapacity += remaining;
        smtpCapacityMap.push({ id: smtp.id, user: smtp.user, remaining });
      }
    }

    if (totalCapacity === 0) {
      await addLog("Error: Daily capacity reached for all active SMTPs.", 'error');
      throw new Error("Daily limit reached.");
    }
    await addLog(`Total capacity available: ${totalCapacity} emails.`, 'info');

    // 6. Get Pending Contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('status', 'pending')
      .limit(totalCapacity);
    
    if (contactsError) throw contactsError;
    await addLog(`Found ${contacts?.length || 0} pending contacts in the database.`, 'info');
    
    if (!contacts || contacts.length === 0) {
      await addLog("No pending contacts found to process.", 'info');
      await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId);
      return NextResponse.json({ success: true, processed: 0, campaignId });
    }

    const origin = new URL(req.url).origin;
    let processed = 0;
    let smtpIndex = 0;

    for (const contact of contacts) {
      // Check Stop
      const { data: curSettings } = await supabase.from('settings').select('stop_requested').eq('id', 1).single();
      if (curSettings?.stop_requested === 1) {
        await addLog("Campaign stopped by user request.", 'info');
        await supabase.from('campaigns').update({ status: 'stopped' }).eq('id', campaignId);
        break;
      }

      // Find SMTP
      while (smtpIndex < smtpCapacityMap.length && smtpCapacityMap[smtpIndex].remaining <= 0) {
        smtpIndex++;
      }
      if (smtpIndex >= smtpCapacityMap.length) {
        await addLog("SMTP capacity fully exhausted for this run.", 'info');
        break;
      }
      const currentSmtp = smtpCapacityMap[smtpIndex];

      try {
        await addLog(`Processing: generating AI content for ${contact.email}...`, 'info');
        
        const trackingId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const emailData = await generateEmail(contact.name || contact.email.split('@')[0], product.name, product.link, tone);
        await addLog(`AI content created for ${contact.email}.`, 'info');

        const trackedLink = `${origin}/api/track/click?id=${trackingId}&url=${encodeURIComponent(product.link)}`;
        const linkRegex = new RegExp(product.link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const maskedLink = `<a href="${trackedLink}">${product.link}</a>`;
        const htmlContent = emailData.content.replace(linkRegex, maskedLink).replace(/\n/g, '<br>') + `<img src="${origin}/api/track/open?id=${trackingId}" width="1" height="1" style="display:none;" />`;

        await addLog(`Sending email to ${contact.email} using ${currentSmtp.user}...`, 'info');
        await sendEmail({
          to: contact.email,
          subject: emailData.subject,
          text: emailData.content,
          html: htmlContent,
          smtpId: currentSmtp.id
        });

        // Log Email
        await supabase.from('emails').insert({
          contact_id: contact.id,
          smtp_id: currentSmtp.id,
          campaign_id: campaignId,
          subject: emailData.subject,
          content: emailData.content,
          status: 'sent',
          tracking_id: trackingId
        });

        // Update contact
        await supabase.from('contacts').update({ status: 'sent' }).eq('id', contact.id);
        
        currentSmtp.remaining--;
        processed++;
        await addLog(`Successfully sent to ${contact.email}.`, 'success');

        if (processed < contacts.length) {
          await addLog("Waiting 5 seconds before next email...", 'info');
          await new Promise(r => setTimeout(r, 5000));
        }
        
      } catch (err) {
        await addLog(`Failed to process ${contact.email}: ${(err as Error).message}`, 'error');
        console.error(`[FAIL] ${contact.email}:`, err);
      }
    }

    await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId);
    await addLog(`Campaign finished. Total emails processed: ${processed}`, 'success');
    return NextResponse.json({ success: true, processed, campaignId });

  } catch (error) {
    const errorMsg = (error as Error).message;
    await addLog(`Critical Error: ${errorMsg}`, 'error');
    if (campaignId) await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaignId);
    return NextResponse.json({ error: errorMsg, campaignId }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const { data: emails } = await supabase.from('emails').select('id').eq('campaign_id', id);
    const emailIds = emails?.map(e => e.id) || [];

    if (emailIds.length > 0) {
      await supabase.from('replies').delete().in('email_id', emailIds);
    }

    await supabase.from('emails').delete().eq('campaign_id', id);
    await supabase.from('campaign_logs').delete().eq('campaign_id', id);

    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
  }
  try {
    let campaignsData: Record<string, unknown>[] = [];
    
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        product:affiliate_products(name),
        emails(opened, clicked)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Failed to sort by created_at, trying id:', error.message);
      const { data: data2, error: error2 } = await supabase
        .from('campaigns')
        .select(`
          *,
          product:affiliate_products(name),
          emails(opened, clicked)
        `)
        .order('id', { ascending: false });
      
      if (error2) throw error2;
      campaignsData = data2 || [];
    } else {
      campaignsData = data || [];
    }

    const formattedCampaigns = campaignsData.map((c: {
      product?: { name: string } | null;
      emails?: { opened: number; clicked: number }[] | null;
    } & Record<string, unknown>) => ({
      ...c,
      product_name: c.product?.name,
      sent_count: c.emails?.length || 0,
      opened_count: c.emails?.reduce((sum: number, e: { opened: number }) => sum + (e.opened || 0), 0),
      clicked_count: c.emails?.reduce((sum: number, e: { clicked: number }) => sum + (e.clicked || 0), 0)
    }));

    return NextResponse.json(formattedCampaigns);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
