import type { View } from '../App';
import { useTheme } from '../lib/theme';
import { useCalendarController } from './calendar/controller';
import CountdownBanner from './CountdownBanner';
import ClassicCalendar from './themes/ClassicCalendar';
import PresentsCalendar from './themes/PresentsCalendar';
import CarouselCalendar from './themes/CarouselCalendar';

export default function Calendar({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const ctrl = useCalendarController();

  return (
    <>
      <CountdownBanner now={ctrl.now} />
      {theme === 'classic' && <ClassicCalendar ctrl={ctrl} onNavigate={onNavigate} />}
      {theme === 'presents' && <PresentsCalendar ctrl={ctrl} />}
      {theme === 'carousel' && <CarouselCalendar ctrl={ctrl} />}
      {ctrl.overlays}
    </>
  );
}
