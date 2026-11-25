/** Small hand-drawn style decorations for the wrapped presents theme. */

const GREEN = '#2F8F5B';
const DARK_GREEN = '#25704A';
const BERRY = '#E8453C';

export function Wreath() {
  const leaves = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    const r = 12;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const t = a + Math.PI / 2 + (i % 2 ? 0.5 : -0.5);
    return (
      <line
        key={i}
        x1={x - Math.cos(t) * 3.4}
        y1={y - Math.sin(t) * 3.4}
        x2={x + Math.cos(t) * 3.4}
        y2={y + Math.sin(t) * 3.4}
        stroke={i % 3 ? GREEN : DARK_GREEN}
      />
    );
  });
  const berries = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    return <circle key={i} cx={Math.cos(a) * 12.5} cy={Math.sin(a) * 12.5} r="2.1" fill={BERRY} />;
  });
  return (
    <svg viewBox="-20 -20 40 40" aria-hidden="true">
      <g strokeWidth="2" strokeLinecap="round">{leaves}</g>
      {berries}
    </svg>
  );
}

export function CandyCane() {
  const d = 'M12 37 V13 a7 7 0 0 1 14 0 v3';
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <Sprig small />
      <path d={d} stroke="#FFFFFF" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d={d} stroke={BERRY} strokeWidth="5" fill="none" strokeDasharray="3.2 3.4" />
    </svg>
  );
}

export function Sprig({ small = false }: { small?: boolean }) {
  const needles = [];
  for (let t = 0.12; t < 0.95; t += 0.08) {
    const x = 6 + 28 * t;
    const y = 36 - 32 * t;
    const len = (small ? 4 : 6) * (1 - t * 0.5);
    needles.push(
      <path key={t} d={`M${x} ${y} l${-len} ${-len * 0.25} M${x} ${y} l${len * 0.3} ${len}`} />,
    );
  }
  return (
    <g>
      <g stroke={GREEN} strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d="M6 36 Q 20 22 34 4" stroke={DARK_GREEN} strokeWidth="1.8" />
        {needles}
      </g>
      {!small && (
        <g>
          <ellipse cx="9" cy="24" rx="3.4" ry="2.4" fill={BERRY} transform="rotate(-30 9 24)" />
          <ellipse cx="14" cy="30" rx="3.4" ry="2.4" fill={BERRY} transform="rotate(-10 14 30)" />
          <circle cx="6.4" cy="25.5" r="0.9" fill="#222" />
          <circle cx="11.2" cy="31" r="0.9" fill="#222" />
        </g>
      )}
    </g>
  );
}

export function SprigArt() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <Sprig />
    </svg>
  );
}

export function Bow({ color }: { color: string }) {
  return (
    <svg className="gift-bow" viewBox="-30 -30 60 60" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <path d="M0 0 C -9 -17, -27 -12, -15 -2 C -9 2, -4 1, 0 0" />
        <path d="M0 0 C 9 -17, 27 -12, 15 -2 C 9 2, 4 1, 0 0" />
        <path d="M0 0 C -3 10, -8 18, -15 25" />
        <path d="M0 0 C 5 9, 11 16, 19 21" />
        <rect x="-2.6" y="-2.6" width="5.2" height="5.2" rx="1.4" fill={color} />
      </g>
    </svg>
  );
}
