/** Tiny synthesized sound effects (no audio files). Muted state is remembered. */

const KEY = 'advent-sound';
let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // ignore
  }
}

function audio(): AudioContext | null {
  if (!soundEnabled()) return null;
  if (!ctx) {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Scratchy foil noise whose loudness and brightness follow the finger speed. */
export function startScratchSound() {
  const c = audio();
  if (!c) return null;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const highpass = c.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 1400;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 3200;
  band.Q.value = 0.8;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(highpass).connect(band).connect(gain).connect(c.destination);
  src.start();

  return {
    move(distancePx: number) {
      const t = c.currentTime;
      const level = Math.min(0.32, 0.03 + distancePx * 0.012);
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(level, t, 0.012);
      gain.gain.setTargetAtTime(0, t + 0.07, 0.05);
      band.frequency.setTargetAtTime(2400 + Math.min(3600, distancePx * 90), t, 0.02);
    },
    stop() {
      const t = c.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(0, t, 0.03);
      src.stop(t + 0.25);
    },
  };
}

function tone(c: AudioContext, freq: number, start: number, length: number, volume: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

/** Bright little arpeggio for reveals. */
export function playChime() {
  const c = audio();
  if (!c) return;
  [1318.5, 1568, 1975.5, 2637].forEach((f, i) => tone(c, f, c.currentTime + i * 0.07, 0.9, 0.1));
}

/** Glassy "tink" — pitch drops for bigger objects. */
export function playTink(size = 1, volume = 0.06) {
  const c = audio();
  if (!c) return;
  const f = 2600 / Math.max(0.6, size);
  tone(c, f, c.currentTime, 0.35, volume);
  tone(c, f * 2.76, c.currentTime, 0.18, volume * 0.4);
}

/** Soft switch click (village windows). */
export function playClick() {
  const c = audio();
  if (!c) return;
  tone(c, 180, c.currentTime, 0.06, 0.08, 'square');
  tone(c, 2200, c.currentTime + 0.01, 0.05, 0.03);
}
