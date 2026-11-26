import { useEffect, useRef, useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import TextAnswer from './TextAnswer';
import { MORSE } from './morseCode';

/** A bulb blinks the message: dot = 1 unit, dash = 3, gaps 1 / 3 / 7 units. */
export default function Morse({ day, content, solved }: GameProps) {
  const code = content.morse ?? '';
  const [on, setOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [showCode, setShowCode] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const timers = useRef<number[]>([]);
  const { busy, error, run } = useGameSubmit(day);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const play = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const unit = 260 / speed;
    let t = 400;
    setPlaying(true);
    [...code].forEach((ch, i) => {
      if (ch === '.' || ch === '-') {
        const len = ch === '.' ? unit : unit * 3;
        timers.current.push(window.setTimeout(() => { setOn(true); setPos(i); }, t));
        timers.current.push(window.setTimeout(() => setOn(false), t + len));
        t += len + unit;
      } else if (ch === ' ') t += unit * 2;
      else if (ch === '/') t += unit * 2;
    });
    timers.current.push(window.setTimeout(() => { setPlaying(false); setPos(-1); }, t + 300));
  };

  return (
    <div className="game morse">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <div className="morse-stage">
        <span className={on ? 'morse-bulb is-on' : 'morse-bulb'} aria-hidden="true" />
        <span className="morse-wire" aria-hidden="true" />
      </div>
      <div className="game-row">
        <button className="game-primary" onClick={play} disabled={playing || !code}>
          {playing ? 'Blinking…' : '▶ Watch the lights'}
        </button>
        <label className="morse-speed">
          Speed
          <input type="range" min={0.5} max={2} step={0.25} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        </label>
      </div>
      <div className="game-row">
        <button className="game-secondary" onClick={() => setShowCode((v) => !v)}>
          {showCode ? 'Hide' : 'Show'} the dots & dashes
        </button>
        <button className="game-secondary" onClick={() => setShowChart((v) => !v)}>
          {showChart ? 'Hide' : 'Show'} Morse chart
        </button>
      </div>
      {showCode && (
        <p className="morse-code" aria-label="Morse code">
          {[...code].map((ch, i) => (
            <span key={i} className={i === pos ? 'is-on' : ''}>
              {ch === '.' ? '•' : ch === '-' ? '—' : ch === '/' ? ' / ' : ' '}
            </span>
          ))}
        </p>
      )}
      {showChart && (
        <div className="morse-chart">
          {Object.entries(MORSE).map(([k, v]) => (
            <span key={k}>
              <strong>{k.toUpperCase()}</strong> {v.replace(/\./g, '•').replace(/-/g, '—')}
            </span>
          ))}
        </div>
      )}
      {!solved && <TextAnswer busy={busy} placeholder="What do the lights say?" onSubmit={async (a) => Boolean((await run(a))?.correct)} />}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
