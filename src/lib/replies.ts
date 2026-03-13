import imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import supabase from './db';
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
  const { data: activeSmtps, error: smtpsError } = await supabase
    .from('smtps')
    .select('*')
    .eq('is_active', 1);

  if (smtpsError) throw smtpsError;
  let totalFetched = 0;

  for (const smtp of (activeSmtps as SMTPConfig[])) {
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
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('id, name')
          .eq('email', fromEmail)
          .single();
        
        if (contactError && contactError.code !== 'PGRST116') throw contactError;

        if (contact) {
          const originalSubject = subject?.replace(/^Re:\s+/i, '').trim();
          
          const { data: originalEmail } = await supabase
            .from('emails')
            .select('id, content')
            .eq('contact_id', contact.id)
            .ilike('subject', `%${originalSubject}%`)
            .order('sent_at', { ascending: false })
            .limit(1)
            .single();

          const { data: existing } = await supabase
            .from('replies')
            .select('id')
            .eq('contact_id', contact.id)
            .eq('message', body)
            .eq('received_at', date?.toISOString())
            .single();

          if (!existing) {
            await supabase.from('replies').insert({
              contact_id: contact.id,
              email_id: originalEmail?.id || null,
              message: body,
              received_at: date?.toISOString()
            });
            totalFetched++;

            // AI AUTO-REPLY
            try {
              const aiReplyText = await generateAutoReply(contact.name, originalEmail?.content || "", body);
              const replySubject = (subject && subject.startsWith('Re:')) ? subject : `Re: ${subject || 'Our outreach'}`;
              
              await sendEmail({
                to: fromEmail,
                subject: replySubject,
                text: aiReplyText,
                smtpId: smtp.id
              });

              await supabase.from('emails').insert({
                contact_id: contact.id,
                smtp_id: smtp.id,
                subject: replySubject,
                content: aiReplyText,
                status: 'sent'
              });
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
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: pendingFollowUps, error } = await supabase
    .from('emails')
    .select(`
      *,
      contact:contacts(name, email),
      campaign:campaigns(
        id,
        product:affiliate_products(name, link)
      )
    `)
    .eq('opened', 0)
    .eq('follow_up_sent', 0)
    .lt('sent_at', threeDaysAgo.toISOString())
    .eq('status', 'sent');

  if (error) throw error;

  let count = 0;
  for (const email of (pendingFollowUps || [])) {
    try {
      const contact_name = (email.contact as any)?.name;
      const contact_email = (email.contact as any)?.email;
      const product_name = (email.campaign as any)?.product?.name;
      const product_link = (email.campaign as any)?.product?.link;

      const followUpData = await generateFollowUpEmail(
        contact_name, 
        email.subject, 
        product_name, 
        product_link
      );

      const trackingId = Math.random().toString(36).substring(2, 15);
      const trackedLink = `${origin}/api/track/click?id=${trackingId}&url=${encodeURIComponent(product_link)}`;
      const linkRegex = new RegExp(product_link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      
      const maskedLink = `<a href="${trackedLink}">${product_link}</a>`;
      const htmlContent = followUpData.content.replace(linkRegex, maskedLink).replace(/\n/g, '<br>') + `<img src="${origin}/api/track/open?id=${trackingId}" width="1" height="1" style="display:none;" />`;

      await sendEmail({
        to: contact_email,
        subject: followUpData.subject,
        text: followUpData.content,
        html: htmlContent,
        smtpId: email.smtp_id
      });

      // Log the follow-up email
      await supabase.from('emails').insert({
        contact_id: email.contact_id,
        smtp_id: email.smtp_id,
        campaign_id: email.campaign_id,
        subject: followUpData.subject,
        content: followUpData.content,
        status: 'sent',
        tracking_id: trackingId
      });

      // Mark the original email as followed up
      await supabase.from('emails').update({ follow_up_sent: 1 }).eq('id', email.id);
      
      count++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Follow-up failed for ${email.id}:`, err);
    }
  }
  return count;
}
