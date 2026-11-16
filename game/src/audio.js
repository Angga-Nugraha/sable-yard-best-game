// SABLE YARD — synthesized sound. Eleven distinct WebAudio voices, no audio
// files: one shot voice per weapon kind, plus hit, kill, reload, dry fire,
// buy, interface click, beacon plant tick, explosion and round end.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
  }
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.32;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.unlocked = true;
    } catch {
      // Headless or no audio device: stay silent, never throw.
    }
  }
  _now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
  _noiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  _noise(dur, filterFreq, gain, type = 'lowpass', when = 0) {
    if (!this.ctx) return;
    const t = this._now() + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.02);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }
  _tone(freq, dur, gain, type = 'square', slideTo = null, when = 0) {
    if (!this.ctx) return;
    const t = this._now() + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // One shot voice per weapon kind.
  shot(kind) {
    if (!this.ctx) return;
    try {
      switch (kind) {
        case 'p9':
          this._noise(0.09, 2400, 0.5, 'bandpass');
          this._tone(190, 0.08, 0.35, 'square', 70);
          break;
        case 'smg':
          this._noise(0.07, 3200, 0.42, 'bandpass');
          this._tone(260, 0.06, 0.28, 'square', 110);
          break;
        case 'rifle':
          this._noise(0.13, 1700, 0.6, 'lowpass');
          this._tone(150, 0.12, 0.42, 'sawtooth', 55);
          break;
        case 'dmr':
          this._noise(0.22, 1100, 0.75, 'lowpass');
          this._tone(110, 0.2, 0.5, 'sawtooth', 40);
          this._noise(0.3, 5200, 0.25, 'highpass', 0.02);
          break;
        case 'shotgun':
          this._noise(0.24, 900, 0.85, 'lowpass');
          this._tone(95, 0.18, 0.5, 'sawtooth', 38);
          break;
        default:
          this._noise(0.1, 2000, 0.5, 'bandpass');
      }
    } catch { /* never break the game for sound */ }
  }
  hit(kill) {
    if (!this.ctx) return;
    try {
      this._tone(kill ? 1180 : 880, kill ? 0.14 : 0.07, 0.3, 'sine');
      if (kill) this._tone(1560, 0.16, 0.22, 'sine', null, 0.06);
    } catch { /* silent */ }
  }
  reload() {
    if (!this.ctx) return;
    try {
      this._tone(520, 0.05, 0.22, 'square');
      this._tone(340, 0.05, 0.22, 'square', null, 0.14);
      this._tone(700, 0.06, 0.26, 'square', null, 0.32);
    } catch { /* silent */ }
  }
  buy() {
    if (!this.ctx) return;
    try {
      this._tone(660, 0.09, 0.28, 'sine');
      this._tone(990, 0.14, 0.28, 'sine', null, 0.09);
    } catch { /* silent */ }
  }
  dryFire() {
    if (!this.ctx) return;
    try { this._tone(1400, 0.03, 0.18, 'square'); } catch { /* silent */ }
  }
  click() {
    if (!this.ctx) return;
    try { this._tone(900, 0.04, 0.18, 'sine'); } catch { /* silent */ }
  }
  plantTick() {
    if (!this.ctx) return;
    try { this._tone(1150, 0.05, 0.24, 'square'); } catch { /* silent */ }
  }
  explosion() {
    if (!this.ctx) return;
    try {
      this._noise(0.9, 420, 0.9, 'lowpass');
      this._tone(70, 0.7, 0.6, 'sine', 28);
      this._noise(0.25, 3000, 0.3, 'highpass');
    } catch { /* silent */ }
  }
  roundEnd(win) {
    if (!this.ctx) return;
    try {
      const notes = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
      notes.forEach((f, i) => this._tone(f, 0.22, 0.26, 'triangle', null, i * 0.13));
    } catch { /* silent */ }
  }
}
