import { useState, type CSSProperties } from 'react';
import { playBookSlide } from '../../lib/sound';
import type { CalendarController } from '../calendar/controller';
import SoundToggle from '../SoundToggle';
import BookReader from './books/BookReader';
import { MotifArt } from './books/art';
import { SHELF, type BookSpec } from './books/data';
import { StarIcon } from '../icons';

export default function BooksCalendar({ ctrl }: { ctrl: CalendarController }) {
  const [reading, setReading] = useState<{ book: BookSpec; from: DOMRect } | null>(null);
  const [showNumbers, setShowNumbers] = useState(false);

  const openBook = (book: BookSpec, el: HTMLElement) => {
    playBookSlide();
    setReading({ book, from: el.getBoundingClientRect() });
  };

  const renderBook = (book: BookSpec) => {
    const solved = book.day ? ctrl.stateOf(book.day).solved : false;
    const style = {
      '--w': book.width,
      '--h': book.height,
      '--c': book.color,
      '--ink': book.ink,
      '--lean': `${book.lean}deg`,
      '--num-top': `${book.numberTop}%`,
      '--len': Math.max(3, book.title.length),
    } as CSSProperties;
    const classes = [
      'book',
      `book--${book.orientation}`,
      book.gilt && 'is-gilt',
      book.lean > 0 && 'leans-right',
      book.lean < 0 && 'leans-left',
      reading?.book.id === book.id && 'is-out',
      solved && 'is-solved',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        key={book.id}
        className={classes}
        style={style}
        aria-label={showNumbers && book.day ? `${book.title}, day ${book.day}` : `A book called ${book.title}`}
        onClick={(e) => openBook(book, e.currentTarget)}
      >
        {book.orientation === 'cover' ? (
          <span className="book-cover-face">
            <span className="book-cover-title">{book.title}</span>
            <span className="book-cover-art">
              <MotifArt motif={book.motif === 'none' ? 'bird' : book.motif} color={book.ink} />
            </span>
          </span>
        ) : (
          <>
            {book.bands.map((b, i) => (
              <span key={i} className="book-band" style={{ ['--at' as string]: `${b}%` }} />
            ))}
            <span className="book-title">{book.title}</span>
            {book.motif !== 'none' && book.orientation !== 'flat' && (
              <span className="book-motif">
                <MotifArt motif={book.motif} color={book.ink} />
              </span>
            )}
          </>
        )}
        {book.day && <span className={`book-num book-num--${book.numberSide}`}>{book.day}</span>}
        {solved && <StarIcon className="book-ribbon" />}
      </button>
    );
  };

  return (
    <div className="books-wrap">
      <div className="scratch-head">
        <p className="theme-lead books-lead">Somewhere on these shelves is today’s book</p>
        <SoundToggle />
      </div>
      <div className="bookcase">
        <div className={showNumbers ? 'shelves show-numbers' : 'shelves'}>
          {SHELF.map((item) => {
            if (item.kind === 'stack') {
              return (
                <div key={item.books[0].id} className="book-slot book-slot--stack">
                  {item.books.map(renderBook)}
                </div>
              );
            }
            const { book } = item;
            const lean = (book.lean * Math.PI) / 180;
            const slotStyle = {
              '--overlap': book.overlap,
              '--lean-space': Math.abs(Math.sin(lean) * book.height),
            } as CSSProperties;
            return (
              <div key={book.id} className={book.lean ? 'book-slot book-slot--lean' : 'book-slot'} style={slotStyle}>
                {renderBook(book)}
              </div>
            );
          })}
          {/* A few cosy things on the shelves */}
          <div className="book-slot book-slot--decor" aria-hidden="true">
            <span className="decor-candle">
              <span className="decor-flame" />
            </span>
          </div>
          <div className="book-slot book-slot--decor" aria-hidden="true">
            <span className="decor-globe" />
          </div>
          <div className="book-slot book-slot--decor" aria-hidden="true">
            <span className="decor-plant" />
          </div>
          <div className="book-slot book-slot--decor" aria-hidden="true">
            <span className="decor-mug" />
          </div>
          <div className="book-slot book-slot--end" aria-hidden="true">
            <span className="bookend" />
          </div>
        </div>
      </div>
      <button className="theme-help" onClick={() => setShowNumbers((v) => !v)} aria-pressed={showNumbers}>
        {showNumbers ? 'Hide the numbers again' : 'Show me the numbers on the books'}
      </button>

      {reading && (
        <BookReader
          book={reading.book}
          from={reading.from}
          state={reading.book.day ? ctrl.stateOf(reading.book.day) : null}
          now={ctrl.now}
          onQuest={() => {
            const day = reading.book.day!;
            const color = reading.book.color;
            setReading(null);
            ctrl.open(day, color);
          }}
          onClose={() => setReading(null)}
        />
      )}
    </div>
  );
}
