import { useEffect, useRef, useState } from 'react';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';
import TextAnswer from './TextAnswer';

export default function Treasure({ day, content, solved, code }: GameProps) {
  const { busy, error, run } = useGameSubmit(day);
  const [scan, setScan] = useState<'idle' | 'checking' | 'wrong'>('idle');
  const tried = useRef(false);

  // Arrived by scanning a hidden QR code: try that code straight away.
  useEffect(() => {
    if (!code || solved || tried.current) return;
    tried.current = true;
    setScan('checking');
    void run(code).then((res) => setScan(res?.correct ? 'idle' : 'wrong'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, solved]);

  return (
    <div className="game treasure">
      <div className="treasure-clue">
        <span className="treasure-icon">🗺️</span>
        {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      </div>
      {scan === 'checking' && <p className="game-help">Checking the code you scanned…</p>}
      {scan === 'wrong' && <p className="form-error">That QR code isn’t the right one for today. Keep hunting!</p>}
      {!solved && (
        <>
          <p className="game-help">Found it? Type the code written there — or scan its QR code with your camera.</p>
          <TextAnswer busy={busy} placeholder="Secret code" button="Check" onSubmit={async (a) => Boolean((await run(a))?.correct)} />
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
