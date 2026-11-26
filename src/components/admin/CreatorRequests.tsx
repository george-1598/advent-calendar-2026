import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNow } from '../../lib/useNow';
import { ago } from './PlayersTab';

interface Request {
  id: string;
  name: string;
  email: string;
  note: string | null;
  requested_at: string;
}

/** Admin: pending "let me make a calendar" requests, with Approve / Decline. */
export default function CreatorRequests({ onChanged }: { onChanged?: () => void }) {
  const now = useNow(60000);
  const [list, setList] = useState<Request[]>([]);
  const load = () => supabase.rpc('admin_creator_requests').then(({ data }) => Array.isArray(data) && setList(data as Request[]));
  useEffect(() => {
    void load();
  }, []);
  if (!list.length) return null;
  const decide = async (id: string, status: 'approved' | 'declined') => {
    await supabase.rpc('admin_set_creator', { p_user: id, p_status: status });
    await load();
    onChanged?.();
  };
  return (
    <div className="creator-requests">
      {list.map((r) => (
        <div key={r.id} className="creator-request">
          <span className="creator-request-icon">✋</span>
          <span className="creator-request-text">
            <strong>{r.name} wants to make a calendar</strong>
            <small>
              {r.email} · {ago(r.requested_at, now)}
            </small>
            {r.note && <q>{r.note}</q>}
          </span>
          <span className="creator-request-actions">
            <button className="creator-approve" onClick={() => decide(r.id, 'approved')}>
              Approve
            </button>
            <button className="admin-link" onClick={() => decide(r.id, 'declined')}>
              Decline
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
