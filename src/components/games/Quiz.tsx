import { useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';

export default function Quiz({ day, content, solved }: GameProps) {
  const questions = content.questions ?? [];
  const [chosen, setChosen] = useState<(number | null)[]>(() => questions.map(() => null));
  const [message, setMessage] = useState<string | null>(null);
  const { busy, error, run } = useGameSubmit(day);
  const complete = chosen.every((c) => c !== null);

  const check = async () => {
    const res = await run(chosen.join(','));
    if (res && !res.correct) setMessage(`${res.right} of ${res.total} right — change some answers and try again.`);
  };

  return (
    <div className="game quiz">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <ol className="quiz-list">
        {questions.map((q, qi) => (
          <li key={qi} className="quiz-q">
            <p className="quiz-text">{q.q}</p>
            <div className="quiz-options">
              {q.options.map((o, oi) => (
                <button
                  key={oi}
                  className={chosen[qi] === oi ? 'quiz-option is-chosen' : 'quiz-option'}
                  aria-pressed={chosen[qi] === oi}
                  disabled={solved}
                  onClick={() => {
                    setChosen((c) => c.map((v, i) => (i === qi ? oi : v)));
                    setMessage(null);
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {!solved && (
        <button className="game-primary" onClick={check} disabled={!complete || busy}>
          {busy ? 'Checking…' : complete ? 'Check my answers' : 'Answer every question'}
        </button>
      )}
      {message && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
