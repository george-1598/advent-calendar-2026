import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import TextAnswer from './TextAnswer';

export default function Riddle({ day, content, solved }: GameProps) {
  const { busy, error, run } = useGameSubmit(day);
  return (
    <div className="game">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      {!solved && <TextAnswer busy={busy} onSubmit={async (a) => Boolean((await run(a))?.correct)} />}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
