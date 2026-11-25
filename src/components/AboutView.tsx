const STEPS = [
  {
    title: 'A new door every day',
    text: 'From December 1st to 25th, a new door opens at midnight (Bucharest time).',
  },
  {
    title: 'Solve the quest',
    text: 'Behind each door is a riddle, puzzle or mini-game. Some take a minute, some take a little detective work.',
  },
  {
    title: 'Unlock the surprise',
    text: 'The right answer reveals where to find that day’s gift, and earns you a badge.',
  },
  {
    title: 'Collect them all',
    text: 'Every badge hides a clue. You’ll need all of them for the final quest.',
  },
];

export default function AboutView() {
  return (
    <section className="page">
      <h1 className="page-title">How it works</h1>
      <ol className="steps">
        {STEPS.map((step, i) => (
          <li key={step.title} className="step">
            <span className="step-num">{i + 1}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
