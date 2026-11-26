import { useState } from 'react';
import { openTour } from './Tour';

interface Section {
  icon: string;
  title: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    icon: '🚪',
    title: 'The doors',
    body: [
      'From December 1 to 25, a new door opens every midnight (Bucharest time). Locked doors show a countdown.',
      'The days are shuffled every morning, so part of the fun is finding today’s door. Doors stay open: you can catch up on missed days anytime.',
      'A 🛠️ on an open door means it’s still being prepared. Check back later.',
    ],
  },
  {
    icon: '🧩',
    title: 'Solving',
    body: [
      'Each door holds a riddle, puzzle or mini-game: wordles, maps, photo hunts, codes, mysteries and more.',
      'Answers ignore capitals, accents and spaces. After 3, 6 and 9 wrong tries, hints unlock.',
      'Really stuck? After 10 wrong tries you can give up: you’ll see the answer and your gift, with a grey badge.',
    ],
  },
  {
    icon: '🎁',
    title: 'Your reward',
    body: [
      'Solving a day reveals that day’s little reward.',
      'You can send the creator a thank-you, and add a photo to remember the day. On December 25 your photos become “Our December”.',
    ],
  },
  {
    icon: '⭐',
    title: 'Badges',
    body: [
      'Every day you solve earns you a badge. Your collection is in “Badges”.',
      'Keep collecting… something special happens at the end of the calendar. ✨',
    ],
  },
  {
    icon: '🎨',
    title: 'Themes',
    body: [
      'Tap “Theme” to change how the calendar looks. Only the first theme is open at the start.',
      'Each theme hides a clue to a special day; find and open that day inside the theme to unlock the next one.',
    ],
  },
  {
    icon: '👭',
    title: 'Friends’ calendars',
    body: [
      'Friends can make you a calendar too. Open their invite link and it appears at the top of your calendar, next to this one.',
      'Want to make one yourself? Ask from the button at the bottom of the page. Once approved, you can make a calendar for up to 3 friends.',
    ],
  },
  {
    icon: '📲',
    title: 'On your phone',
    body: [
      'Add the calendar to your home screen to open it like an app: in Safari, tap Share → Add to Home Screen; in Chrome, use the Install button.',
      'Tap your name at the bottom of the page to change your display name or password.',
    ],
  },
];

export default function AboutView() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="page">
      <h1 className="page-title">How to play</h1>
      <div className="howto">
        {SECTIONS.map((s, i) => (
          <article key={s.title} className={open === i ? 'howto-item is-open' : 'howto-item'}>
            <button className="howto-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span className="howto-icon">{s.icon}</span>
              <span className="howto-title">{s.title}</span>
              <span className="howto-chev">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && (
              <div className="howto-body">
                {s.body.map((p, k) => (
                  <p key={k}>{p}</p>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      <button className="howto-tour" onClick={openTour}>
        ▶︎ Replay the intro tour
      </button>
    </section>
  );
}
