import { TOTAL_DAYS, nextUnlock } from '../lib/time';

const pad = (n: number) => String(n).padStart(2, '0');

export default function CountdownBanner({ now }: { now: number }) {
  const next = nextUnlock(now);

  if (!next) {
    return (
      <div className="countdown">
        <span className="countdown-label">All {TOTAL_DAYS} doors are open</span>
        <span className="countdown-done">Merry Christmas!</span>
      </div>
    );
  }

  const total = Math.max(0, Math.floor((next.at - now) / 1000));
  const units = [
    { value: Math.floor(total / 86_400), label: 'Days' },
    { value: Math.floor((total % 86_400) / 3600), label: 'Hours' },
    { value: Math.floor((total % 3600) / 60), label: 'Min' },
    { value: total % 60, label: 'Sec' },
  ];

  return (
    <div className="countdown" role="timer" aria-live="off">
      <span className="countdown-label">
        {next.day === 1 ? 'The first door opens in' : `Day ${next.day} opens in`}
      </span>
      <div className="countdown-units">
        {units.map((unit) => (
          <div key={unit.label} className="countdown-unit">
            <span className="countdown-value">{pad(unit.value)}</span>
            <span className="countdown-unit-label">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
