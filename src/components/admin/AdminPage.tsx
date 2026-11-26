import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { MAIN_CALENDAR } from '../../lib/calendars';
import { openAdmin, type AdminTab } from '../../lib/route';
import PlayersTab from './PlayersTab';
import QuestsTab from './QuestsTab';
import ActivityFeed, { type Activity } from './ActivityFeed';
import Reminders, { type DaySummary } from './Reminders';

export default function AdminPage({ tab }: { tab: AdminTab }) {
  const { profile } = useAuth();
  const isAdmin = Boolean(profile?.is_admin);
  const [days, setDays] = useState<DaySummary[] | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [focusDay, setFocusDay] = useState<{ day: number; at: number } | null>(null);

  const loadDays = useCallback(() => {
    supabase.rpc('admin_quests', { p_calendar: MAIN_CALENDAR }).then(({ data }) => data && setDays(data as DaySummary[]));
  }, []);
  const loadActivity = useCallback(() => {
    supabase.rpc('calendar_activity', { p_calendar: MAIN_CALENDAR }).then(({ data }) => data && setActivity(data as Activity));
  }, []);
  useEffect(() => {
    if (!isAdmin) return;
    loadDays();
    loadActivity();
  }, [isAdmin, loadDays, loadActivity]);

  if (!isAdmin) {
    return (
      <section className="admin-page">
        <p className="admin-muted">This page is only for the calendar’s organiser.</p>
      </section>
    );
  }
  const badge = (activity?.stuck.length ?? 0) + (activity?.events.filter((e) => e.unread).length ?? 0);
  const fill = (day: number) => {
    setFocusDay({ day, at: Date.now() });
    openAdmin('quests');
  };

  return (
    <section className="admin-page">
      <h1 className="page-title">Admin</h1>
      <Reminders quests={days} onFill={fill} />
      <div className="admin-tabs admin-tabs--3" role="tablist">
        <button role="tab" aria-selected={tab === 'players'} onClick={() => openAdmin('players')}>
          Players
        </button>
        <button role="tab" aria-selected={tab === 'activity'} onClick={() => openAdmin('activity')}>
          Activity{badge > 0 && <span className="tab-badge">{badge}</span>}
        </button>
        <button role="tab" aria-selected={tab === 'quests'} onClick={() => openAdmin('quests')}>
          Quests
        </button>
      </div>
      {tab === 'players' && <PlayersTab />}
      {tab === 'activity' && <ActivityFeed calendarId={MAIN_CALENDAR} activity={activity} onChanged={loadActivity} />}
      {tab === 'quests' && <QuestsTab focusDay={focusDay} onChanged={loadDays} />}
    </section>
  );
}
