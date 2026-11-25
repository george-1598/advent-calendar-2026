import { useEffect, useRef, useState } from 'react';
import { playUnwrap, playWrap } from '../../lib/sound';
import type { CalendarController } from '../calendar/controller';
import SoundToggle from '../SoundToggle';
import Gift from './presents/Gift';
import { GIFT_DESIGNS, GIFT_ORDER } from './presents/designs';

const UNWRAP_MS = 950;

export default function PresentsCalendar({ ctrl }: { ctrl: CalendarController }) {
  const [unwrapping, setUnwrapping] = useState<number | null>(null);
  const modalWasOpened = useRef(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // When the day's modal closes, an unsolved gift wraps itself back up.
  useEffect(() => {
    if (ctrl.openDay === null && modalWasOpened.current) {
      modalWasOpened.current = false;
      // An unsolved gift wraps itself back up.
      if (unwrapping !== null && !ctrl.stateOf(unwrapping).solved) playWrap();
      setUnwrapping(null);
    }
  }, [ctrl.openDay]);

  const openModal = (day: number) => {
    modalWasOpened.current = true;
    ctrl.open(day, GIFT_DESIGNS[day].paper.bg);
  };

  const onGift = (day: number) => {
    const state = ctrl.stateOf(day);
    if (!state.canOpen) return ctrl.rejectLocked(day);
    if (unwrapping !== null) return;
    if (state.solved) return openModal(day);
    setUnwrapping(day);
    playUnwrap();
    timer.current = window.setTimeout(() => openModal(day), UNWRAP_MS);
  };

  return (
    <div className="presents-wrap">
      <div className="scratch-head">
        <p className="theme-lead presents-lead">Unwrap one present a day</p>
        <SoundToggle />
      </div>
      <div className="presents">
        {GIFT_ORDER.map((day, i) => (
          <Gift
            key={day}
            design={GIFT_DESIGNS[day]}
            state={ctrl.stateOf(day)}
            unwrapping={unwrapping === day}
            shaking={ctrl.shakingDay === day}
            grand={i === GIFT_ORDER.length - 1}
            onClick={() => onGift(day)}
          />
        ))}
      </div>
    </div>
  );
}
