import { useProgress } from '../../lib/progress';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import TextAnswer from './TextAnswer';

/** Guess what the emojis mean; every wrong guess adds an extra emoji clue. */
export default function Emoji({ day, content, solved }: GameProps) {
  const { byDay } = useProgress();
  const { busy, error, run } = useGameSubmit(day);
  const hints = content.emojiHints ?? [];
  const shown = solved ? hints.length : Math.min(hints.length, byDay[day]?.attempts ?? 0);
  return (
    <div className="game emoji">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <p className="emoji-big" aria-label="Emoji riddle">{content.emojis}</p>
      {hints.length > 0 && (
        <div className="emoji-hints">
          {hints.slice(0, shown).map((h, i) => (
            <span key={i} className="emoji-hint">{h}</span>
          ))}
          {shown < hints.length && !solved && <span className="emoji-more">+{hints.length - shown} more clue{hints.length - shown === 1 ? '' : 's'} after wrong guesses</span>}
        </div>
      )}
      {!solved && <TextAnswer busy={busy} placeholder="Your guess" onSubmit={async (a) => Boolean((await run(a))?.correct)} />}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
