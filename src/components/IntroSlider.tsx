import { useEffect, useRef, useState, type PointerEvent } from 'react';

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

/** Auto-advancing message slider; swipe (touch or mouse drag) either way, or tap a dot. */
export default function IntroSlider({ messages }: { messages: string[] }) {
  const count = messages.length;
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const start = useRef<{ x: number; id: number } | null>(null);

  // Restart the auto-advance timer whenever the user interacts.
  useEffect(() => {
    if (dragging) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [count, dragging, timerKey]);

  const goTo = (i: number) => {
    setIndex(((i % count) + count) % count);
    setTimerKey((k) => k + 1);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    start.current = { x: e.clientX, id: e.pointerId };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    if (Math.abs(dx) > 6 && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragX(dx);
  };

  const endDrag = (commit: boolean) => {
    if (commit && Math.abs(dragX) > SWIPE_THRESHOLD_PX) goTo(index + (dragX < 0 ? 1 : -1));
    start.current = null;
    setDragX(0);
    setDragging(false);
  };

  return (
    <div
      className={dragging ? 'slider is-dragging' : 'slider'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => endDrag(true)}
      onPointerCancel={() => endDrag(false)}
      aria-roledescription="carousel"
    >
      <div
        className="slider-track"
        style={{ transform: `translateX(calc(${-index * 100}% + ${dragX}px))` }}
      >
        {messages.map((message, i) => (
          <div
            key={i}
            className="slide"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
          >
            <p>{message}</p>
          </div>
        ))}
      </div>
      <div className="dots">
        {messages.map((_, i) => (
          <button
            key={i}
            className={i === index ? 'dot dot--on' : 'dot'}
            aria-label={`Show message ${i + 1}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
