import { NextResponse } from 'next/server';
import { createHmac, randomUUID } from 'node:crypto';
import { fieldErrors, inquirySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate limit simples em memória (por instância). Em produção real: Upstash/Redis ou WAF.
const hits = new Map<string, number[]>();
const WINDOW = 10 * 60 * 1000, LIMIT = 6;
function limited(key: string) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > LIMIT;
}

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  if (limited(ip)) return NextResponse.json({ message: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ message: 'Formato inválido.' }, { status: 415 });
  const raw = await req.text();
  if (raw.length > 8_000) return NextResponse.json({ message: 'Requisição muito grande.' }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ message: 'JSON inválido.' }, { status: 400 }); }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  const { journey, contact, website, elapsedMs } = parsed.data;
  const id = `777-${randomUUID().slice(0, 8).toUpperCase()}`;

  // honeypot preenchido ou envio instantâneo: responde como demo, sem processar (não revela a detecção)
  const suspicious = (website && website.length > 0) || (elapsedMs !== undefined && elapsedMs < 1500);

  const hook = process.env.INQUIRY_WEBHOOK_URL;
  if (!hook || suspicious) {
    // MODO DEMONSTRAÇÃO: nada é armazenado nem enviado. Log sem PII.
    console.info(JSON.stringify({ evt: 'inquiry_demo', id, pax: journey.passengers, purpose: contact.purpose, suspicious: !!suspicious }));
    return NextResponse.json({ mode: 'demo', id });
  }

  // MODO REAL: só confirma após resposta 2xx do destino configurado.
  const payload = JSON.stringify({ id, receivedAt: new Date().toISOString(), journey, contact: { ...contact, consent: true }, source: '777-labs-aviation' });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = process.env.INQUIRY_WEBHOOK_SECRET;
  if (secret) headers['X-777-Signature'] = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    const r = await fetch(hook, { method: 'POST', headers, body: payload, signal: AbortSignal.timeout(8000) });
    if (!r.ok) { console.error(JSON.stringify({ evt: 'inquiry_forward_failed', id, status: r.status })); return NextResponse.json({ message: 'O sistema de destino não confirmou o recebimento. Tente novamente.' }, { status: 502 }); }
    console.info(JSON.stringify({ evt: 'inquiry_forwarded', id }));
    return NextResponse.json({ mode: 'live', id });
  } catch {
    console.error(JSON.stringify({ evt: 'inquiry_forward_error', id }));
    return NextResponse.json({ message: 'Falha de comunicação com o sistema de destino.' }, { status: 502 });
  }
}

export function GET() {
  return NextResponse.json({ mode: process.env.INQUIRY_WEBHOOK_URL ? 'live' : 'demo' });
}
