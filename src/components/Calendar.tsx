import type { View } from '../App';
import { useTheme } from '../lib/theme';
import { useCalendarController } from './calendar/controller';
import CountdownBanner from './CountdownBanner';
import CalendarSwitcher from './CalendarSwitcher';
import ClassicCalendar from './themes/ClassicCalendar';
import PresentsCalendar from './themes/PresentsCalendar';
import CarouselCalendar from './themes/CarouselCalendar';
import BooksCalendar from './themes/BooksCalendar';
import ScratchCalendar from './themes/ScratchCalendar';
import VillageCalendar from './themes/VillageCalendar';
import OrnamentsCalendar from './themes/OrnamentsCalendar';
import MailroomCalendar from './themes/MailroomCalendar';
import CrackersCalendar from './themes/CrackersCalendar';
import MusicBoxCalendar from './themes/MusicBoxCalendar';

export default function Calendar({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const ctrl = useCalendarController();

  return (
    <>
      <CountdownBanner now={ctrl.now} />
      <CalendarSwitcher />
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
      {ctrl.overlays}
    </>
  );
}
