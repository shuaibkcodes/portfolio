/**
 * Synthesised car audio (no assets): engine hum, road/tyre noise, wind,
 * indicator ticks and a navigation chime. Created on first user gesture.
 */
class CarAudio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private engineOsc?: OscillatorNode;
  private engineOsc2?: OscillatorNode;
  private engineFilter?: BiquadFilterNode;
  private engineGain?: GainNode;
  private roadGain?: GainNode;
  private roadFilter?: BiquadFilterNode;
  private windGain?: GainNode;
  private enabled = false;

  private init() {
    if (this.ctx || typeof window === "undefined") return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Engine: two detuned low oscillators through a low-pass.
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 220;
    this.engineFilter.Q.value = 1.2;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 38;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = "triangle";
    this.engineOsc2.frequency.value = 19.3;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Road + wind from brown noise.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    this.roadFilter = ctx.createBiquadFilter();
    this.roadFilter.type = "bandpass";
    this.roadFilter.frequency.value = 180;
    this.roadFilter.Q.value = 0.6;
    this.roadGain = ctx.createGain();
    this.roadGain.gain.value = 0;
    noise.connect(this.roadFilter).connect(this.roadGain).connect(this.master);

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "highpass";
    windFilter.frequency.value = 900;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(windFilter).connect(this.windGain).connect(this.master);
    noise.start();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.init();
    if (!this.ctx || !this.master) return;
    if (on) void this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.4);
  }

  /** Called ~per frame with speed (m/s) and acceleration. */
  update(speed: number, accel: number, running: boolean) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const v = Math.abs(speed);
    const rpm = running ? 36 + v * 2.1 + Math.max(accel, 0) * 3 : 0;
    this.engineOsc!.frequency.setTargetAtTime(Math.max(rpm, 20), t, 0.15);
    this.engineOsc2!.frequency.setTargetAtTime(Math.max(rpm * 0.502, 10), t, 0.15);
    this.engineFilter!.frequency.setTargetAtTime(160 + v * 16 + Math.max(accel, 0) * 40, t, 0.2);
    this.engineGain!.gain.setTargetAtTime(running ? 0.09 + Math.min(v / 40, 1) * 0.05 : 0, t, 0.3);
    this.roadGain!.gain.setTargetAtTime(Math.min(v / 30, 1) * 0.22, t, 0.3);
    this.roadFilter!.frequency.setTargetAtTime(120 + v * 9, t, 0.3);
    this.windGain!.gain.setTargetAtTime(Math.min((v * v) / 1600, 1) * 0.05, t, 0.4);
  }

  engineStart() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const f = this.engineOsc!.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(18, t);
    f.linearRampToValueAtTime(70, t + 0.35);
    f.exponentialRampToValueAtTime(36, t + 1.4);
    this.engineGain!.gain.setTargetAtTime(0.14, t, 0.05);
  }

  chime() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t + i * 0.14);
      g.gain.linearRampToValueAtTime(0.08, t + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.6);
      o.connect(g).connect(this.master!);
      o.start(t + i * 0.14);
      o.stop(t + i * 0.14 + 0.7);
    });
  }

  tick() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = 2400;
    g.gain.setValueAtTime(0.025, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.04);
  }
}

export const audio = new CarAudio();
