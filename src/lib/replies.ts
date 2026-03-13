import imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import db from './db';
import { generateAutoReply, generateFollowUpEmail } from './gemini';
import { sendEmail } from './mailer';

interface SMTPConfig {
  id: number;
  host: string;
  port: number;
  user: string;
  pass: string;
  from_name: string;
  from_email: string;
  secure: number;
  is_active: number;
}

export async function syncReplies() {
  const activeSmtps = db.prepare('SELECT * FROM smtps WHERE is_active = 1').all() as SMTPConfig[];
  let totalFetched = 0;

  for (const smtp of activeSmtps) {
    const config = {
      imap: {
        user: smtp.user,
        password: smtp.pass,
        host: smtp.host,
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
      }
    };

    try {
      const connection = await imap.connect(config);
      await connection.openBox('INBOX');

      const searchCriteria = ['ALL']; 
      const fetchOptions = {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      
      for (const item of messages) {
        const fullBody = await connection.getPartData(item, '');
        const parsed = await simpleParser(fullBody);

        const fromEmail = parsed.from?.value[0]?.address;
        const subject = parsed.subject;
        const date = parsed.date;
        const body = parsed.text || '';

        if (!fromEmail) continue;

        // Check if this is a reply from one of our contacts
        const contact = db.prepare('SELECT id FROM contacts WHERE email = ?').get(fromEmail) as { id: number } | undefined;
        if (contact) {
          const originalSubject = subject?.replace(/^Re:\s+/i, '').trim();
          const originalEmail = db.prepare('SELECT id FROM emails WHERE contact_id = ? AND subject LIKE ? ORDER BY sent_at DESC LIMIT 1')
            .get(contact.id, `%${originalSubject}%`) as { id: number } | undefined;

          const existing = db.prepare('SELECT id FROM replies WHERE contact_id = ? AND message = ? AND received_at = ?')
            .get(contact.id, body, date?.toISOString()) as { id: number } | undefined;

          if (!existing) {
            db.prepare(`
              INSERT INTO replies (contact_id, email_id, message, received_at)
              VALUES (?, ?, ?, ?)
            `).run(contact.id, originalEmail?.id || null, body, date?.toISOString());
            totalFetched++;

            // AI AUTO-REPLY
            try {
              const contactData = db.prepare('SELECT name FROM contacts WHERE id = ?').get(contact.id) as { name: string };
              let originalContent = "";
              if (originalEmail) {
                const emailRecord = db.prepare('SELECT content FROM emails WHERE id = ?').get(originalEmail.id) as { content: string };
                originalContent = emailRecord.content;
              }

              const aiReplyText = await generateAutoReply(contactData.name, originalContent, body);
              const replySubject = (subject && subject.startsWith('Re:')) ? subject : `Re: ${subject || 'Our outreach'}`;
              
              await sendEmail({
                to: fromEmail,
                subject: replySubject,
                text: aiReplyText,
                smtpId: smtp.id
              });

              db.prepare(`
                INSERT INTO emails (contact_id, smtp_id, subject, content, status, sent_at)
                VALUES (?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP)
              `).run(contact.id, smtp.id, replySubject, aiReplyText);
            } catch (autoReplyErr) {
              console.error(`Auto-reply failed for ${fromEmail}:`, autoReplyErr);
            }
          }
        }
      }

      connection.end();
    } catch (err) {
      console.error(`Failed to sync replies for ${smtp.user}:`, err);
    }
  }

  return totalFetched;
}

interface EmailWithProduct {
  id: number;
  contact_id: number;
  campaign_id: number;
  smtp_id: number;
  subject: string;
  content: string;
  contact_name: string;
  contact_email: string;
  product_name: string;
  product_link: string;
}

export async function processFollowUps() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Find emails sent more than 3 days ago, not opened, and no follow-up sent yet
  const pendingFollowUps = db.prepare(`
    SELECT e.*, c.name as contact_name, c.email as contact_email, p.name as product_name, p.link as product_link
    FROM emails e
    JOIN contacts c ON e.contact_id = c.id
    JOIN campaigns cam ON e.campaign_id = cam.id
    JOIN affiliate_products p ON cam.product_id = p.id
    WHERE e.opened = 0 
    AND e.follow_up_sent = 0 
    AND e.sent_at < datetime('now', '-3 days')
    AND e.status = 'sent'
  `).all() as EmailWithProduct[];

  let count = 0;
  for (const email of pendingFollowUps) {
    try {
      const followUpData = await generateFollowUpEmail(
        email.contact_name, 
        email.subject, 
        email.product_name, 
        email.product_link
      );

      const trackingId = Math.random().toString(36).substring(2, 15);
      const trackedLink = `${origin}/api/track/click?id=${trackingId}&url=${encodeURIComponent(email.product_link)}`;
      const linkRegex = new RegExp(email.product_link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      
      const maskedLink = `<a href="${trackedLink}">${email.product_link}</a>`;
      const htmlContent = followUpData.content.replace(linkRegex, maskedLink).replace(/\n/g, '<br>') + `<img src="${origin}/api/track/open?id=${trackingId}" width="1" height="1" style="display:none;" />`;

      await sendEmail({
        to: email.contact_email,
        subject: followUpData.subject,
        text: followUpData.content, // Shows original link in plain text
        html: htmlContent,          // Shows original link text in HTML
        smtpId: email.smtp_id
      });

      // Log the follow-up email
      db.prepare(`
        INSERT INTO emails (contact_id, smtp_id, campaign_id, subject, content, status, sent_at, tracking_id)
        VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?)
      `).run(email.contact_id, email.smtp_id, email.campaign_id, followUpData.subject, followUpData.content, trackingId);

      // Mark the original email as followed up
      db.prepare('UPDATE emails SET follow_up_sent = 1 WHERE id = ?').run(email.id);
      
      count++;
      // Wait a bit to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Follow-up failed for ${email.contact_email}:`, err);
    }
  }
  return count;
}
