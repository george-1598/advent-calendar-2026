import { useState } from 'react';
import { useProgress } from '../../lib/progress';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import TextAnswer from './TextAnswer';
import QuestImage from './QuestImage';

/** A photo starts zoomed in and blurred; each wrong guess (or a tap) zooms out a step. */
export default function ZoomReveal({ day, content, solved }: GameProps) {
  const { byDay } = useProgress();
  const steps = Math.max(2, Math.min(8, content.steps ?? 5));
  const [extra, setExtra] = useState(0);
  const { busy, error, run } = useGameSubmit(day);
  const used = solved ? steps - 1 : Math.min(steps - 1, (byDay[day]?.attempts ?? 0) + extra);
  const t = used / (steps - 1); // 0 = fully zoomed, 1 = whole photo
  const scale = Math.pow(8, 1 - t);
  const focus = content.focus ?? { x: 0.5, y: 0.5 };

  return (
    <div className="game zoom">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <div className="zoom-frame">
        <QuestImage
          path={content.image}
          className="zoom-img"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`,
            filter: `blur(${(1 - t) * 6}px)`,
          }}
        />
        <span className="zoom-level">{solved ? 'Fully revealed' : `Zoom ${used + 1} / ${steps}`}</span>
      </div>
      {!solved && (
        <>
          <button className="game-secondary" onClick={() => setExtra((n) => n + 1)} disabled={used >= steps - 1}>
            🔍 Zoom out a little
          </button>
          <TextAnswer busy={busy} placeholder="What (or where) is it?" onSubmit={async (a) => Boolean((await run(a))?.correct)} />
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
