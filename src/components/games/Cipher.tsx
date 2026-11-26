import { useRef, useState, type PointerEvent } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const decode = (text: string, k: number) =>
  text.replace(/[A-Z]/g, (c) => A[(A.indexOf(c) - k + 26 * 2) % 26]);

/** Spin the inner wheel until the secret message reads properly. */
export default function Cipher({ day, content, solved }: GameProps) {
  const cipher = (content.cipher ?? '').toUpperCase();
  const [k, setK] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const wheel = useRef<SVGSVGElement>(null);
  const drag = useRef<{ start: number; k0: number } | null>(null);
  const { busy, error, run } = useGameSubmit(day);
  const decoded = decode(cipher, k);

  const angle = (e: PointerEvent) => {
    const r = wheel.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const step = (d: number) => {
    setK((x) => (x + d + 26) % 26);
    setMessage(null);
  };

  const check = async () => {
    const res = await run(decoded);
    if (res && !res.correct) setMessage('That doesn’t read right yet — keep turning the wheel.');
  };

  return (
    <div className="game cipher">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <p className="cipher-text" aria-label="Encrypted message">{cipher}</p>
      <svg
        ref={wheel}
        className="cipher-wheel"
        viewBox="-110 -110 220 220"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { start: angle(e), k0: k };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const turned = angle(e) - drag.current.start;
          setK((((drag.current.k0 - Math.round(turned / (360 / 26))) % 26) + 26) % 26);
          setMessage(null);
        }}
        onPointerUp={() => (drag.current = null)}
        aria-label="Decoder wheel"
      >
        <circle r="106" fill="#7a231c" />
        <circle r="78" fill="#fbf3df" />
        {[...A].map((c, i) => {
          const a = ((i * 360) / 26 - 90) * (Math.PI / 180);
          return (
            <text key={`o${c}`} x={Math.cos(a) * 92} y={Math.sin(a) * 92 + 4} textAnchor="middle" className="cipher-outer">
              {c}
            </text>
          );
        })}
        <g style={{ transform: `rotate(${(-k * 360) / 26}deg)`, transition: drag.current ? 'none' : 'transform 0.25s' }}>
          {[...A].map((c, i) => {
            const a = ((i * 360) / 26 - 90) * (Math.PI / 180);
            return (
              <text key={`i${c}`} x={Math.cos(a) * 64} y={Math.sin(a) * 64 + 4} textAnchor="middle" className="cipher-inner">
                {c}
              </text>
            );
          })}
        </g>
        <circle r="44" fill="#7a231c" />
        <text y="5" textAnchor="middle" className="cipher-hub">↻</text>
        <path d="M0 -106 L-5 -116 L5 -116 Z" fill="#f2c14e" />
      </svg>
      <div className="game-row">
        <button className="game-secondary" onClick={() => step(-1)}>◀</button>
        <span className="cipher-k">Shift {k}</span>
        <button className="game-secondary" onClick={() => step(1)}>▶</button>
      </div>
      <p className="cipher-decoded" aria-live="polite">{decoded}</p>
      {!solved && (
        <button className="game-primary" onClick={check} disabled={busy}>
          {busy ? 'Checking…' : 'This message makes sense!'}
        </button>
      )}
      {message && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
