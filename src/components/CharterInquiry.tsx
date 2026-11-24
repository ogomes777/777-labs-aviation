'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { contactSchema, fieldErrors, journeySchema, PURPOSES, todayISO } from '@/lib/validation';
import { formBridge } from '@/experience/director';
import { track } from '@/lib/analytics';

type Step = 0 | 1 | 2;
type Result = { kind: 'demo' | 'ok' | 'error'; title: string; detail: string; id?: string } | null;
const STEPS = ['Jornada', 'Contato', 'Revisão'];

const initial = { from: '', to: '', date: '', returnDate: '', passengers: '', name: '', email: '', phone: '', purpose: '', message: '', consent: false };

export default function CharterInquiry() {
  const [step, setStep] = useState<Step>(0);
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [hp, setHp] = useState('');
  const started = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const bridge = formBridge.useStore((s) => s);
  const min = useMemo(() => todayISO(), []);

  useEffect(() => { if (bridge.stamp) { setV((x) => ({ ...x, to: bridge.to })); setStep(0); setResult(null); } }, [bridge.stamp, bridge.to]);

  const set = (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (started.current === null) { started.current = performance.now(); track('quote_form_start'); }
    const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setV((x) => ({ ...x, [k]: val }));
    if (errors[k]) setErrors((er) => { const n = { ...er }; delete n[k]; return n; });
  };

  const focusFirstError = (errs: Record<string, string>) => {
    requestAnimationFrame(() => {
      const fields = Array.from(formRef.current?.querySelectorAll<HTMLElement>('[name]') ?? []);
      const el = fields.find((f) => errs[f.getAttribute('name') ?? '']);
      el?.focus();
    });
  };
  const goStep = (s: Step) => { setStep(s); requestAnimationFrame(() => stepHeading.current?.focus()); };

  const validateJourney = () => {
    const r = journeySchema.safeParse({ from: v.from, to: v.to, date: v.date, returnDate: v.returnDate, passengers: v.passengers === '' ? undefined : v.passengers });
    if (!r.success) { const e = fieldErrors(r.error); setErrors(e); focusFirstError(e); track('quote_form_validation_error', { step: 1, fields: Object.keys(e).join(',') }); return null; }
    return r.data;
  };
  const validateContact = () => {
    const r = contactSchema.safeParse({ name: v.name, email: v.email, phone: v.phone, purpose: v.purpose, message: v.message, consent: v.consent });
    if (!r.success) { const e = fieldErrors(r.error); setErrors(e); focusFirstError(e); track('quote_form_validation_error', { step: 2, fields: Object.keys(e).join(',') }); return null; }
    return r.data;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0) { if (validateJourney()) { setErrors({}); goStep(1); } return; }
    if (step === 1) { if (validateContact()) { setErrors({}); goStep(2); } return; }
    const journey = validateJourney(); const contact = validateContact();
    if (!journey) { goStep(0); return; }
    if (!contact) { goStep(1); return; }
    setBusy(true); setResult(null);
    track('quote_form_submit');
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journey, contact, website: hp, elapsedMs: Math.round(performance.now() - (started.current ?? performance.now())) }),
      });
      const data = (await res.json().catch(() => ({}))) as { mode?: string; id?: string; message?: string; errors?: Record<string, string> };
      if (res.ok && data.mode === 'demo') {
        setResult({ kind: 'demo', title: 'Demonstração concluída: nenhum pedido foi enviado.', detail: 'O servidor validou os dados e os descartou. Não há reserva, cotação ou contato de operadora nesta demonstração.', id: data.id });
        track('quote_form_demo');
      } else if (res.ok && data.mode === 'live') {
        setResult({ kind: 'ok', title: 'Solicitação recebida pelo sistema.', detail: 'Isto não é uma reserva confirmada. A equipe responsável entrará em contato pelo canal informado.', id: data.id });
        track('quote_form_success');
      } else if (res.status === 422 && data.errors) {
        setErrors(data.errors); setResult({ kind: 'error', title: 'Revise os campos destacados.', detail: 'A validação do servidor encontrou divergências.' });
      } else {
        setResult({ kind: 'error', title: 'Não foi possível concluir o envio.', detail: data.message ?? 'Tente novamente em alguns instantes.' });
      }
    } catch {
      setResult({ kind: 'error', title: 'Sem conexão com o servidor.', detail: 'Verifique sua conexão e tente novamente. Nenhum dado foi enviado.' });
    } finally { setBusy(false); }
  };

  const F = ({ name, label, children, full, hint }: { name: string; label: string; children: React.ReactNode; full?: boolean; hint?: string }) => (
    <div className={`field${full ? ' field--full' : ''}`} data-invalid={errors[name] ? 'true' : undefined}>
      <label htmlFor={`f-${name}`}>{label}</label>
      {children}
      {hint && !errors[name] && <span className="hint" id={`h-${name}`}>{hint}</span>}
      {errors[name] && <span className="err" id={`e-${name}`} role="alert">{errors[name]}</span>}
    </div>
  );
  const a = (name: string, hint?: boolean) => ({ id: `f-${name}`, name, 'aria-invalid': errors[name] ? true : undefined, 'aria-describedby': errors[name] ? `e-${name}` : hint ? `h-${name}` : undefined });

  const reset = () => { setV(initial); setErrors({}); setResult(null); started.current = null; goStep(0); };

  return (
    <form ref={formRef} className="form" noValidate onSubmit={onSubmit} aria-labelledby="form-title" aria-busy={busy}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="demo-flag">Modo demonstração</span>
        <span style={{ fontSize: '0.72rem', letterSpacing: '0.16em', color: 'var(--steel)' }}>ETAPA {step + 1} / 3</span>
      </div>
      <ol className="form__steps" aria-label="Etapas">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} data-done={i < step ? 'true' : undefined}>{String(i + 1).padStart(2, '0')} · {s}</li>)}
      </ol>
      <h3 id="form-title" ref={stepHeading} tabIndex={-1} style={{ fontSize: '1.6rem', outline: 'none' }}>{['Para onde vamos?', 'Como falamos com você?', 'Revise sua solicitação'][step]}</h3>

      {step === 0 && (
        <div className="fields">
          {F({ name: 'from', label: 'Origem', children: <input {...a('from', true)} value={v.from} onChange={set('from')} placeholder="Cidade ou aeroporto" autoComplete="off" maxLength={80} />, hint: 'Ex.: São Paulo' })}
          {F({ name: 'to', label: 'Destino', children: <input {...a('to', true)} value={v.to} onChange={set('to')} placeholder="Cidade ou aeroporto" autoComplete="off" maxLength={80} />, hint: 'Ou escolha no globo de destinos' })}
          {F({ name: 'date', label: 'Data de ida', children: <input {...a('date')} type="date" min={min} value={v.date} onChange={set('date')} /> })}
          {F({ name: 'returnDate', label: 'Retorno (opcional)', children: <input {...a('returnDate')} type="date" min={v.date || min} value={v.returnDate} onChange={set('returnDate')} /> })}
          {F({ name: 'passengers', label: 'Passageiros', full: true, children: <input {...a('passengers', true)} type="number" inputMode="numeric" min={1} max={20} step={1} value={v.passengers} onChange={set('passengers')} placeholder="1 a 20" />, hint: 'Limite apenas da demonstração; não indica capacidade de aeronave.' })}
        </div>
      )}

      {step === 1 && (
        <div className="fields">
          {F({ name: 'name', label: 'Nome', children: <input {...a('name')} value={v.name} onChange={set('name')} autoComplete="name" maxLength={80} /> })}
          {F({ name: 'email', label: 'E-mail', children: <input {...a('email')} type="email" value={v.email} onChange={set('email')} autoComplete="email" maxLength={120} /> })}
          {F({ name: 'phone', label: 'Telefone (opcional)', children: <input {...a('phone')} type="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" maxLength={25} /> })}
          {F({ name: 'purpose', label: 'Objetivo', children: (
            <select {...a('purpose')} value={v.purpose} onChange={set('purpose')}>
              <option value="">Selecionar</option>
              {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          ) })}
          {F({ name: 'message', label: 'Observações (opcional)', full: true, children: <textarea {...a('message')} value={v.message} onChange={set('message')} maxLength={600} /> })}
          <div className="field field--full" data-invalid={errors.consent ? 'true' : undefined}>
            <label className="consent" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.9rem' }}>
              <input type="checkbox" name="consent" checked={v.consent} onChange={set('consent')} aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? 'e-consent' : undefined} />
              <span>Autorizo o tratamento dos dados informados exclusivamente para responder a esta solicitação de demonstração, conforme a LGPD. Entendo que a 777 LABS AVIATION é um conceito e não opera voos.</span>
            </label>
            {errors.consent && <span className="err" id="e-consent" role="alert">{errors.consent}</span>}
          </div>
        </div>
      )}

      {step === 2 && (
        <dl className="summary">
          <dt>Rota</dt><dd>{v.from} → {v.to}</dd>
          <dt>Datas</dt><dd>{v.date}{v.returnDate ? ` · retorno ${v.returnDate}` : ' · somente ida'}</dd>
          <dt>Passageiros</dt><dd>{v.passengers}</dd>
          <dt>Contato</dt><dd>{v.name} · {v.email}{v.phone ? ` · ${v.phone}` : ''}</dd>
          <dt>Objetivo</dt><dd>{v.purpose}</dd>
          {v.message && (<><dt>Observações</dt><dd>{v.message}</dd></>)}
        </dl>
      )}

      <div className="hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" /></label></div>

      <div role="status" aria-live="polite">
        {result && (
          <div className={`status status--${result.kind}`}>
            <strong>{result.title}</strong>
            <span>{result.detail}</span>
            {result.id && <small>ID de {result.kind === 'demo' ? 'demonstração' : 'protocolo'}: {result.id}</small>}
          </div>
        )}
      </div>

      <div className="form__actions">
        {step > 0 ? <button type="button" className="btn btn--ghost btn--small" onClick={() => goStep((step - 1) as Step)} disabled={busy}>Voltar</button> : <span />}
        {result?.kind === 'demo' || result?.kind === 'ok' ? (
          <button type="button" className="btn btn--ghost" onClick={reset}>Nova simulação</button>
        ) : (
          <button type="submit" className="btn btn--solid" disabled={busy}>
            {step === 0 ? 'Continuar' : step === 1 ? 'Revisar' : busy ? 'Validando…' : 'Enviar interesse para demonstração'}
          </button>
        )}
      </div>
    </form>
  );
}
