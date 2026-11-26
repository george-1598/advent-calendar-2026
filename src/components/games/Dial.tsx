import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

const CX = 100;
const CY = 100;
const R = 92;
const clamp = (v: number) => Math.max(0, Math.min(100, v));
/** 0 = far left, 100 = far right, along the top of the semicircle. */
const point = (v: number, r = R) => {
  const t = Math.PI * (1 - clamp(v) / 100);
  return [CX + r * Math.cos(t), CY - r * Math.sin(t)] as const;
};
const wedge = (a: number, b: number) => {
  const [x1, y1] = point(clamp(a));
  const [x2, y2] = point(clamp(b));
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
};

export const BANDS = [
  { span: 3, color: '#F2B84B' },
  { span: 2, color: '#F0713E' },
  { span: 1, color: '#4A90C2' },
];

/** Wavelength dial: a semicircle with a needle; optionally the coloured target bands. */
export default function Dial({
  value,
  onChange,
  target,
  ghost,
  left,
  right,
  label = 'Dial',
}: {
  value: number;
  onChange?: (v: number) => void;
  /** Show the target bands: center (0–100) and tolerance. */
  target?: { center: number; tol: number } | null;
  /** A second, faded needle (e.g. the player's guess when showing the answer). */
  ghost?: number | null;
  left: string;
  right: string;
  label?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const fromPointer = (e: PointerEvent) => {
    const box = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 200 - CX;
    const y = CY - ((e.clientY - box.top) / box.height) * 110;
    const angle = Math.atan2(Math.max(y, 0), x); // 0 (right) … π (left)
    onChange?.(Math.round(clamp(100 - (angle / Math.PI) * 100) * 2) / 2);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!onChange) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(clamp(value - (e.shiftKey ? 5 : 1)));
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(clamp(value + (e.shiftKey ? 5 : 1)));
  };
  const [nx, ny] = point(value, R - 6);
  const [gx, gy] = ghost != null ? point(ghost, R - 6) : [0, 0];

  return (
    <div className="dial">
      <svg
        ref={ref}
        viewBox="0 0 200 110"
        className={onChange ? 'dial-svg is-live' : 'dial-svg'}
        role={onChange ? 'slider' : 'img'}
        aria-label={label}
        aria-valuemin={onChange ? 0 : undefined}
        aria-valuemax={onChange ? 100 : undefined}
        aria-valuenow={onChange ? Math.round(value) : undefined}
        tabIndex={onChange ? 0 : undefined}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (!onChange) return;
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`} fill="#F3EAD8" />
        {target && BANDS.map((b) => <path key={b.span} d={wedge(target.center - target.tol * b.span, target.center + target.tol * b.span)} fill={b.color} />)}
        {ghost != null && <line x1={CX} y1={CY} x2={gx} y2={gy} stroke="#7a231c" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#C8102E" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx={nx} cy={ny} r="3.4" fill="#C8102E" />
        <circle cx={CX} cy={CY} r="8" fill="#7a231c" />
        <circle cx={CX} cy={CY} r="3" fill="#F3EAD8" />
      </svg>
      <div className="dial-labels">
        <span>
          <i aria-hidden>⟵</i>
          {left || '…'}
        </span>
        <span>
          {right || '…'}
          <i aria-hidden>⟶</i>
        </span>
      </div>
    </div>
  );
}
