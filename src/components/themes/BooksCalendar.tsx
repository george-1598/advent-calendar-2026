import { useState, type CSSProperties } from 'react';
import type { CalendarController } from '../calendar/controller';
import BookReader from './books/BookReader';
import { MotifArt } from './books/art';
import { BOOKS, type BookSpec } from './books/data';
import { StarIcon } from '../icons';

export default function BooksCalendar({ ctrl }: { ctrl: CalendarController }) {
  const [reading, setReading] = useState<{ book: BookSpec; from: DOMRect } | null>(null);

  const openBook = (book: BookSpec, el: HTMLElement) => {
    setReading({ book, from: el.getBoundingClientRect() });
  };

  return (
    <div className="books-wrap">
      <p className="theme-lead books-lead">Somewhere on these shelves is today’s book</p>
      <div className="bookcase">
        <div className="shelves">
          {BOOKS.map((book) => {
            const solved = book.day ? ctrl.stateOf(book.day).solved : false;
            const style = {
              '--w': book.width,
              '--h': book.height,
              '--c': book.color,
              '--ink': book.ink,
              '--lean': `${book.lean}deg`,
              '--overlap': book.overlap,
              '--num-top': `${book.numberTop}%`,
            } as CSSProperties;
            const out = reading?.book.id === book.id;
            return (
              <div key={book.id} className="book-slot" style={style}>
                <button
                  className={[
                    'book',
                    `book--${book.kind}`,
                    out && 'is-out',
                    solved && 'is-solved',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={book.day ? `A book (${book.title})` : `A book (${book.title})`}
                  onClick={(e) => openBook(book, e.currentTarget)}
                >
                  {book.kind === 'spine' ? (
                    <>
                      {book.bands.map((b, i) => (
                        <span key={i} className="book-band" style={{ top: `${b}%` }} />
                      ))}
                      <span className="book-title">{book.title}</span>
                      {book.motif !== 'none' && (
                        <span className="book-motif">
                          <MotifArt motif={book.motif} color={book.ink} />
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="book-cover-face">
                      <span className="book-cover-title">{book.title}</span>
                      <span className="book-cover-art">
                        <MotifArt motif={book.motif === 'none' ? 'bird' : book.motif} color={book.ink} />
                      </span>
                    </span>
                  )}
                  {book.day && (
                    <span className={`book-num book-num--${book.numberSide}`}>{book.day}</span>
                  )}
                  {solved && <StarIcon className="book-ribbon" />}
                </button>
              </div>
            );
          })}
          {/* A few cosy things on the shelves */}
          <div className="book-slot book-slot--decor" aria-hidden="true">
            <span className="decor-stack">
              <span style={{ width: 'calc(var(--u) * 52)', background: '#7C1F1D' }} />
              <span style={{ width: 'calc(var(--u) * 46)', background: '#22355A' }} />
              <span style={{ width: 'calc(var(--u) * 50)', background: '#2F5E3F' }} />
            </span>
          </div>
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
