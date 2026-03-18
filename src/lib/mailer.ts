import nodemailer from 'nodemailer';
import supabase from './db';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  smtpId?: number;
}

interface SMTPConfig {
  id: number;
  host: string;
  port: number;
  user: string;
  pass: string;
  from_name: string;
  from_email: string;
  secure: boolean;
  is_active: boolean;
}

export async function getRecentEmailCount(minutes: number) {
  if (!supabase) return 0;
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const { count } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', since);
  return count || 0;
}

export async function sendEmail({ to, subject, text, html, smtpId }: MailOptions) {
  if (!supabase) throw new Error('Supabase not initialized');
  // Get SMTP configuration
  let smtp: SMTPConfig | undefined;
  
  if (smtpId) {
    const { data } = await supabase
      .from('smtps')
      .select('*')
      .eq('id', smtpId)
      .single();
    smtp = data as SMTPConfig;
  } else {
    // In Supabase/Postgres, we can't easily use RANDOM() via the client without RPC,
    // so we'll fetch active ones and pick one.
    const { data } = await supabase
      .from('smtps')
      .select('*')
      .eq('is_active', true);
    
    if (data && data.length > 0) {
      smtp = data[Math.floor(Math.random() * data.length)] as SMTPConfig;
    }
  }

  if (!smtp) {
    throw new Error("No active SMTP configuration found.");
  }

  // Robust connection logic
  const isSecure = smtp.port === 465;

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: isSecure, 
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const fromAddress = smtp.from_name 
    ? `"${smtp.from_name}" <${smtp.from_email}>`
    : smtp.from_email;

  return await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });
}
