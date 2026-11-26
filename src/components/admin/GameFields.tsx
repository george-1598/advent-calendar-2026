import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import QRCode from 'qrcode';
import type { GameContent, GameKind } from '../games/types';
import { parseMelody } from '../games/melody';
import { useMelodyPlayer } from '../games/Song';
import { TILE_ATTRIBUTION, TILE_URL, pinIcon } from '../games/MapPin';

interface Props {
  day: number;
  kind: GameKind;
  content: GameContent;
  answers: string[];
  onChange: (content: GameContent, answers: string[]) => void;
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const shuffled = <T,>(xs: T[], differentFrom?: string) => {
  for (let tries = 0; tries < 10; tries++) {
    const out = [...xs].sort(() => Math.random() - 0.5);
    if (!differentFrom || JSON.stringify(out) !== differentFrom || xs.length < 2) return out;
  }
  return [...xs].reverse();
};

/** Returns an error message if the game isn't playable yet. */
export function validateGame(kind: GameKind, content: GameContent, answers: string[]): string | null {
  switch (kind) {
    case 'wordle':
      return /^[A-Za-z]{2,10}$/.test(answers[0] ?? '') ? null : 'The secret word must be 2–10 letters (no spaces or accents).';
    case 'song':
      if (!content.melody && !content.audioUrl) return 'Add a melody or an audio link.';
      if (content.melody && parseMelody(content.melody).errors.length) return 'The melody has notes I can’t read.';
      return answers.length ? null : 'Add at least one accepted song name.';
    case 'map':
      return answers[0] ? null : 'Tap the map to set the spot.';
    case 'quiz': {
      const qs = content.questions ?? [];
      if (!qs.length) return 'Add at least one question.';
      if (qs.some((q) => !q.q.trim() || q.options.filter((o) => o.trim()).length < 2)) return 'Every question needs text and at least two options.';
      return null;
    }
    case 'timeline':
      return (content.items ?? []).length >= 2 ? null : 'Add at least two moments.';
    case 'anagram':
      return answers[0]?.trim() ? null : 'Add the answer to scramble.';
    default:
      return answers.length ? null : 'Add at least one accepted answer.';
  }
}

export default function GameFields({ day, kind, content, answers, onChange }: Props) {
  const setContent = (patch: Partial<GameContent>) => onChange({ ...content, ...patch }, answers);
  const prompt = (label: string, placeholder: string, rows = 3) => (
    <label>
      <span>{label}</span>
      <textarea rows={rows} value={content.prompt ?? ''} onChange={(e) => setContent({ prompt: e.target.value })} placeholder={placeholder} />
    </label>
  );
  const answerList = (label: string, placeholder: string) => (
    <label>
      <span>{label}</span>
      <textarea rows={3} value={answers.join('\n')} onChange={(e) => onChange(content, e.target.value.split('\n'))} placeholder={placeholder} />
      <small>One per line. Capitals, accents, spaces and punctuation are ignored.</small>
    </label>
  );

  switch (kind) {
    case 'wordle':
      return (
        <>
          {prompt('Text above the board (optional)', 'e.g. A word that describes our first trip', 2)}
          <label>
            <span>Secret word</span>
            <input
              value={answers[0] ?? ''}
              onChange={(e) => {
                const w = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 10);
                onChange({ ...content, length: w.length || 5 }, [w]);
              }}
              placeholder="MERRY"
            />
            <small>{(answers[0] ?? '').length || 0} letters · she gets 6 tries per board</small>
          </label>
        </>
      );
    case 'song':
      return <SongFields content={content} answers={answers} onChange={onChange} prompt={prompt} answerList={answerList} />;
    case 'map':
      return (
        <>
          {prompt('Question', 'e.g. Where did we have our first date?', 2)}
          <MapFields content={content} answers={answers} onChange={onChange} />
        </>
      );
    case 'quiz':
      return (
        <>
          {prompt('Intro (optional)', 'e.g. How well do you know us?', 2)}
          <QuizFields content={content} answers={answers} onChange={onChange} />
        </>
      );
    case 'timeline':
      return (
        <>
          {prompt('Intro (optional)', 'e.g. Put our adventures in order', 2)}
          <TimelineFields content={content} answers={answers} onChange={onChange} />
        </>
      );
    case 'anagram': {
      const answer = answers[0] ?? '';
      const scramble = (a: string) => shuffled([...a.replace(/\s+/g, '').toUpperCase()], JSON.stringify([...a.replace(/\s+/g, '').toUpperCase()])).join('');
      return (
        <>
          {prompt('Clue (optional)', 'e.g. Where we’re going in January ✈️', 2)}
          <label>
            <span>Answer</span>
            <input value={answer} onChange={(e) => onChange({ ...content, letters: scramble(e.target.value) }, [e.target.value])} placeholder="e.g. PARIS" />
          </label>
          <div className="admin-preview-row">
            <span>Letters she gets:</span>
            <strong className="admin-letters">{content.letters || '—'}</strong>
            <button type="button" className="admin-link" onClick={() => setContent({ letters: scramble(answer) })} disabled={!answer}>
              Reshuffle
            </button>
          </div>
        </>
      );
    }
    case 'treasure':
      return (
        <>
          {prompt('Clue', 'e.g. Where the cold things sleep, behind the milk… 🧊', 3)}
          {answerList('Secret code(s) hidden at the spot', 'e.g. NORTHPOLE')}
          <TreasureQR day={day} codes={answers.map((a) => a.trim()).filter(Boolean)} />
        </>
      );
    default:
      return (
        <>
          {prompt('Riddle / question', 'What the player sees', 4)}
          {answerList('Accepted answers', 'snowman\na snowman')}
        </>
      );
  }
}

function SongFields({
  content,
  answers,
  onChange,
  prompt,
  answerList,
}: {
  content: GameContent;
  answers: string[];
  onChange: Props['onChange'];
  prompt: (l: string, p: string, r?: number) => JSX.Element;
  answerList: (l: string, p: string) => JSX.Element;
}) {
  const { play, playing } = useMelodyPlayer();
  const errors = content.melody ? parseMelody(content.melody).errors : [];
  return (
    <>
      {prompt('Text (optional)', 'e.g. Which song is this? 🎶', 2)}
      <label>
        <span>Melody</span>
        <textarea
          rows={3}
          value={content.melody ?? ''}
          onChange={(e) => onChange({ ...content, melody: e.target.value }, answers)}
          placeholder="E E E:2 E E E:2 E G C:1.5 D:0.5 E:4"
        />
        <small>
          Notes A–G (add # or b, and an octave like E4 — default 5). “:2” = 2 beats, “-” = a rest.
          {errors.length > 0 && <strong className="admin-bad"> Can’t read: {errors.join(' ')}</strong>}
        </small>
      </label>
      <div className="admin-row">
        <label>
          <span>Speed (beats per minute)</span>
          <input type="number" min={40} max={240} value={content.tempo ?? 110} onChange={(e) => onChange({ ...content, tempo: Number(e.target.value) || 110 }, answers)} />
        </label>
        <button type="button" className="admin-test" onClick={() => play(content.melody ?? '', content.tempo)} disabled={!content.melody || playing >= 0}>
          {playing >= 0 ? '♪' : '▶ Test'}
        </button>
      </div>
      <label>
        <span>Or an audio link (optional)</span>
        <input value={content.audioUrl ?? ''} onChange={(e) => onChange({ ...content, audioUrl: e.target.value.trim() || undefined }, answers)} placeholder="https://…/clip.mp3" />
        <small>A direct link to an audio file (mp3/m4a). Spotify/YouTube pages won’t play here.</small>
      </label>
      {answerList('Accepted song names', 'Jingle Bells')}
    </>
  );
}

function MapFields({ content, answers, onChange }: { content: GameContent; answers: string[]; onChange: Props['onChange'] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const [lat, lng, r] = (answers[0] ?? '').split(',').map(Number);
  const hasTarget = Number.isFinite(lat) && Number.isFinite(lng) && answers[0];
  const radius = Number.isFinite(r) && r > 0 ? r : 300;
  const latest = useRef({ content, answers, radius });
  latest.current = { content, answers, radius };

  useEffect(() => {
    const m = L.map(el.current!).setView(hasTarget ? [lat, lng] : content.center ?? [48, 15], hasTarget ? 13 : content.zoom ?? 4);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      const { content: c, radius: rr } = latest.current;
      onChange(c, [`${e.latlng.lat.toFixed(6)},${e.latlng.lng.toFixed(6)},${rr}`]);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
      circle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !hasTarget) return;
    if (marker.current) marker.current.setLatLng([lat, lng]);
    else marker.current = L.marker([lat, lng], { icon: pinIcon }).addTo(m);
    if (circle.current) circle.current.setLatLng([lat, lng]).setRadius(radius);
    else circle.current = L.circle([lat, lng], { radius, color: '#c8102e', weight: 2, fillOpacity: 0.12 }).addTo(m);
  }, [lat, lng, radius, hasTarget]);

  return (
    <div className="admin-map">
      <div ref={el} className="map-box map-box--admin" />
      <small>Tap the map to set the right spot. The red circle is how close counts as correct.</small>
      <div className="admin-row">
        <label>
          <span>Counts as correct within (metres)</span>
          <input
            type="number"
            min={20}
            step={10}
            value={radius}
            disabled={!hasTarget}
            onChange={(e) => onChange(content, [`${lat},${lng},${Math.max(20, Number(e.target.value) || 300)}`])}
          />
        </label>
      </div>
      <div className="admin-preview-row">
        <span>
          Her starting view:{' '}
          <strong>{content.center ? `${content.center.map((x) => x.toFixed(2)).join(', ')} · zoom ${content.zoom}` : 'all of Europe'}</strong>
        </span>
        <button
          type="button"
          className="admin-link"
          onClick={() => {
            const m = map.current!;
            const c = m.getCenter();
            onChange({ ...content, center: [Number(c.lat.toFixed(4)), Number(c.lng.toFixed(4))], zoom: m.getZoom() }, answers);
          }}
        >
          Use the map’s current view
        </button>
      </div>
      <small>Tip: zoom out so the spot isn’t obvious before using the current view.</small>
    </div>
  );
}

function QuizFields({ content, answers, onChange }: { content: GameContent; answers: string[]; onChange: Props['onChange'] }) {
  const qs = content.questions ?? [];
  // The correct option per question is stored as the answer, e.g. "1,0,2".
  const [correct, setCorrect] = useState<number[]>(() => {
    const saved = (answers[0] ?? '').split(',').map(Number);
    return qs.map((_, i) => (Number.isInteger(saved[i]) ? saved[i] : 0));
  });
  const commit = (questions: { q: string; options: string[] }[], right: number[]) =>
    onChange({ ...content, questions }, [right.slice(0, questions.length).join(',')]);

  const update = (i: number, patch: Partial<{ q: string; options: string[] }>) => {
    const next = qs.map((q, k) => (k === i ? { ...q, ...patch } : q));
    commit(next, correct);
  };

  return (
    <div className="admin-quiz">
      {qs.map((q, i) => (
        <fieldset key={i} className="admin-quiz-q">
          <legend>Question {i + 1}</legend>
          <input value={q.q} onChange={(e) => update(i, { q: e.target.value })} placeholder="e.g. Where did we first meet?" />
          {q.options.map((o, oi) => (
            <div key={oi} className="admin-quiz-opt">
              <input
                type="radio"
                name={`correct-${i}`}
                checked={correct[i] === oi}
                onChange={() => {
                  const next = correct.map((c, k) => (k === i ? oi : c));
                  setCorrect(next);
                  commit(qs, next);
                }}
                aria-label={`Option ${oi + 1} is correct`}
              />
              <input value={o} onChange={(e) => update(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} placeholder={`Option ${oi + 1}`} />
            </div>
          ))}
          <div className="admin-actions">
            {q.options.length < 4 && (
              <button type="button" className="admin-link" onClick={() => update(i, { options: [...q.options, ''] })}>
                + option
              </button>
            )}
            <button
              type="button"
              className="admin-link admin-link--danger"
              onClick={() => {
                const nq = qs.filter((_, k) => k !== i);
                const nc = correct.filter((_, k) => k !== i);
                setCorrect(nc);
                commit(nq, nc);
              }}
            >
              Remove question
            </button>
          </div>
        </fieldset>
      ))}
      <small>Pick the correct option with the round button.</small>
      <button
        type="button"
        className="admin-link"
        onClick={() => {
          const nc = [...correct, 0];
          setCorrect(nc);
          commit([...qs, { q: '', options: ['', ''] }], nc);
        }}
      >
        + Add a question
      </button>
    </div>
  );
}

function TimelineFields({ content, answers, onChange }: { content: GameContent; answers: string[]; onChange: Props['onChange'] }) {
  // Show the moments in the correct order (rebuilt from the saved answer).
  const items = content.items ?? [];
  const order = (answers[0] ?? '').split(',').filter(Boolean);
  const inOrder = order.length ? order.map((id) => items.find((x) => x.id === id)?.text ?? '') : items.map((x) => x.text);
  const [text, setText] = useState(inOrder.join('\n'));

  const commit = (value: string) => {
    setText(value);
    const texts = lines(value);
    const withIds = texts.map((t, i) => ({ id: String.fromCharCode(97 + i), text: t }));
    const correct = withIds.map((x) => x.id);
    const shown = shuffled(withIds, JSON.stringify(withIds));
    onChange({ ...content, items: shown }, [correct.join(',')]);
  };

  return (
    <label>
      <span>Moments, in the correct order (one per line)</span>
      <textarea rows={6} value={text} onChange={(e) => commit(e.target.value)} placeholder={'Our first date at the café\nThe trip to the mountains\nMoving in together'} />
      <small>She’ll see them shuffled and put them back in this order.</small>
    </label>
  );
}

function TreasureQR({ day, codes }: { day: number; codes: string[] }) {
  const [qrs, setQrs] = useState<{ code: string; url: string; img: string }[]>([]);
  const key = codes.join('|');
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      codes.map(async (code) => {
        const url = `${window.location.origin}${import.meta.env.BASE_URL}#/day/${day}/${encodeURIComponent(code)}`;
        return { code, url, img: await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#2b2b2b', light: '#ffffff' } }) };
      }),
    ).then((r) => !cancelled && setQrs(r));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, day]);

  if (!qrs.length) return null;
  return (
    <div className="admin-qr">
      <span className="admin-qr-title">Print & hide — scanning it opens day {day} and solves it</span>
      {qrs.map((q) => (
        <figure key={q.code}>
          <img src={q.img} alt={`QR code for ${q.code}`} />
          <figcaption>
            <strong>{q.code}</strong>
            <a href={q.img} download={`day-${day}-${q.code}.png`}>
              Download
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
