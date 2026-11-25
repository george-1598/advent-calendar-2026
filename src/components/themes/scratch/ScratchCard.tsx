import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { rng } from '../../../lib/random';
import { playChime, startScratchSound } from '../../../lib/sound';
import { FOIL_SIZE, foilTexture } from './foil';

const REVEAL_AT = 0.55;

/** The printed card underneath the foil. */
export function CardFace({ day }: { day: number }) {
  return (
    <span className={`sc-face sc-face--${day % 3}`}>
      <span className="sc-face-holly">✦</span>
      <span className="sc-face-num">{day}</span>
      <span className="sc-face-label">December</span>
    </span>
  );
}

function Sparkles() {
  return (
    <span className="sc-sparkles" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="sc-sparkle"
          style={{
            ['--a' as string]: `${(i / 16) * 360 + (i % 3) * 7}deg`,
            ['--d' as string]: `${80 + (i % 4) * 28}px`,
            animationDelay: `${(i % 5) * 0.04}s`,
          }}
        >
          ✦
        </span>
      ))}
    </span>
  );
}

interface Props {
  day: number;
  onRevealed: () => void;
}

/** Big scratchable card. Scratch with finger or mouse; the foil clears past ~55%. */
export default function ScratchCard({ day, onRevealed }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cleared, setCleared] = useState(false);
  const stroke = useRef<{ x: number; y: number; moves: number; sound: ReturnType<typeof startScratchSound> } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const rect = wrapRef.current!.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const g = canvas.getContext('2d')!;
    const r = rng(day * 131);
    const crop = FOIL_SIZE * 0.6;
    g.drawImage(foilTexture(), r() * (FOIL_SIZE - crop), r() * (FOIL_SIZE - crop), crop, crop, 0, 0, canvas.width, canvas.height);
    // Engraved hint text.
    const fs = canvas.width * 0.075;
    g.font = `600 ${fs}px Jost, sans-serif`;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,246,210,0.55)';
    g.fillText('SCRATCH TO REVEAL', canvas.width / 2 - 1, canvas.height * 0.88 - 1);
    g.fillStyle = 'rgba(110,60,0,0.45)';
    g.fillText('SCRATCH TO REVEAL', canvas.width / 2, canvas.height * 0.88);
  }, [day]);

  const scratchTo = (x: number, y: number) => {
    const canvas = canvasRef.current!;
    const s = stroke.current!;
    const rect = canvas.getBoundingClientRect();
    const k = canvas.width / rect.width;
    const g = canvas.getContext('2d')!;
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = canvas.width * 0.11;
    g.beginPath();
    g.moveTo(s.x * k, s.y * k);
    g.lineTo(x * k, y * k);
    g.stroke();
    // Ragged edges, like real scratched foil.
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(
        x * k + (Math.random() - 0.5) * g.lineWidth * 0.8,
        y * k + (Math.random() - 0.5) * g.lineWidth * 0.8,
        g.lineWidth * (0.12 + Math.random() * 0.2),
        0,
        Math.PI * 2,
      );
      g.fill();
    }
    const dist = Math.hypot(x - s.x, y - s.y);
    s.sound?.move(dist);
    s.x = x;
    s.y = y;
    s.moves++;
    if (s.moves % 8 === 0) checkProgress();
  };

  const checkProgress = () => {
    if (cleared) return;
    const canvas = canvasRef.current!;
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 24) {
      total++;
      if (data[i] < 60) clear++;
    }
    if (clear / total >= REVEAL_AT) {
      setCleared(true);
      playChime();
      onRevealed();
    }
  };

  const local = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div ref={wrapRef} className={cleared ? 'sc-card is-cleared' : 'sc-card'}>
      <CardFace day={day} />
      <canvas
        ref={canvasRef}
        className="sc-foil"
        onPointerDown={(e) => {
          if (cleared) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = local(e);
          stroke.current = { ...p, moves: 0, sound: startScratchSound() };
          scratchTo(p.x + 0.1, p.y + 0.1);
        }}
        onPointerMove={(e) => {
          if (!stroke.current || cleared) return;
          const p = local(e);
          scratchTo(p.x, p.y);
        }}
        onPointerUp={() => {
          stroke.current?.sound?.stop();
          stroke.current = null;
          checkProgress();
        }}
        onPointerCancel={() => {
          stroke.current?.sound?.stop();
          stroke.current = null;
        }}
      />
      {cleared && <Sparkles />}
    </div>
  );
}
