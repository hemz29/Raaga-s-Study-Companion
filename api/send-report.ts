// Vercel serverless function: POST /api/send-report
// The email API key and the recipient live ONLY in Vercel environment variables.
// Abuse protection: fixed recipient, shared-secret header, size limits, and a best-effort rate limit.
import { timingSafeEqual } from 'node:crypto';

interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res { status(code: number): Res; json(body: unknown): void; setHeader(k: string, v: string): void }

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const hits: number[] = []; // per warm instance; enough to stop accidental loops

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { RESEND_API_KEY, PARENT_EMAIL, REPORT_SHARED_SECRET, REPORT_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !PARENT_EMAIL || !REPORT_SHARED_SECRET) {
    return res.status(500).json({ error: 'Email is not configured yet' });
  }

  const secret = req.headers['x-report-secret'];
  if (typeof secret !== 'string' || !safeEqual(secret, REPORT_SHARED_SECRET)) {
    return res.status(401).json({ error: 'Not allowed' });
  }

  const now = Date.now();
  while (hits.length && now - hits[0] > WINDOW_MS) hits.shift();
  if (hits.length >= MAX_PER_WINDOW) return res.status(429).json({ error: 'Too many reports, try again later' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { subject?: unknown; text?: unknown } | undefined;
  const subject = typeof body?.subject === 'string' ? body.subject.slice(0, 200) : '';
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!subject || !text || text.length > 8000) return res.status(400).json({ error: 'Bad report' });

  hits.push(now);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: REPORT_FROM_EMAIL || 'Study Companion <onboarding@resend.dev>',
      to: [PARENT_EMAIL], // fixed recipient: never taken from the request
      subject,
      text,
    }),
  });
  if (!r.ok) return res.status(502).json({ error: 'The email service did not accept the report' });
  return res.status(200).json({ ok: true });
}
