import { TOTAL_DAYS } from '../lib/time';
import { colorOfDay } from '../data/layout';
import { StarIcon } from './icons';

export default function BadgesView() {
  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1);

  return (
    <section className="page">
      <h1 className="page-title">My badges</h1>
      <p className="page-lead">0 of {TOTAL_DAYS} collected. Solve a day’s quest to earn its badge.</p>
      <ul className="badges">
        {days.map((day) => (
          <li key={day} className={`badge badge--${colorOfDay(day)} badge--empty`}>
            <StarIcon className="badge-star" />
            <span className="badge-day">{day}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
