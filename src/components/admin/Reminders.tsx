import { useNow } from '../../lib/useNow';
import { formatCountdown } from '../../lib/time';

export interface DaySummary {
  day: number;
  unlock_at: string;
  title: string | null;
  overrides: unknown[];
}

const SOON = 36 * 60 * 60 * 1000;

/** Days that are open or open soon but have nothing in them yet. */
export default function Reminders({ quests, onFill }: { quests: DaySummary[] | null; onFill: (day: number) => void }) {
  const now = useNow(60000);
  if (!quests) return null;
  const empty = quests.filter((q) => !q.title && q.overrides.length === 0);
  const open = empty.filter((q) => new Date(q.unlock_at).getTime() <= now);
  const soon = empty.filter((q) => {
    const t = new Date(q.unlock_at).getTime();
    return t > now && t - now <= SOON;
  });
  if (!open.length && !soon.length) return null;
  return (
    <div className="reminders" role="status">
      {open.length > 0 && (
        <p>
          <span>🛠️</span>
          <span>
            <strong>{open.length === 1 ? `Day ${open[0].day} is open but empty` : `Days ${open.map((q) => q.day).join(', ')} are open but empty`}</strong>
            <small>Players see “work in progress” there.</small>
          </span>
          <button onClick={() => onFill(open[0].day)}>Fill in</button>
        </p>
      )}
      {soon.map((q) => (
        <p key={q.day}>
          <span>⏰</span>
          <span>
            <strong>Day {q.day} opens in {formatCountdown(new Date(q.unlock_at).getTime() - now)}</strong>
            <small>and isn’t filled in yet</small>
          </span>
          <button onClick={() => onFill(q.day)}>Fill in</button>
        </p>
      ))}
    </div>
  );
}
