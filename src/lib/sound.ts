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

interface Burst {
  at?: number;
  duration: number;
  type: BiquadFilterType;
  from: number;
  to: number;
  q?: number;
  volume: number;
  attack?: number;
}

/** A shaped burst of filtered noise — the basis for paper, friction and wind sounds. */
function noiseBurst(c: AudioContext, b: Burst) {
  const t = c.currentTime + (b.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = b.type;
  filter.Q.value = b.q ?? 0.7;
  filter.frequency.setValueAtTime(b.from, t);
  filter.frequency.exponentialRampToValueAtTime(b.to, t + b.duration);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(b.volume, t + (b.attack ?? 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + b.duration);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + b.duration + 0.05);
}

/** Paper swoosh followed by a soft snap as the page lands. */
export function playPageFlip() {
  const c = audio();
  if (!c) return;
  noiseBurst(c, { duration: 0.34, type: 'bandpass', from: 1600, to: 5200, q: 0.6, volume: 0.2, attack: 0.07 });
  noiseBurst(c, { at: 0.26, duration: 0.09, type: 'highpass', from: 2600, to: 1800, volume: 0.1, attack: 0.004 });
}

/** A book sliding against its neighbours, then a soft thud. */
export function playBookSlide() {
  const c = audio();
  if (!c) return;
  noiseBurst(c, { duration: 0.5, type: 'lowpass', from: 1300, to: 420, q: 1.2, volume: 0.22, attack: 0.1 });
  tone(c, 95, c.currentTime + 0.42, 0.18, 0.14);
  tone(c, 190, c.currentTime + 0.42, 0.08, 0.04, 'triangle');
}

/** Rising shimmer of foil being swept away. */
export function playSweep() {
  const c = audio();
  if (!c) return;
  noiseBurst(c, { duration: 1.1, type: 'bandpass', from: 900, to: 7000, q: 0.9, volume: 0.18, attack: 0.25 });
}

export function playLightOn() {
  const c = audio();
  if (!c) return;
  tone(c, 220, c.currentTime, 0.05, 0.07, 'square');
  tone(c, 2400, c.currentTime + 0.005, 0.04, 0.03);
  tone(c, 110, c.currentTime + 0.03, 0.35, 0.025, 'triangle'); // warm bulb hum
}

export function playLightOff() {
  const c = audio();
  if (!c) return;
  tone(c, 150, c.currentTime, 0.05, 0.07, 'square');
  tone(c, 1400, c.currentTime + 0.005, 0.03, 0.02);
}

/**
 * Winter night ambience: gusting wind (noise through slowly wandering
 * filters) with the odd faint tinkle of snowflakes. Returns a stop function.
 */
export function startWinterAmbience(): (() => void) | null {
  const c = audio();
  if (!c) return null;
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, c.currentTime);
  master.gain.linearRampToValueAtTime(1, c.currentTime + 2.5);
  master.connect(c.destination);

  const nodes: AudioScheduledSourceNode[] = [];
  const wind = (base: number, q: number, level: number, rate: number, depth: number) => {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = base;
    filter.Q.value = q;
    const gain = c.createGain();
    gain.gain.value = level;
    // Gusts: slow LFOs on the filter pitch and the volume.
    const lfo = c.createOscillator();
    lfo.frequency.value = rate;
    const lfoGain = c.createGain();
    lfoGain.gain.value = depth;
    lfo.connect(lfoGain).connect(filter.frequency);
    const lfo2 = c.createOscillator();
    lfo2.frequency.value = rate * 0.63;
    const lfo2Gain = c.createGain();
    lfo2Gain.gain.value = level * 0.7;
    lfo2.connect(lfo2Gain).connect(gain.gain);
    src.connect(filter).connect(gain).connect(master);
    [src, lfo, lfo2].forEach((n) => {
      n.start();
      nodes.push(n);
    });
  };
  wind(420, 0.6, 0.05, 0.11, 220);
  wind(950, 7, 0.012, 0.07, 380); // thin whistle

  const tinkle = window.setInterval(() => {
    if (Math.random() < 0.55) tone(c, 3200 + Math.random() * 3200, c.currentTime, 0.6, 0.006);
  }, 650);

  return () => {
    window.clearInterval(tinkle);
    const t = c.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(0.0001, t, 0.3);
    nodes.forEach((n) => n.stop(t + 1.5));
  };
}

/** Crinkly paper being torn open. */
export function playUnwrap() {
  const c = audio();
  if (!c) return;
  for (let i = 0; i < 7; i++) {
    noiseBurst(c, {
      at: Math.random() * 0.45,
      duration: 0.04 + Math.random() * 0.06,
      type: 'highpass',
      from: 3000 + Math.random() * 3000,
      to: 2500,
      volume: 0.07 + Math.random() * 0.08,
      attack: 0.003,
    });
  }
  // The big rip.
  noiseBurst(c, { at: 0.22, duration: 0.38, type: 'bandpass', from: 900, to: 3800, q: 1.4, volume: 0.22, attack: 0.03 });
}

/** Soft rustle of paper folding back around the box. */
export function playWrap() {
  const c = audio();
  if (!c) return;
  noiseBurst(c, { duration: 0.45, type: 'lowpass', from: 3000, to: 1100, q: 0.8, volume: 0.12, attack: 0.12 });
  for (let i = 0; i < 4; i++) {
    noiseBurst(c, { at: 0.1 + Math.random() * 0.3, duration: 0.05, type: 'highpass', from: 3500, to: 2800, volume: 0.04, attack: 0.003 });
  }
}
