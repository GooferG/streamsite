import { useCallback, useEffect, useState } from 'react';
import { Trash2, Webhook } from 'lucide-react';
import { authedFetch } from '../../../utils/authedFetch';

export function useEventSubStatus() {
  const [status, setStatus] = useState('loading');
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await authedFetch('/api/admin/eventsub', { method: 'GET' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unknown');
        setStatus('error');
      } else {
        setSubs(data.ours || []);
        setStatus(data.ours?.some((s) => s.status === 'enabled') ? 'enabled' : 'missing');
        setError(null);
      }
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = async () => {
    setBusy(true);
    try {
      const res = await authedFetch('/api/admin/eventsub', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setError(data.detail || data.error || 'Failed');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this subscription? Chat-keyword entries will stop until re-subscribed.')) return;
    setBusy(true);
    try {
      await authedFetch(`/api/admin/eventsub?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return { status, subs, busy, error, subscribe, remove };
}

export function chatLabel(chat) {
  if (chat.status === 'loading') return 'Checking…';
  if (chat.status === 'enabled') return 'Connected to Twitch chat';
  if (chat.status === 'missing') return 'Not subscribed. Chat keywords will not register entries';
  if (chat.error === 'EVENTSUB_NOT_CONFIGURED') {
    return 'Chat not configured on the server (TWITCH_BROADCASTER_ID / TWITCH_EVENTSUB_SECRET)';
  }
  return `Error: ${chat.error || 'unknown'}`;
}

export default function EventSubStatus({ chat }) {
  const tone =
    chat.status === 'enabled'
      ? 'text-emerald-signal border-emerald-signal/40'
      : chat.status === 'missing' || chat.status === 'loading'
        ? 'text-orange-admin border-orange-admin/40'
        : 'text-red-destructive border-red-destructive/40';

  return (
    <div className={`border ${tone} bg-zinc-card/30`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <div className="inline-flex items-center gap-3 min-w-0">
          <Webhook size={14} aria-hidden="true" />
          <span className="text-[0.6875rem] font-bold tracking-eyebrow uppercase font-mono">{chatLabel(chat)}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {chat.status !== 'enabled' && chat.status !== 'loading' && (
            <button
              type="button"
              onClick={chat.subscribe}
              disabled={chat.busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
            >
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                {chat.busy ? 'Subscribing…' : 'Subscribe to chat'}
              </span>
            </button>
          )}
          {chat.subs.length > 0 && (
            <button
              type="button"
              onClick={() => chat.remove(chat.subs[0].id)}
              disabled={chat.busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/15 text-white/55 hover:text-red-destructive hover:border-red-destructive/40 transition-colors duration-150 disabled:opacity-50"
              title="Delete subscription"
            >
              <Trash2 size={12} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
