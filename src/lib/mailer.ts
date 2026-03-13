import nodemailer from 'nodemailer';
import db from './db';

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
  secure: number;
  is_active: number;
}

export async function sendEmail({ to, subject, text, html, smtpId }: MailOptions) {
  // Get SMTP configuration
  let smtp: SMTPConfig | undefined;
  if (smtpId) {
    smtp = db.prepare('SELECT * FROM smtps WHERE id = ?').get(smtpId) as SMTPConfig | undefined;
  } else {
    smtp = db.prepare('SELECT * FROM smtps WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1').get() as SMTPConfig | undefined;
  }

  if (!smtp) {
    throw new Error("No active SMTP configuration found.");
  }

  // Robust connection logic:
  // Port 465 usually requires secure: true
  // Port 587 or 25 usually requires secure: false (it uses STARTTLS)
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
      // Do not fail on invalid certs (common on shared hosting)
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
