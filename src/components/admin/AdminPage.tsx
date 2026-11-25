import { useAuth } from '../../lib/auth';
import { openAdmin, type AdminTab } from '../../lib/route';
import PlayersTab from './PlayersTab';
import QuestsTab from './QuestsTab';

export default function AdminPage({ tab }: { tab: AdminTab }) {
  const { profile } = useAuth();
  if (!profile?.is_admin) {
    return (
      <section className="admin-page">
        <p className="admin-muted">This page is only for the calendar’s organiser.</p>
      </section>
    );
  }
  return (
    <section className="admin-page">
      <h1 className="page-title">Admin</h1>
      <div className="admin-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'players'} onClick={() => openAdmin('players')}>
          Players
        </button>
        <button role="tab" aria-selected={tab === 'quests'} onClick={() => openAdmin('quests')}>
          Quests
        </button>
      </div>
      {tab === 'players' ? <PlayersTab /> : <QuestsTab />}
    </section>
  );
}
