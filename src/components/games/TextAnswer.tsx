import { useState, type FormEvent } from 'react';

/** A single text answer box (riddles, songs, treasure codes). */
export default function TextAnswer({
  onSubmit,
  busy,
  placeholder = 'Your answer',
  button = 'Unlock',
}: {
  onSubmit: (answer: string) => Promise<boolean>;
  busy: boolean;
  placeholder?: string;
  button?: string;
}) {
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setFeedback(null);
    const ok = await onSubmit(answer);
    if (!ok) {
      setWrong((n) => n + 1);
      setFeedback('Not quite. Try again!');
    }
  };

  return (
    <>
      <form className="day-answer" onSubmit={go}>
        <input
          key={wrong}
          className={wrong ? 'is-wrong' : undefined}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          autoCapitalize="off"
        />
        <button disabled={busy || !answer.trim()}>{busy ? '…' : button}</button>
      </form>
      {feedback && <p className="form-error">{feedback}</p>}
    </>
  );
}
