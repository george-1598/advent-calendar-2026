import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import QRCode from 'qrcode';
import type { GameContent, GameKind } from '../games/types';
import { parseMelody } from '../games/melody';
import { useMelodyPlayer } from '../games/Song';
import { TILE_ATTRIBUTION, TILE_URL, pinIcon } from '../games/MapPin';
import QuestImage, { uploadQuestImage } from '../games/QuestImage';
import { GAME_KINDS, MEMORY_DONE } from '../games/types';
import { plain, toMorse } from '../games/morseCode';

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

const parseList = (a: string): string[] => {
  try {
    const v = JSON.parse(a);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

/** Tidy answers before saving (chains keep one JSON list per step). */
export function cleanAnswers(kind: GameKind, answers: string[]): string[] {
  if (kind === 'chain') return answers.map((a) => JSON.stringify(parseList(a).map((x) => x.trim()).filter(Boolean)));
  return answers.map((a) => a.trim()).filter(Boolean);
}

/** Returns an error message if the game isn't playable yet. */
export function validateGame(kind: GameKind, content: GameContent, answers: string[]): string | null {
  switch (kind) {
    case 'truths': {
      const rounds = content.rounds ?? [];
      if (!rounds.length) return 'Add at least one round.';
      if (rounds.some((r) => r.statements.length !== 3 || r.statements.some((x) => !x.trim()))) return 'Every round needs three statements.';
      return null;
    }
    case 'chain': {
      const parts = content.parts ?? [];
      if (parts.length < 2) return 'A chain needs at least two steps.';
      for (let i = 0; i < parts.length; i++) {
        const problem = validateGame(parts[i].kind, parts[i].content ?? {}, cleanAnswers(parts[i].kind, parseList(answers[i] ?? '[]')));
        if (problem) return `Step ${i + 1}: ${problem}`;
      }
      return null;
    }
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
    case 'morse':
      return content.morse ? null : 'Add the message to blink.';
    case 'zoom':
      if (!content.image) return 'Upload a photo.';
      return answers.length ? null : 'Add at least one accepted answer.';
    case 'memory':
      return (content.images ?? []).length >= 3 ? null : 'Upload at least 3 photos (each becomes a pair).';
    case 'emoji':
      if (!content.emojis?.trim()) return 'Add the emojis.';
      return answers.length ? null : 'Add at least one accepted answer.';
    case 'hangman':
      return plain(answers[0] ?? '').replace(/ /g, '').length >= 2 ? null : 'Add the word or phrase to guess.';
    case 'cipher':
      return content.cipher ? null : 'Add the secret message.';
    case 'hotcold':
      if (!content.image) return 'Upload a photo.';
      return answers[0] ? null : 'Tap the photo to hide the spot.';
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
    case 'morse':
      return (
        <>
          {prompt('Text (optional)', 'e.g. The Christmas lights are trying to tell you something…', 2)}
          <label>
            <span>Message the lights blink</span>
            <input
              value={answers[0] ?? ''}
              onChange={(e) => onChange({ ...content, morse: toMorse(e.target.value) || undefined }, [e.target.value])}
              placeholder="e.g. LOOK IN THE OVEN"
            />
            <small>Letters and numbers only. Keep it short — Morse is slow to read!</small>
          </label>
          {content.morse && <p className="admin-morse">{content.morse.replace(/\./g, '•').replace(/-/g, '—')}</p>}
        </>
      );
    case 'zoom':
      return (
        <>
          {prompt('Question', 'e.g. Where was this photo taken?', 2)}
          <ImagePicker day={day} value={content.image} preview={false} onChange={(image) => setContent({ image })} />
          {content.image && (
            <FocusPicker
              path={content.image}
              point={content.focus ?? { x: 0.5, y: 0.5 }}
              label="Tap where the zoom should start"
              onPick={(focus) => setContent({ focus })}
            />
          )}
          <label>
            <span>Zoom steps</span>
            <input type="number" min={2} max={8} value={content.steps ?? 5} onChange={(e) => setContent({ steps: Math.max(2, Math.min(8, Number(e.target.value) || 5)) })} />
            <small>Each wrong guess (or “zoom out” tap) reveals one step more.</small>
          </label>
          {answerList('Accepted answers', 'e.g. Paris\nEiffel Tower')}
        </>
      );
    case 'memory': {
      const images = content.images ?? [];
      return (
        <>
          {prompt('Text (optional)', 'e.g. Match our favourite moments', 2)}
          <div className="admin-memory">
            {images.map((path, i) => (
              <figure key={path}>
                <QuestImage path={path} className="admin-thumb" />
                <button type="button" className="admin-link admin-link--danger" onClick={() => onChange({ ...content, images: images.filter((_, k) => k !== i) }, [MEMORY_DONE])}>
                  Remove
                </button>
              </figure>
            ))}
          </div>
          {images.length < 8 && (
            <ImagePicker day={day} label={`Add a photo (${images.length}/8)`} onChange={(p) => p && onChange({ ...content, images: [...images, p] }, [MEMORY_DONE])} />
          )}
          <small>3–8 photos. Each becomes a pair; finding every pair solves the day.</small>
        </>
      );
    }
    case 'emoji':
      return (
        <>
          {prompt('Text (optional)', 'e.g. Which film is this?', 2)}
          <label>
            <span>Emojis</span>
            <input className="admin-emoji" value={content.emojis ?? ''} onChange={(e) => setContent({ emojis: e.target.value })} placeholder="🏠🎄👦🔫🪤" />
          </label>
          <label>
            <span>Extra emoji clues (one per line, revealed after each wrong guess)</span>
            <textarea rows={3} value={(content.emojiHints ?? []).join('\n')} onChange={(e) => setContent({ emojiHints: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} placeholder={'✈️👨‍👩‍👧\n😈😈'} />
          </label>
          {answerList('Accepted answers', 'Home Alone')}
        </>
      );
    case 'hangman':
      return (
        <>
          {prompt('Clue (optional)', 'e.g. Our favourite Christmas tradition', 2)}
          <label>
            <span>Word or phrase to guess</span>
            <input
              value={answers[0] ?? ''}
              onChange={(e) => onChange({ ...content, mask: plain(e.target.value).replace(/[a-z0-9]/g, '_') }, [e.target.value])}
              placeholder="e.g. HOT CHOCOLATE"
            />
            <small>She sees {content.mask ? content.mask.replace(/_/g, '▢') : 'one box per letter'}. 6 wrong letters melt the snowman.</small>
          </label>
        </>
      );
    case 'cipher': {
      const encode = (msg: string) => {
        const k = 3 + Math.floor(Math.random() * 20);
        const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return plain(msg).toUpperCase().replace(/[A-Z]/g, (c) => A[(A.indexOf(c) + k) % 26]);
      };
      return (
        <>
          {prompt('Text (optional)', 'e.g. A secret message from Santa’s elves…', 2)}
          <label>
            <span>Secret message</span>
            <textarea rows={2} value={answers[0] ?? ''} onChange={(e) => onChange({ ...content, cipher: e.target.value.trim() ? encode(e.target.value) : undefined }, [e.target.value])} placeholder="e.g. Your gift is in the blue box" />
          </label>
          <div className="admin-preview-row">
            <span>She sees:</span>
            <strong className="admin-letters">{content.cipher || '—'}</strong>
            <button type="button" className="admin-link" onClick={() => setContent({ cipher: encode(answers[0] ?? '') })} disabled={!answers[0]}>
              New shift
            </button>
          </div>
        </>
      );
    }
    case 'hotcold': {
      const [x, y, r] = (answers[0] ?? '').split(',').map(Number);
      const target = answers[0] ? { x, y } : null;
      const radius = Number.isFinite(r) && r > 0 ? r : 0.06;
      return (
        <>
          {prompt('Question', 'e.g. Where’s the hidden reindeer?', 2)}
          <ImagePicker day={day} value={content.image} preview={false} onChange={(image) => setContent({ image })} />
          {content.image && (
            <FocusPicker
              path={content.image}
              point={target}
              radius={radius}
              label="Tap the spot she has to find"
              onPick={(p) => onChange(content, [`${p.x.toFixed(4)},${p.y.toFixed(4)},${radius}`])}
            />
          )}
          {target && (
            <label>
              <span>How big the spot is</span>
              <input
                type="range"
                min={0.03}
                max={0.15}
                step={0.01}
                value={radius}
                onChange={(e) => onChange(content, [`${x},${y},${e.target.value}`])}
              />
            </label>
          )}
        </>
      );
    }
    case 'truths':
      return (
        <>
          {prompt('Intro (optional)', 'e.g. How well do you really know me? 😏', 2)}
          <TruthsFields content={content} answers={answers} onChange={onChange} />
        </>
      );
    case 'chain':
      return (
        <>
          {prompt('Intro (optional)', 'e.g. Three challenges stand between you and today’s gift…', 2)}
          <ChainFields day={day} content={content} answers={answers} onChange={onChange} />
        </>
      );
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

function ImagePicker({
  day,
  value,
  label,
  preview = true,
  onChange,
}: {
  day: number;
  value?: string;
  label?: string;
  /** Show the photo here (off when a picker below already shows it). */
  preview?: boolean;
  onChange: (path: string | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="admin-image">
      {preview && value && <QuestImage path={value} className="admin-photo" />}
      <label className="admin-upload">
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              onChange(await uploadQuestImage(day, file));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Upload failed');
            }
            setBusy(false);
          }}
        />
        <span>{busy ? 'Uploading…' : label ?? (value ? 'Replace photo' : 'Upload a photo')}</span>
      </label>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/** Tap on a photo to pick a point (0–1 coordinates). */
function FocusPicker({
  path,
  point,
  radius,
  label,
  onPick,
}: {
  path: string;
  point: { x: number; y: number } | null;
  radius?: number;
  label: string;
  onPick: (p: { x: number; y: number }) => void;
}) {
  return (
    <div className="admin-focus">
      <small>{label}</small>
      <div
        className="admin-focus-frame"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onPick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        }}
      >
        <QuestImage path={path} className="admin-photo" />
        {point && (
          <span
            className="admin-focus-dot"
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              width: radius ? `${radius * 200}%` : undefined,
              aspectRatio: '1',
            }}
          />
        )}
      </div>
    </div>
  );
}

function TruthsFields({ content, answers, onChange }: { content: GameContent; answers: string[]; onChange: Props['onChange'] }) {
  const rounds = content.rounds ?? [];
  const [lies, setLies] = useState<number[]>(() => {
    const saved = (answers[0] ?? '').split(',').map(Number);
    return rounds.map((_, i) => (Number.isInteger(saved[i]) ? saved[i] : 0));
  });
  const commit = (next: { statements: string[] }[], l: number[]) => onChange({ ...content, rounds: next }, [l.slice(0, next.length).join(',')]);
  const setStatement = (ri: number, si: number, v: string) =>
    commit(rounds.map((r, k) => (k === ri ? { statements: r.statements.map((x, j) => (j === si ? v : x)) } : r)), lies);

  return (
    <div className="admin-quiz">
      {rounds.map((r, ri) => (
        <fieldset key={ri} className="admin-quiz-q">
          <legend>Round {ri + 1}</legend>
          {r.statements.map((st, si) => (
            <div key={si} className="admin-quiz-opt">
              <input
                type="radio"
                name={`lie-${ri}`}
                checked={lies[ri] === si}
                onChange={() => {
                  const l = lies.map((x, k) => (k === ri ? si : x));
                  setLies(l);
                  commit(rounds, l);
                }}
                aria-label={`Statement ${si + 1} is the lie`}
              />
              <input value={st} onChange={(e) => setStatement(ri, si, e.target.value)} placeholder={si === 0 ? 'e.g. I once ate 12 pancakes in one go' : `Statement ${si + 1}`} />
            </div>
          ))}
          <button
            type="button"
            className="admin-link admin-link--danger"
            onClick={() => {
              const l = lies.filter((_, k) => k !== ri);
              setLies(l);
              commit(rounds.filter((_, k) => k !== ri), l);
            }}
          >
            Remove round
          </button>
        </fieldset>
      ))}
      <small>Mark the lie with the round button — and mix up where it sits from round to round.</small>
      <button
        type="button"
        className="admin-link"
        onClick={() => {
          const l = [...lies, 0];
          setLies(l);
          commit([...rounds, { statements: ['', '', ''] }], l);
        }}
      >
        + Add a round
      </button>
    </div>
  );
}

function ChainFields({ day, content, answers, onChange }: { day: number; content: GameContent; answers: string[]; onChange: Props['onChange'] }) {
  const parts = content.parts ?? [];
  const lists = parts.map((_, i) => parseList(answers[i] ?? '[]'));
  const commit = (nextParts: typeof parts, nextLists: string[][]) =>
    onChange({ ...content, parts: nextParts }, nextLists.map((l) => JSON.stringify(l)));
  const setPart = (i: number, part: (typeof parts)[number], list: string[]) =>
    commit(parts.map((p, k) => (k === i ? part : p)), lists.map((l, k) => (k === i ? list : l)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= parts.length) return;
    const np = [...parts];
    const nl = [...lists];
    [np[i], np[j]] = [np[j], np[i]];
    [nl[i], nl[j]] = [nl[j], nl[i]];
    commit(np, nl);
  };
  const kinds = GAME_KINDS.filter((k) => k.id !== 'chain');

  return (
    <div className="admin-chain-steps">
      {parts.map((part, i) => (
        <fieldset key={i} className="admin-chain-step">
          <legend>Step {i + 1}</legend>
          <div className="admin-row admin-row--step">
            <select value={part.kind} onChange={(e) => setPart(i, { kind: e.target.value as GameKind, content: {} }, [])}>
              {kinds.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <span className="admin-step-moves">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move step up">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === parts.length - 1} aria-label="Move step down">↓</button>
            </span>
          </div>
          <GameFields key={`${i}-${part.kind}`} day={day} kind={part.kind} content={part.content ?? {}} answers={lists[i]} onChange={(c, a) => setPart(i, { ...part, content: c }, a)} />
          <button type="button" className="admin-link admin-link--danger" onClick={() => commit(parts.filter((_, k) => k !== i), lists.filter((_, k) => k !== i))}>
            Remove step {i + 1}
          </button>
        </fieldset>
      ))}
      <button type="button" className="admin-link" onClick={() => commit([...parts, { kind: 'riddle', content: {} }], [...lists, []])}>
        + Add a step
      </button>
      <small>She solves the steps in order; the gift appears after the last one. Her progress is saved between visits.</small>
    </div>
  );
}
