import { useState, type MouseEvent } from 'react';
import { supabase } from '../../lib/supabase';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import QuestImage from './QuestImage';

const LEVELS: Record<string, { label: string; temp: number }> = {
  cold: { label: '🥶 Freezing cold', temp: 0.08 },
  cool: { label: '❄️ Cold', temp: 0.25 },
  warm: { label: '🙂 Getting warmer', temp: 0.5 },
  hot: { label: '🔥 Hot!', temp: 0.75 },
  boiling: { label: '🌋 Boiling!!', temp: 0.92 },
  found: { label: '🎯 Found it!', temp: 1 },
};

/** Tap the photo to find the hidden spot; the server says how warm each tap is. */
export default function HotCold({ day, content, solved }: GameProps) {
  const [taps, setTaps] = useState<{ x: number; y: number; level: string }[]>([]);
  const [checking, setChecking] = useState(false);
  const { error, run } = useGameSubmit(day);
  const last = taps[taps.length - 1];

  const tap = async (e: MouseEvent<HTMLDivElement>) => {
    if (solved || checking) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setChecking(true);
    const { data, error: err } = await supabase.rpc('hot_cold_probe', { p_day: day, p_x: x, p_y: y });
    setChecking(false);
    if (err) return;
    const level = String(data);
    setTaps((t) => [...t.slice(-11), { x, y, level }]);
    if (level === 'found') void run(`${x.toFixed(4)},${y.toFixed(4)}`);
  };

  return (
    <div className="game hotcold">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <div className="hotcold-frame" onClick={tap} role="button" aria-label="Tap the picture to search">
        <QuestImage path={content.image} className="hotcold-img" />
        {taps.map((t, i) => (
          <span key={i} className={`hotcold-tap is-${t.level}`} style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, opacity: 0.35 + (0.65 * (i + 1)) / taps.length }} />
        ))}
      </div>
      <div className="hotcold-meter" aria-hidden="true">
        {/* covers the 'cold' end less and less as she gets warmer */}
        <span style={{ width: `${(1 - (solved ? 1 : LEVELS[last?.level]?.temp ?? 0)) * 100}%` }} />
      </div>
      <p className="hotcold-label" aria-live="polite">
        {solved ? '🎯 Found it!' : checking ? '…' : last ? LEVELS[last.level]?.label : 'Tap anywhere on the picture to start searching'}
      </p>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
