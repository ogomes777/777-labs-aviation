import { engineMix } from '@/three/flight/env';

/**
 * Som do test drive, 100% sintetizado (Web Audio, sem arquivos):
 * - motor: turbofan = ronco grave + rugido de ar + zumbido do fan (serra) + assobio do compressor; pistão = combustão
 *   com modulação de cilindros. Cresce quando acelera, cai quando reduz/freia (os spoilers trepidam).
 * - vento pela velocidade, a água chiando e estourando sob o sopro das turbinas, marulho perto do mar;
 * - bichos e água pontuais vindos do mundo (gaivotas, estorninhos, gansos, golfinhos, peixes, tartarugas,
 *   respingos e impactos), com distância e lado (estéreo).
 * Começa só após um gesto (o clique em "Voar"). Por dentro (cabine/poltrona) tudo fica abafado pela fuselagem.
 */
export interface AudioIn { spool: number; speed: number; inside: boolean; throttleIn: number; brake: boolean; wash: number; sea: number }
export interface SfxIn { kind: string; d: number; pan: number; power: number }

export class FlightAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private cabin!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private pink!: AudioBuffer;
  private white!: AudioBuffer;
  private n: Record<string, AudioNode & { gain?: AudioParam; frequency?: AudioParam }> = {};
  private piston = false;
  private stopped = false;
  private live = 0;

  start(piston: boolean) {
    this.piston = piston;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.006; comp.release.value = 0.25;
      comp.connect(ctx.destination);
      const cabin = ctx.createBiquadFilter(); cabin.type = 'lowpass'; cabin.frequency.value = 18000; cabin.Q.value = 0.5; cabin.connect(comp); this.cabin = cabin;
      const master = ctx.createGain(); master.gain.value = 0; master.connect(cabin); this.master = master;
      const sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master); this.sfxBus = sfxBus;
      // ruído rosa e branco (2 s em loop)
      const len = ctx.sampleRate * 2;
      this.pink = ctx.createBuffer(1, len, ctx.sampleRate); this.white = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.pink.getChannelData(0), w = this.white.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) { const r = Math.random() * 2 - 1; w[i] = r; b0 = 0.997 * b0 + r * 0.029; b1 = 0.985 * b1 + r * 0.032; b2 = 0.95 * b2 + r * 0.048; d[i] = (b0 + b1 + b2 + r * 0.05) * 0.9; }
      const noise = (buf = this.pink) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 1.5); return s; };
      const chain = (src: AudioNode, type: BiquadFilterType, f: number, q = 0.7) => { const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(master); return { fl, g }; };
      const osc = (type: OscillatorType, f: number) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
      // motor
      const rumble = chain(noise(), 'lowpass', 110, 0.9);
      const roar = chain(noise(), 'bandpass', 520, 0.8);
      const whineO = osc('sawtooth', 400); const whine = chain(whineO, 'bandpass', 3000, 6);
      const buzzA = osc('sawtooth', 80), buzzB = osc('sawtooth', 80.7);
      const buzzMix = ctx.createGain(); buzzMix.gain.value = 0.5; buzzA.connect(buzzMix); buzzB.connect(buzzMix);
      const buzz = chain(buzzMix, 'lowpass', 600, 0.9);
      const pistO = osc('sawtooth', 30); const pist = chain(pistO, 'lowpass', 420, 1.4);
      const lfo = osc('sine', 9); const lfoG = ctx.createGain(); lfoG.gain.value = 0; lfo.connect(lfoG); lfoG.connect(pist.g.gain);
      // spoilers: trepidação grave modulada
      const buffet = chain(noise(), 'lowpass', 190, 1.2);
      const bLfo = osc('sine', 7.5); const bLfoG = ctx.createGain(); bLfoG.gain.value = 0; bLfo.connect(bLfoG); bLfoG.connect(buffet.g.gain);
      // vento com rajadas
      const wind = chain(noise(), 'highpass', 900, 0.5);
      // água sob as turbinas: chiado + estrondo grave + estalos
      const washHi = chain(noise(this.white), 'bandpass', 1800, 0.7);
      const washLo = chain(noise(), 'lowpass', 320, 0.8);
      const crack = osc('square', 23); const crackG = ctx.createGain(); crackG.gain.value = 0; crack.connect(crackG); crackG.connect(washHi.g.gain);
      // marulho: ondas indo e vindo
      const surf = chain(noise(), 'lowpass', 650, 0.6);
      const swell = osc('sine', 0.13); const swellG = ctx.createGain(); swellG.gain.value = 0; swell.connect(swellG); swellG.connect(surf.g.gain);
      Object.assign(this.n, {
        rumble: rumble.g, roar: roar.g, roarF: roar.fl, whine: whine.g, whineO, whineF: whine.fl, buzz: buzz.g, buzzF: buzz.fl, buzzA, buzzB,
        pist: pist.g, pistO, pistF: pist.fl, lfo, lfoG, buffet: buffet.g, bLfoG, wind: wind.g, windF: wind.fl,
        washHi: washHi.g, washHiF: washHi.fl, washLo: washLo.g, crackG, surf: surf.g, swellG,
      });
      void ctx.resume();
      master.gain.setTargetAtTime(0.6, ctx.currentTime, 0.4);
    } catch { this.ctx = null; }
  }
  resume() { void this.ctx?.resume(); }
  setMuted(m: boolean) { if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.15); }

  update(I: AudioIn) {
    const c = this.ctx, n = this.n as Record<string, { gain: AudioParam; frequency: AudioParam }>; if (!c || this.stopped) return;
    const t = c.currentTime, k = 0.08, set = (p: AudioParam, v: number, kk = k) => p.setTargetAtTime(v, t, kk);
    const speedK = Math.min(1, I.speed / 150);
    const E = engineMix(I.spool, I.throttleIn, I.brake, speedK);
    const muff = I.inside ? 0.55 : 1;
    set(this.cabin.frequency, I.inside ? 2600 : 18000, 0.15);
    // vento e rajadas
    const gust = 0.85 + 0.15 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1.3);
    set(n.wind.gain, speedK * speedK * (I.inside ? 0.2 : 0.13) * gust);
    set(n.windF.frequency, 600 + speedK * 1700);
    if (this.piston) {
      const rpm = 0.25 + I.spool * 0.75;
      set(n.pistO.frequency, 22 + rpm * 70); set(n.pistF.frequency, (260 + rpm * 900) * E.bright);
      set(n.pist.gain, (0.08 + rpm * 0.18) * E.gain);
      set(n.lfo.frequency, 6 + rpm * 22); set(n.lfoG.gain, 0.05 + rpm * 0.04);
      set(n.rumble.gain, (0.16 + rpm * 0.28) * E.gain); set(n.roar.gain, rpm * 0.09 * E.gain);
      set(n.whine.gain, 0); set(n.buzz.gain, 0);
    } else {
      const s = I.spool;
      set(n.whineO.frequency, 380 + s * 2700); set(n.whineF.frequency, 2400 + s * 2600);
      set(n.whine.gain, (0.01 + s * 0.032) * E.gain);
      set(n.roar.gain, Math.pow(s, 1.3) * 0.6 * E.gain * muff); set(n.roarF.frequency, (300 + s * 1100) * E.bright);
      set(n.rumble.gain, (0.05 + s * 0.46) * E.gain);
      const f1 = 52 + s * 105; set(n.buzzA.frequency, f1); set(n.buzzB.frequency, f1 * 1.009);
      set(n.buzz.gain, s * s * 0.1 * E.gain * muff); set(n.buzzF.frequency, 300 + s * 900);
      set(n.pist.gain, 0); set(n.lfoG.gain, 0);
    }
    set(n.buffet.gain, E.buffet * 0.22); set(n.bLfoG.gain, E.buffet * 0.12);
    // água
    const w = Math.min(1.2, I.wash);
    set(n.washHi.gain, w * 0.42 * muff, 0.05); set(n.washHiF.frequency, 1300 + w * 1500, 0.05);
    set(n.washLo.gain, w * 0.5, 0.05); set(n.crackG.gain, w * 0.18, 0.05);
    set(n.surf.gain, I.sea * 0.16 * (I.inside ? 0.4 : 1), 0.4); set(n.swellG.gain, I.sea * 0.08, 0.4);
  }

  /** som pontual com distância e lado */
  sfx(e: SfxIn) {
    const c = this.ctx; if (!c || this.stopped || this.live > 24) return;
    const ref = e.kind === 'impact' ? 220 : e.kind === 'splash' ? 70 : e.kind === 'click' || e.kind === 'fin' || e.kind === 'breath' ? 30 : 55;
    const att = Math.min(1, ref / (ref + e.d)) * e.power;
    if (att < 0.02) return;
    const t0 = c.currentTime + Math.min(0.5, e.d / 343); // o som chega depois (velocidade do som)
    const pan = c.createStereoPanner(); pan.pan.value = e.pan * 0.85;
    const out = c.createGain(); out.gain.value = att; out.connect(pan); pan.connect(this.sfxBus);
    this.live++;
    const end = (tEnd: number) => window.setTimeout(() => { this.live--; try { out.disconnect(); pan.disconnect(); } catch { /* já desconectado */ } }, (tEnd - c.currentTime) * 1000 + 200);
    const env = (g: GainNode, t: number, a: number, peak: number, r: number) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0, t + a, r); };
    const tone = (type: OscillatorType, t: number, dur: number, f: number[], peak: number, filt?: [BiquadFilterType, number, number]) => {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f[0], t);
      f.slice(1).forEach((v, i) => o.frequency.linearRampToValueAtTime(v, t + (dur * (i + 1)) / (f.length - 1)));
      const g = c.createGain(); env(g, t, Math.min(0.03, dur * 0.2), peak, dur * 0.35);
      let node: AudioNode = o;
      if (filt) { const fl = c.createBiquadFilter(); fl.type = filt[0]; fl.frequency.value = filt[1]; fl.Q.value = filt[2]; o.connect(fl); node = fl; }
      node.connect(g); g.connect(out); o.start(t); o.stop(t + dur * 2 + 0.1);
    };
    const burst = (t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, white = false) => {
      const s = c.createBufferSource(); s.buffer = white ? this.white : this.pink;
      const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
      const g = c.createGain(); env(g, t, Math.min(0.012, dur * 0.1), peak, dur * 0.4);
      s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur * 2 + 0.1);
    };
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    let tEnd = t0 + 1;
    switch (e.kind) {
      case 'gull': { // "kiáu kiáu": glissando com formante nasal
        const n = 2 + Math.floor(Math.random() * 3), p = r(0.88, 1.12);
        for (let i = 0; i < n; i++) { const t = t0 + i * r(0.26, 0.36); tone('sawtooth', t, 0.32, [1250 * p, 2050 * p, 1650 * p, 1150 * p], 0.22, ['bandpass', 1900 * p, 3.5]); tone('sine', t, 0.32, [2500 * p, 4100 * p, 3300 * p], 0.05); }
        tEnd = t0 + n * 0.36 + 0.5; break;
      }
      case 'starling': { // revoada: chilreio de muitos bicos
        const n = 14 + Math.floor(Math.random() * 12);
        for (let i = 0; i < n; i++) { const t = t0 + r(0, 1.3), f = r(2800, 6200); tone('sine', t, r(0.03, 0.08), [f, f * r(0.7, 1.4), f * r(0.8, 1.2)], 0.08); }
        burst(t0, 1.4, 'highpass', 5000, 7000, 0.5, 0.03, true); // asas batendo
        tEnd = t0 + 1.8; break;
      }
      case 'goose': { // grasnado: buzina nasal
        const n = 2 + Math.floor(Math.random() * 2), p = r(0.9, 1.1);
        for (let i = 0; i < n; i++) { const t = t0 + i * r(0.32, 0.45); tone('sawtooth', t, 0.2, [330 * p, 360 * p, 280 * p], 0.2, ['bandpass', 950, 3]); tone('square', t, 0.2, [660 * p, 700 * p, 560 * p], 0.04, ['bandpass', 2300, 4]); }
        tEnd = t0 + n * 0.45 + 0.4; break;
      }
      case 'frigate': burst(t0, 0.45, 'bandpass', 420, 360, 4, 0.12); tone('square', t0, 0.4, [26, 22], 0.03, ['lowpass', 500, 1]); tEnd = t0 + 0.9; break;
      case 'dolphin': { // assobio com contorno sinuoso
        const dur = r(0.45, 0.9), f = r(7000, 11000);
        tone('sine', t0, dur, [f, f * 1.35, f * 0.8, f * 1.25, f * 0.9], 0.07);
        tone('sine', t0 + dur * 0.9, dur * 0.6, [f * 0.9, f * 1.4, f], 0.05);
        tEnd = t0 + dur * 1.6 + 0.3; break;
      }
      case 'click': { // estalos de ecolocalização acelerando
        let t = t0; const n = 10 + Math.floor(Math.random() * 18);
        for (let i = 0; i < n; i++) { burst(t, 0.006, 'highpass', 3500, 3500, 0.7, 0.16, true); t += Math.max(0.012, 0.06 - i * 0.003); }
        tEnd = t + 0.3; break;
      }
      case 'splash': case 'fishjump': { // respingo: estouro + chiado que desce + baque grave
        const big = e.kind === 'splash' ? 1 : 0.45;
        burst(t0, 0.55 * big + 0.15, 'bandpass', 2600, 700, 0.8, 0.5, true);
        burst(t0, 0.25 * big + 0.08, 'lowpass', 260, 90, 1, 0.35 * big);
        for (let i = 0; i < 6 * big + 2; i++) burst(t0 + r(0.05, 0.5) * big, 0.04, 'bandpass', r(1500, 4000), 1200, 2, 0.08, true); // gotas caindo
        tEnd = t0 + 1.2; break;
      }
      case 'breath': burst(t0, 0.35, 'bandpass', 900, 600, 1.2, 0.3, true); burst(t0 + 0.42, 0.5, 'bandpass', 700, 1000, 1.5, 0.15); tEnd = t0 + 1.1; break;
      case 'fin': burst(t0, 0.6, 'bandpass', 1400, 900, 1.4, 0.18, true); tEnd = t0 + 1.0; break;
      case 'impact': { // queda na água
        burst(t0, 1.8, 'lowpass', 1800, 120, 0.7, 0.9);
        burst(t0, 1.2, 'bandpass', 3000, 500, 0.6, 0.6, true);
        tone('sine', t0, 0.5, [70, 38], 0.6);
        for (let i = 0; i < 18; i++) burst(t0 + r(0.3, 2.2), 0.05, 'bandpass', r(1200, 3800), 900, 2, 0.12, true);
        tEnd = t0 + 3; break;
      }
      default: break;
    }
    end(tEnd);
  }

  dispose() {
    this.stopped = true;
    const c = this.ctx; if (!c) return;
    try { this.master.gain.setTargetAtTime(0, c.currentTime, 0.12); } catch { /* contexto já fechado */ }
    window.setTimeout(() => { void c.close().catch(() => {}); }, 450);
    this.ctx = null;
  }
}
