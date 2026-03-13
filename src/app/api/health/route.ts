import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import dns from 'dns/promises';

const BLACKLISTS = [
  'zen.spamhaus.org',
  'bl.spamcop.net',
  'b.barracudacentral.org',
  'dnsbl.sorbs.net',
];

async function checkBlacklist(ipOrDomain: string, blacklist: string) {
  try {
    const query = `${ipOrDomain.split('.').reverse().join('.')}.${blacklist}`;
    await dns.resolve(query);
    return true; // If it resolves, it's blacklisted
  } catch {
    return false; // Not blacklisted
  }
}

async function getTxtRecords(domain: string) {
  try {
    const records = await dns.resolveTxt(domain);
    return records.flat();
  } catch {
    return [];
  }
}

async function checkDnsRecords(domain: string) {
  const txtRecords = await getTxtRecords(domain);
  const spf = txtRecords.find(r => r.startsWith('v=spf1'));
  
  let dmarc = '';
  try {
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
    dmarc = dmarcRecords.flat().find(r => r.startsWith('v=DMARC1')) || '';
  } catch {}

  return { spf, dmarc };
}

export async function GET() {
  if (!supabase) return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  
  try {
    const { data: smtps, error } = await supabase
      .from('smtps')
      .select('id, host, from_email, from_name');

    if (error) throw error;

    const healthData = await Promise.all(smtps.map(async (smtp) => {
      const domain = smtp.from_email.split('@')[1];
      
      // Get IP of SMTP host for blacklist checking
      let hostIp = '';
      try {
        const ips = await dns.resolve4(smtp.host);
        hostIp = ips[0];
      } catch {}

      const dnsStatus = await checkDnsRecords(domain);
      
      const blacklistStatus = await Promise.all(BLACKLISTS.map(async (bl) => {
        const isBlacklisted = hostIp ? await checkBlacklist(hostIp, bl) : false;
        return { name: bl, isBlacklisted };
      }));

      return {
        id: smtp.id,
        host: smtp.host,
        from_email: smtp.from_email,
        from_name: smtp.from_name,
        domain,
        dns: dnsStatus,
        blacklists: blacklistStatus,
        isHealthy: !blacklistStatus.some(bl => bl.isBlacklisted) && !!dnsStatus.spf && !!dnsStatus.dmarc
      };
    }));

    return NextResponse.json(healthData);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
