import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../../lib/progress';
import { GAME_KINDS, type GameProps } from './types';
import Game from './Game';

/** Several games in a row; the server tracks which step the player is on. */
export default function Chain({ day, content, solved, code }: GameProps) {
  const { byDay } = useProgress();
  const steps = content.parts ?? [];
  const current = Math.min(byDay[day]?.chain_step ?? 0, Math.max(0, steps.length - 1));
  const [celebrate, setCelebrate] = useState(false);
  const prev = useRef(current);

  // A step was just solved: show a short "step complete" moment before the next game.
  useEffect(() => {
    if (current > prev.current) {
      setCelebrate(true);
      const t = window.setTimeout(() => setCelebrate(false), 1400);
      prev.current = current;
      return () => window.clearTimeout(t);
    }
    prev.current = current;
  }, [current]);

  const label = (k: string) => GAME_KINDS.find((g) => g.id === k)?.label.split(' (')[0] ?? k;

  return (
    <div className="game chain">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <ol className="chain-steps" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={i} className={solved || i < current ? 'is-done' : i === current ? 'is-current' : ''}>
            <span className="chain-num">{solved || i < current ? '✓' : i + 1}</span>
            <span className="chain-label">{i <= current || solved ? label(s.kind) : '???'}</span>
          </li>
        ))}
      </ol>
      {solved ? (
        <p className="chain-done">All {steps.length} steps complete! 🎉</p>
      ) : celebrate ? (
        <div className="chain-celebrate">
          <span>✨</span>
          <strong>Step {current} complete!</strong>
          <small>On to step {current + 1}…</small>
        </div>
      ) : (
        steps[current] && (
          <div className="chain-stage" key={current}>
            <span className="chain-kicker">Step {current + 1} of {steps.length}</span>
            <Game kind={steps[current].kind} day={day} content={steps[current].content ?? {}} solved={false} step={current} code={code} />
          </div>
        )
      )}
    </div>
  );
}
