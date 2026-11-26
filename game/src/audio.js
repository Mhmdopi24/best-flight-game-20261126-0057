// audio.js — every sound is synthesized with WebAudio: a puttering
// engine whose note follows the throttle, a two-note chime for a ring,
// a little jingle for a delivery and a thud for a crash. The context
// starts on the first user gesture, as browsers require.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }

  ensureStarted() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
  }

  setEngine(throttle, flying) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(52 + throttle * 68, t, 0.08);
    this.engineGain.gain.setTargetAtTime(flying && !this.muted ? 0.045 + throttle * 0.03 : 0, t, 0.1);
  }

  blip(freq, delay, length = 0.16, type = 'sine', volume = 0.12) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + length + 0.05);
  }

  ringChime() {
    this.blip(880, 0, 0.18);
    this.blip(1318, 0.09, 0.26);
  }

  deliveryJingle() {
    this.blip(523, 0, 0.2);
    this.blip(659, 0.13, 0.2);
    this.blip(784, 0.26, 0.34);
  }

  bounceWarn() {
    this.blip(196, 0, 0.16, 'square', 0.08);
    this.blip(196, 0.2, 0.16, 'square', 0.08);
  }

  crashThud() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const length = 0.5;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;
    source.connect(filter).connect(gain).connect(this.ctx.destination);
    source.start(t0);
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, t0, 0.05);
  }
}
