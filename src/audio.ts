/**
 * All sound is synthesised live with the Web Audio API: no audio files, nothing to license.
 * Music: a slow, swung lounge loop (electric piano comping, upright-ish bass, brushes and
 * an occasional vibraphone note) over an 8-bar ii–V progression in D.
 */

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

// 8 bars, one chord per bar: [bass root, voicing notes] as MIDI numbers.
const PROGRESSION: [number, number[]][] = [
  [50, [61, 66, 69, 73]], // Dmaj9-ish
  [47, [62, 66, 69, 73]], // Bm9
  [52, [62, 66, 67, 71]], // Em9
  [45, [61, 66, 67, 71]], // A13
  [55, [62, 66, 69, 71]], // Gmaj7
  [54, [61, 64, 69, 71]], // F#m7
  [52, [62, 64, 67, 71]], // Em7
  [45, [60, 62, 67, 71]], // A7sus
];
const MELODY_SCALE = [74, 76, 78, 81, 83, 86]; // D major pentatonic, upper register

const BPM = 76;
const EIGHTH = 60 / BPM / 2;
const SWING = 0.62; // share of a beat taken by the first eighth

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private verb!: ConvolverNode;
  private ep!: GainNode;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private noise!: AudioBuffer;
  muted = false;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  /** For automated checks: is the clock running, what is the master gain, how far has the loop got. */
  debugState(): { ctx: string; gain: number; step: number } {
    return { ctx: this.ctx?.state ?? 'none', gain: this.ctx ? this.master.gain.value : 0, step: this.step };
  }

  /** Must be called from a user gesture (browsers block audio until then). */
  start(): void {
    if (!this.ctx) this.init();
    void this.ctx!.resume();
    if (this.timer === null) {
      this.nextTime = this.ctx!.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 1, t, 0.08);
  }

  /** Pause the clock while the tab is hidden so music doesn't pile up. */
  suspend(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private init(): void {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.4);
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.28;
    this.verb.connect(verbGain).connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.16;
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 3200;
    this.music.connect(warm);
    warm.connect(this.master);
    warm.connect(this.verb);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.42;
    this.sfx.connect(this.master);
    this.sfx.connect(this.verb);

    // Electric-piano bus with gentle tremolo.
    this.ep = ctx.createGain();
    this.ep.gain.value = 0.85;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 4.2;
    depth.gain.value = 0.15;
    lfo.connect(depth).connect(this.ep.gain);
    lfo.start();
    this.ep.connect(this.music);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }

  private schedule(): void {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime);
      const beatLen = EIGHTH * 2;
      this.nextTime += this.step % 2 === 0 ? beatLen * SWING : beatLen * (1 - SWING);
      this.step++;
    }
  }

  /** One swung eighth note. 8 eighths per bar, 8 bars per loop. */
  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / 8) % PROGRESSION.length;
    const e = step % 8;
    const [root, chord] = PROGRESSION[bar];
    const nextRoot = PROGRESSION[(bar + 1) % PROGRESSION.length][0];
    const loopBar = Math.floor(step / 8);

    // Comping: beat 1 and the "and" of 2, with a lighter push on the "and" of 4 sometimes.
    if (e === 0) chord.forEach((n, i) => this.epNote(n, t + i * 0.012, 1.9, 0.32));
    if (e === 3) chord.forEach((n, i) => this.epNote(n, t + i * 0.01, 0.9, 0.2));
    if (e === 7 && loopBar % 2 === 1) chord.slice(1).forEach((n) => this.epNote(n, t, 0.5, 0.12));

    // Bass: root, fifth, and a chromatic approach into the next bar.
    if (e === 0) this.bass(root, t, 0.9);
    if (e === 4) this.bass(root + 7, t, 0.7);
    if (e === 6) this.bass(nextRoot + (nextRoot > root ? -1 : 1), t, 0.45);

    // Brushes: soft swish on 2 and 4, faint taps elsewhere.
    if (e === 2 || e === 6) this.brush(t, 0.05, 0.16);
    else if (e % 2 === 1) this.brush(t, 0.018, 0.05);

    // Vibraphone: sparse, deterministic-ish melody that drifts each loop.
    const roll = Math.sin(step * 12.9898 + loopBar * 78.233) * 43758.5453;
    const r = roll - Math.floor(roll);
    if ((e === 1 || e === 4 || e === 5) && r < 0.3) {
      const note = MELODY_SCALE[Math.floor(r * 100) % MELODY_SCALE.length];
      this.vibe(note, t, 0.11);
    }
  }

  private epNote(m: number, t: number, dur: number, vel: number): void {
    const ctx = this.ctx!;
    const f = midiHz(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.22, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vel * 0.07, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    mod.frequency.value = f;
    modGain.gain.setValueAtTime(f * 1.4, t);
    modGain.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.3);
    mod.connect(modGain).connect(car.frequency);
    car.connect(g).connect(this.ep);
    car.start(t); mod.start(t);
    car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }

  private bass(m: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midiHz(m - 12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private brush(t: number, vol: number, dur: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 7000;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.music);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private vibe(m: number, t: number, vol: number, out?: AudioNode): void {
    const ctx = this.ctx!;
    const f = midiHz(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const a = ctx.createOscillator();
    a.frequency.value = f;
    const b = ctx.createOscillator();
    b.frequency.value = f * 4;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.25, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    a.connect(g);
    b.connect(bg).connect(g);
    g.connect(out ?? this.music);
    a.start(t); b.start(t);
    a.stop(t + 1.7); b.stop(t + 1.7);
  }

  // ---------- sound effects ----------

  private now(): number | null {
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx.currentTime + 0.01;
  }

  blink(): void {
    const t = this.now();
    if (t === null) return;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    src.connect(bp).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + 0.3);
  }

  found(): void {
    const t = this.now();
    if (t === null) return;
    this.vibe(88, t, 0.35, this.sfx);
    this.vibe(95, t + 0.07, 0.25, this.sfx);
  }

  wrong(): void {
    const t = this.now();
    if (t === null) return;
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.25);
  }

  tick(): void {
    const t = this.now();
    if (t === null) return;
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.06);
  }

  roundClear(): void {
    const t = this.now();
    if (t === null) return;
    [74, 78, 81, 86].forEach((m, i) => this.vibe(m, t + i * 0.09, 0.22, this.sfx));
  }

  lifeLost(): void {
    const t = this.now();
    if (t === null) return;
    [69, 65].forEach((m, i) => this.vibe(m, t + i * 0.16, 0.25, this.sfx));
  }

  gameOver(): void {
    const t = this.now();
    if (t === null) return;
    [74, 70, 67, 62].forEach((m, i) => this.vibe(m, t + i * 0.22, 0.24, this.sfx));
  }
}
