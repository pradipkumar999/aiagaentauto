import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateEmail } from '@/lib/gemini';
import { sendEmail } from '@/lib/mailer';

export async function POST(req: Request) {
  let campaignId: number | null = null;
  
  const addLog = (msg: string, type: string = 'info') => {
    if (campaignId) {
      db.prepare(`INSERT INTO campaign_logs (campaign_id, msg, type) VALUES (?, ?, ?)`).run(campaignId, msg, type);
    }
    console.log(`[CAMPAIGN LOG] [${type.toUpperCase()}] ${msg}`);
  };

  try {
    const { tone, product_id: rawProductId, name } = await req.json();
    const productId = Number(rawProductId);
    const campaignName = name || `Campaign - ${new Date().toLocaleString()}`;

    // 1. Create campaign record
    const insertCampaign = db.prepare(`
      INSERT INTO campaigns (name, product_id, status, created_at)
      VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
    `);
    const campaignResult = insertCampaign.run(campaignName, productId);
    campaignId = campaignResult.lastInsertRowid as number;

    addLog(`Campaign initialized: ${campaignName}`, 'info');

    // 2. Reset stop flag
    db.prepare('UPDATE settings SET stop_requested = 0 WHERE id = 1').run();
    
    // 3. Get Limits
    const settings = db.prepare('SELECT daily_email_limit FROM settings WHERE id = 1').get() as { daily_email_limit: number };
    const perSmtpLimit = settings?.daily_email_limit || 50;
    addLog(`Daily limit set to ${perSmtpLimit} emails per SMTP.`, 'info');

    // 4. Get Product
    const product = db.prepare('SELECT * FROM affiliate_products WHERE id = ?').get(productId) as { name: string, link: string };
    if (!product) {
      addLog(`Error: Product ID ${productId} not found.`, 'error');
      throw new Error("Product not found.");
    }
    addLog(`Found product: ${product.name}`, 'info');

    // 5. Get Active SMTPs and Capacity
    interface SMTPEntry {
      id: number;
      user: string;
      is_active: number;
    }
    const activeSmtps = db.prepare('SELECT * FROM smtps WHERE is_active = 1').all() as SMTPEntry[];
    if (activeSmtps.length === 0) {
      addLog("Error: No active SMTP configurations found.", 'error');
      throw new Error("No active SMTPs.");
    }
    addLog(`Found ${activeSmtps.length} active SMTP accounts.`, 'info');

    const today = new Date().toISOString().split('T')[0];
    let totalCapacity = 0;
    const smtpCapacityMap: { id: number, user: string, remaining: number }[] = [];

    for (const smtp of activeSmtps) {
      const sentToday = db.prepare(`SELECT COUNT(*) as count FROM emails WHERE smtp_id = ? AND date(sent_at) = date(?)`).get(smtp.id, today) as { count: number };
      const remaining = Math.max(0, perSmtpLimit - sentToday.count);
      addLog(`SMTP ${smtp.user}: ${sentToday.count} sent today, ${remaining} slots available.`, 'info');
      
      if (remaining > 0) {
        totalCapacity += remaining;
        smtpCapacityMap.push({ id: smtp.id, user: smtp.user, remaining });
      }
    }

    if (totalCapacity === 0) {
      addLog("Error: Daily capacity reached for all active SMTPs.", 'error');
      throw new Error("Daily limit reached.");
    }
    addLog(`Total capacity available: ${totalCapacity} emails.`, 'info');

    // 6. Get Pending Contacts
    interface ContactEntry {
      id: number;
      name: string;
      email: string;
      status: string;
    }
    const contacts = db.prepare(`SELECT * FROM contacts WHERE status = 'pending' LIMIT ?`).all(totalCapacity) as ContactEntry[];
    addLog(`Found ${contacts.length} pending contacts in the database.`, 'info');
    
    if (contacts.length === 0) {
      addLog("No pending contacts found to process.", 'info');
      db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ?").run(campaignId);
      return NextResponse.json({ success: true, processed: 0, campaignId });
    }

    const origin = new URL(req.url).origin;
    let processed = 0;
    let smtpIndex = 0;

    for (const contact of contacts) {
      // Check Stop
      const curSettings = db.prepare('SELECT stop_requested FROM settings WHERE id = 1').get() as { stop_requested: number };
      if (curSettings.stop_requested === 1) {
        addLog("Campaign stopped by user request.", 'info');
        db.prepare("UPDATE campaigns SET status = 'stopped' WHERE id = ?").run(campaignId);
        break;
      }

      // Find SMTP
      while (smtpIndex < smtpCapacityMap.length && smtpCapacityMap[smtpIndex].remaining <= 0) {
        smtpIndex++;
      }
      if (smtpIndex >= smtpCapacityMap.length) {
        addLog("SMTP capacity fully exhausted for this run.", 'info');
        break;
      }
      const currentSmtp = smtpCapacityMap[smtpIndex];

      try {
        addLog(`Processing: generating AI content for ${contact.email}...`, 'info');
        
        // Generate tracking ID
        const trackingId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // EVERY email gets a unique Subject and Content from Gemini
        const emailData = await generateEmail(contact.name || contact.email.split('@')[0], product.name, product.link, tone);
        addLog(`AI content created for ${contact.email}.`, 'info');

        // Wrap links and add tracking pixel
        const trackedLink = `${origin}/api/track/click?id=${trackingId}&url=${encodeURIComponent(product.link)}`;
        const linkRegex = new RegExp(product.link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        
        // Use original content for text, and masked link for HTML
        const maskedLink = `<a href="${trackedLink}">${product.link}</a>`;
        const htmlContent = emailData.content.replace(linkRegex, maskedLink).replace(/\n/g, '<br>') + `<img src="${origin}/api/track/open?id=${trackingId}" width="1" height="1" style="display:none;" />`;

        addLog(`Sending email to ${contact.email} using ${currentSmtp.user}...`, 'info');
        await sendEmail({
          to: contact.email,
          subject: emailData.subject,
          text: emailData.content, // Shows original link
          html: htmlContent,      // Shows original link text but clickable to tracker
          smtpId: currentSmtp.id
        });

        // Log Email with tracking_id
        db.prepare(`
          INSERT INTO emails (contact_id, smtp_id, campaign_id, subject, content, status, sent_at, tracking_id)
          VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?)
        `).run(contact.id, currentSmtp.id, campaignId, emailData.subject, emailData.content, trackingId);

        // Update contact to 'sent'
        db.prepare("UPDATE contacts SET status = 'sent' WHERE id = ?").run(contact.id);
        
        currentSmtp.remaining--;
        processed++;
        addLog(`Successfully sent to ${contact.email}.`, 'success');

        // WAIT 5 SECONDS between emails
        if (processed < contacts.length) {
          addLog("Waiting 5 seconds before next email...", 'info');
          await new Promise(r => setTimeout(r, 5000));
        }
        
      } catch (err) {
        addLog(`Failed to process ${contact.email}: ${(err as Error).message}`, 'error');
        console.error(`[FAIL] ${contact.email}:`, err);
      }
    }

    db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ?").run(campaignId);
    addLog(`Campaign finished. Total emails processed: ${processed}`, 'success');
    return NextResponse.json({ success: true, processed, campaignId });

  } catch (error) {
    const errorMsg = (error as Error).message;
    addLog(`Critical Error: ${errorMsg}`, 'error');
    if (campaignId) db.prepare("UPDATE campaigns SET status = 'failed' WHERE id = ?").run(campaignId);
    return NextResponse.json({ error: errorMsg, campaignId }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Start a transaction to ensure all or nothing
    const deleteTransaction = db.transaction(() => {
      // 1. Delete replies associated with emails from this campaign
      db.prepare(`
        DELETE FROM replies 
        WHERE email_id IN (SELECT id FROM emails WHERE campaign_id = ?)
      `).run(id);

      // 2. Delete emails associated with this campaign
      db.prepare('DELETE FROM emails WHERE campaign_id = ?').run(id);

      // 3. Delete related logs
      db.prepare('DELETE FROM campaign_logs WHERE campaign_id = ?').run(id);

      // 4. Finally, delete the campaign
      db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
    });

    deleteTransaction();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const campaigns = db.prepare(`
    SELECT c.*, p.name as product_name, 
    (SELECT COUNT(*) FROM emails WHERE campaign_id = c.id) as sent_count,
    (SELECT SUM(opened) FROM emails WHERE campaign_id = c.id) as opened_count,
    (SELECT SUM(clicked) FROM emails WHERE campaign_id = c.id) as clicked_count
    FROM campaigns c
    JOIN affiliate_products p ON c.product_id = p.id
    ORDER BY c.created_at DESC
  `).all();
  return NextResponse.json(campaigns);
}
