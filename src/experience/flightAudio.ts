/**
 * Som do test drive, 100% sintetizado (Web Audio, sem arquivos): turbofan = ronco grave + rugido de ar
 * em banda + assobio do compressor que sobe com a rotação; pistão = pulsos de combustão filtrados com
 * modulação de cilindros. Vento cresce com a velocidade. Começa só após um gesto do usuário (o clique em "Voar").
 */
export class FlightAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private nodes: { rumble: GainNode; roar: GainNode; roarF: BiquadFilterNode; whine: GainNode; whineO: OscillatorNode; wind: GainNode; windF: BiquadFilterNode; pist: GainNode; pistO: OscillatorNode; pistF: BiquadFilterNode; lfo: OscillatorNode; lfoG: GainNode } | null = null;
  private piston = false;
  private stopped = false;

  start(piston: boolean) {
    this.piston = piston;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); this.master = master;
      // ruído rosa (buffer de 2 s em loop)
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.9; }
      const noise = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
      const chain = (src: AudioNode, type: BiquadFilterType, f: number, q = 0.7) => { const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(master); return { fl, g }; };
      const rumble = chain(noise(), 'lowpass', 110, 0.9);
      const roar = chain(noise(), 'bandpass', 520, 0.8);
      const wind = chain(noise(), 'highpass', 900, 0.5);
      const whineO = ctx.createOscillator(); whineO.type = 'sawtooth'; whineO.frequency.value = 400; whineO.start();
      const whine = chain(whineO, 'bandpass', 3000, 6);
      const pistO = ctx.createOscillator(); pistO.type = 'sawtooth'; pistO.frequency.value = 30; pistO.start();
      const pist = chain(pistO, 'lowpass', 420, 1.4);
      // modulação de cilindros (pistão)
      const lfo = ctx.createOscillator(); lfo.frequency.value = 9; const lfoG = ctx.createGain(); lfoG.gain.value = 0; lfo.connect(lfoG); lfoG.connect(pist.g.gain); lfo.start();
      this.nodes = { rumble: rumble.g, roar: roar.g, roarF: roar.fl, whine: whine.g, whineO, wind: wind.g, windF: wind.fl, pist: pist.g, pistO, pistF: pist.fl, lfo, lfoG };
      void ctx.resume();
      master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.4);
    } catch { this.ctx = null; }
  }
  resume() { void this.ctx?.resume(); }
  setMuted(m: boolean) { if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.15); }
  /** spool 0..1 (rotação), speed m/s, cockpit = câmera dentro */
  update(spool: number, speed: number, cockpit: boolean) {
    const c = this.ctx, n = this.nodes; if (!c || !n || this.stopped) return;
    const t = c.currentTime, k = 0.08;
    const w = Math.min(1, speed / 150);
    n.wind.gain.setTargetAtTime(w * w * (cockpit ? 0.22 : 0.12), t, k);
    n.windF.frequency.setTargetAtTime(600 + w * 1600, t, k);
    if (this.piston) {
      const rpm = 0.25 + spool * 0.75;
      n.pistO.frequency.setTargetAtTime(22 + rpm * 70, t, k);
      n.pistF.frequency.setTargetAtTime(260 + rpm * 900, t, k);
      n.pist.gain.setTargetAtTime(0.1 + rpm * 0.16, t, k);
      n.lfo.frequency.setTargetAtTime(6 + rpm * 22, t, k);
      n.lfoG.gain.setTargetAtTime(0.05 + rpm * 0.04, t, k);
      n.rumble.gain.setTargetAtTime(0.18 + rpm * 0.25, t, k);
      n.roar.gain.setTargetAtTime(rpm * 0.08, t, k);
      n.whine.gain.setTargetAtTime(0, t, k);
    } else {
      const s = spool;
      n.whineO.frequency.setTargetAtTime(380 + s * 2600, t, k);
      n.whine.gain.setTargetAtTime(0.012 + s * 0.03, t, k);
      n.roar.gain.setTargetAtTime(Math.pow(s, 1.4) * (cockpit ? 0.28 : 0.55), t, k);
      n.roarF.frequency.setTargetAtTime(320 + s * 900, t, k);
      n.rumble.gain.setTargetAtTime(0.06 + s * 0.42, t, k);
      n.pist.gain.setTargetAtTime(0, t, k); n.lfoG.gain.setTargetAtTime(0, t, k);
    }
  }
  dispose() {
    this.stopped = true;
    const c = this.ctx; if (!c) return;
    try { this.master.gain.setTargetAtTime(0, c.currentTime, 0.12); } catch {}
    window.setTimeout(() => { void c.close().catch(() => {}); }, 450);
    this.ctx = null;
  }
}
