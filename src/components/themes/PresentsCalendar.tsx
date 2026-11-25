import { useEffect, useRef, useState } from 'react';
import { TOTAL_DAYS } from '../../lib/time';
import type { CalendarController } from '../calendar/controller';
import Gift from './presents/Gift';
import { GIFT_DESIGNS } from './presents/designs';

const UNWRAP_MS = 950;
const DAYS = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1);

export default function PresentsCalendar({ ctrl }: { ctrl: CalendarController }) {
  const [unwrapping, setUnwrapping] = useState<number | null>(null);
  const modalWasOpened = useRef(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // When the day's modal closes, an unsolved gift wraps itself back up.
  useEffect(() => {
    if (ctrl.openDay === null && modalWasOpened.current) {
      modalWasOpened.current = false;
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
    timer.current = window.setTimeout(() => openModal(day), UNWRAP_MS);
  };

  return (
    <div className="presents-wrap">
      <p className="theme-lead presents-lead">Unwrap one present a day</p>
      <div className="presents">
        {DAYS.map((day) => (
          <Gift
            key={day}
            design={GIFT_DESIGNS[day]}
            state={ctrl.stateOf(day)}
            unwrapping={unwrapping === day}
            shaking={ctrl.shakingDay === day}
            onClick={() => onGift(day)}
          />
        ))}
      </div>
    </div>
  );
}
