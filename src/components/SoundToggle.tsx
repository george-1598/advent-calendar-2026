import { useState } from 'react';
import { setSoundEnabled, soundEnabled } from '../lib/sound';

export default function SoundToggle() {
  const [on, setOn] = useState(soundEnabled);
  return (
    <button
      className="sound-toggle"
      aria-pressed={on}
      aria-label={on ? 'Mute sounds' : 'Turn sounds on'}
      onClick={() => {
        setSoundEnabled(!on);
        setOn(!on);
      }}
    >
      {on ? '🔊' : '🔇'}
    </button>
  );
}
