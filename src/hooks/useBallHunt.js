import { useEffect, useState } from 'react';

const POLL_MS = 60 * 1000;
const IDLE = { hunt: null, stale: false, loading: false };

// The linked communityhunts hunt (its bonus rows feed the live rack). Polls
// the public, server-cached endpoint every 60s; a failed poll keeps the last
// hunt and flags it stale.
export default function useBallHunt(huntId, { enabled = true } = {}) {
  const [state, setState] = useState({ huntId: null, ...IDLE });
  useEffect(() => {
    if (!enabled || !huntId) return undefined;
    let cancelled = false;
    setState((s) => (s.huntId === huntId ? s : { huntId, hunt: null, stale: false, loading: true }));
    let seq = 0;
    const load = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const mine = ++seq;
      const current = () => !cancelled && mine === seq;
      try {
        const res = await fetch(`/api/communityhunts?view=hunt&id=${encodeURIComponent(huntId)}`);
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || !body.hunt) throw new Error((body && body.error) || `HTTP ${res.status}`);
        if (current()) setState({ huntId, hunt: body.hunt, stale: false, loading: false });
      } catch {
        if (current()) setState((s) => ({ ...s, huntId, stale: true, loading: false }));
      }
    };
    const onVisible = () => {
      if (!document.hidden) load();
    };
    load();
    const t = setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [huntId, enabled]);
  if (!enabled || !huntId) return IDLE;
  if (state.huntId !== huntId) return { hunt: null, stale: false, loading: true };
  return { hunt: state.hunt, stale: state.stale, loading: state.loading };
}
