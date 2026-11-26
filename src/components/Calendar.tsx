import { Suspense, lazy } from 'react';
import type { View } from '../App';
import { reloadIfStale } from '../lib/staleReload';
import { useTheme } from '../lib/theme';
import { useCalendarController } from './calendar/controller';
import CountdownBanner from './CountdownBanner';
import CalendarSwitcher from './CalendarSwitcher';
import { HintBanner } from './DayNotes';
import { FinaleBanner } from './Finale';
import { WrappedBanner } from './Wrapped';
import { MemoriesBanner } from './Memories';
import InstallPrompt from './InstallPrompt';

// Each theme loads only when it's the one in use (smaller first download).
const ClassicCalendar = lazy(() => reloadIfStale(import('./themes/ClassicCalendar')));
const PresentsCalendar = lazy(() => reloadIfStale(import('./themes/PresentsCalendar')));
const CarouselCalendar = lazy(() => reloadIfStale(import('./themes/CarouselCalendar')));
const BooksCalendar = lazy(() => reloadIfStale(import('./themes/BooksCalendar')));
const ScratchCalendar = lazy(() => reloadIfStale(import('./themes/ScratchCalendar')));
const VillageCalendar = lazy(() => reloadIfStale(import('./themes/VillageCalendar')));
const OrnamentsCalendar = lazy(() => reloadIfStale(import('./themes/OrnamentsCalendar')));
const MailroomCalendar = lazy(() => reloadIfStale(import('./themes/MailroomCalendar')));
const CrackersCalendar = lazy(() => reloadIfStale(import('./themes/CrackersCalendar')));
const MusicBoxCalendar = lazy(() => reloadIfStale(import('./themes/MusicBoxCalendar')));

export default function Calendar({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const ctrl = useCalendarController();

  return (
    <>
      <CountdownBanner now={ctrl.now} />
      <CalendarSwitcher />
      <HintBanner />
      <FinaleBanner />
      <WrappedBanner />
      <MemoriesBanner />
      <InstallPrompt />
      <Suspense fallback={<div className="theme-loading" aria-label="Loading the calendar"><span>🎄</span></div>}>
        {theme === 'classic' && <ClassicCalendar ctrl={ctrl} onNavigate={onNavigate} />}
        {theme === 'presents' && <PresentsCalendar ctrl={ctrl} />}
        {theme === 'carousel' && <CarouselCalendar ctrl={ctrl} />}
        {theme === 'books' && <BooksCalendar ctrl={ctrl} />}
        {theme === 'scratch' && <ScratchCalendar ctrl={ctrl} />}
        {theme === 'village' && <VillageCalendar ctrl={ctrl} />}
        {theme === 'ornaments' && <OrnamentsCalendar ctrl={ctrl} />}
        {theme === 'mailroom' && <MailroomCalendar ctrl={ctrl} />}
        {theme === 'crackers' && <CrackersCalendar ctrl={ctrl} />}
        {theme === 'musicbox' && <MusicBoxCalendar ctrl={ctrl} />}
      </Suspense>
      {ctrl.overlays}
    </>
  );
}
