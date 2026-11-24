import { z } from 'zod';

/** Data local YYYY-MM-DD de hoje (fuso do cliente/servidor). */
export function todayISO(now = new Date()): string {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const place = z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(80, 'Use até 80 caracteres.');

export const journeySchema = z
  .object({
    from: place,
    to: place,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha uma data.'),
    returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    passengers: z.coerce.number({ error: 'Informe o número de passageiros.' }).int('Use um número inteiro.').min(1, 'Mínimo de 1 passageiro.').max(20, 'Nesta demonstração, até 20 passageiros.'),
  })
  .superRefine((v, ctx) => {
    if (norm(v.from) && norm(v.from) === norm(v.to)) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Destino precisa ser diferente da origem.' });
    if (v.date && v.date < todayISO()) ctx.addIssue({ code: 'custom', path: ['date'], message: 'A data não pode estar no passado.' });
    if (v.returnDate && v.date && v.returnDate < v.date) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'O retorno deve ser após a ida.' });
  });

export const PURPOSES = ['Lazer', 'Negócios', 'Evento', 'Outro'] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80, 'Use até 80 caracteres.'),
  email: z.string().trim().email('Informe um e-mail válido.').max(120),
  phone: z
    .string()
    .trim()
    .max(25)
    .refine((v) => v === '' || /^\+?[\d\s().-]{8,25}$/.test(v), 'Telefone inválido (use apenas números, espaço, +, -, parênteses).')
    .optional()
    .or(z.literal('')),
  purpose: z.enum(PURPOSES, { error: 'Selecione um objetivo.' }),
  message: z.string().trim().max(600, 'Use até 600 caracteres.').optional().or(z.literal('')),
  consent: z.literal(true, { error: 'É necessário consentir com o tratamento dos dados para continuar.' }),
});

export const inquirySchema = z.object({
  journey: journeySchema,
  contact: contactSchema,
  /** honeypot: deve chegar vazio */
  website: z.string().max(0).optional().or(z.literal('')),
  /** ms entre abrir o form e enviar (anti-bot simples) */
  elapsedMs: z.number().int().nonnegative().optional(),
});

export type Journey = z.infer<typeof journeySchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Inquiry = z.infer<typeof inquirySchema>;

/** Converte issues do Zod em mapa campo → primeira mensagem. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[issue.path.length - 1] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
