import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNow } from '../../lib/useNow';
import { ago, stamp } from './PlayersTab';

interface ClientError {
  id: number;
  kind: 'crash' | 'error' | 'promise' | 'network' | 'server';
  message: string;
  detail: string | null;
  url: string | null;
  user_agent: string | null;
  count: number;
  created_at: string;
  last_at: string;
  name: string | null;
}

const KIND: Record<ClientError['kind'], { label: string; icon: string }> = {
  crash: { label: 'Screen crashed', icon: '💥' },
  error: { label: 'Script error', icon: '⚠️' },
  promise: { label: 'Unhandled error', icon: '⚠️' },
  server: { label: 'Server error', icon: '🔥' },
  network: { label: 'Connection', icon: '📡' },
};

function device(ua: string | null): string {
  if (!ua) return 'unknown device';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'other';
  const br = /CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua) ? 'Chrome' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return `${os} · ${br}`;
}

/** Errors reported by players' devices (crashes, failed requests). */
export default function HealthTab({ onCount }: { onCount?: (n: number) => void }) {
  const now = useNow(30000);
  const [errors, setErrors] = useState<ClientError[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(() => {
    supabase.rpc('admin_errors').then(({ data, error }) => {
      if (error) return setFailed(error.message);
      setErrors(data as ClientError[]);
      onCount?.((data as ClientError[]).length);
    });
  }, [onCount]);
  useEffect(load, [load]);

  const clear = async () => {
    await supabase.rpc('admin_clear_errors');
    setConfirm(false);
    load();
  };

  if (failed) return <p className="form-error">{failed}</p>;
  if (!errors) return <p className="admin-muted">Loading…</p>;
  const lastDay = errors.filter((e) => now - new Date(e.last_at).getTime() < 86400000).length;

  return (
    <div className="admin-stack">
      <div className={errors.length ? 'admin-card health-summary' : 'admin-card health-summary is-ok'}>
        <span>{errors.length ? '🩺' : '✅'}</span>
        <span>
          <strong>{errors.length ? `${errors.length} problem${errors.length === 1 ? '' : 's'} reported` : 'All good'}</strong>
          <small>
            {errors.length ? `${lastDay} in the last 24 hours. Repeats are counted, not listed again.` : 'No errors reported from anyone’s device.'}
          </small>
        </span>
        <button className="admin-link" onClick={load}>
          Refresh
        </button>
      </div>
      {errors.map((e) => (
        <article key={e.id} className="admin-card health-item">
          <button className="health-head" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
            <span className="health-icon">{KIND[e.kind].icon}</span>
            <span className="health-text">
              <strong>{e.message}</strong>
              <small>
                {KIND[e.kind].label} · {e.name ?? 'signed out'} · {device(e.user_agent)} · {ago(e.last_at, now)}
              </small>
            </span>
            {e.count > 1 && <span className="health-count">×{e.count}</span>}
          </button>
          {open === e.id && (
            <div className="health-detail">
              <p>
                First seen {stamp(e.created_at)}, last {stamp(e.last_at)}
              </p>
              {e.url && <p className="health-url">{e.url}</p>}
              {e.detail && <pre>{e.detail}</pre>}
              {e.user_agent && <p className="health-url">{e.user_agent}</p>}
            </div>
          )}
        </article>
      ))}
      {errors.length > 0 &&
        (confirm ? (
          <div className="admin-actions">
            <button className="admin-save admin-save--danger" onClick={clear}>
              Yes, clear the log
            </button>
            <button className="admin-link" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="admin-link admin-link--danger" onClick={() => setConfirm(true)}>
            Clear all…
          </button>
        ))}
    </div>
  );
}
