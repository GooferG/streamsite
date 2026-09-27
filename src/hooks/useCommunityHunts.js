import { useEffect, useState } from 'react';

// Polls /api/communityhunts for GooferG's live + recent hunts. 60s cadence
// (the server caches 30s); skips polls while the tab is hidden and refreshes
// when it becomes visible. A failed poll keeps the last good data.
const POLL_MS = 60 * 1000;

export default function useCommunityHunts() {
  const [state, setState] = useState({ live: null, recent: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/api/communityhunts?view=overview');
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error((data && data.error) || `HTTP ${res.status}`);
        if (!cancelled) {
          setState({
            live: data.live || null,
            recent: Array.isArray(data.recent) ? data.recent : [],
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: err.message || 'Failed' }));
        }
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return state;
}
