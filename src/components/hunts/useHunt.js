import { useEffect, useState } from 'react';

// A communityhunts hunt with its bonuses. The live poll already carries them;
// any other hunt (a finished round's hunt, a past episode) is fetched once from
// /api/communityhunts?view=hunt and kept for the page session. Only finished
// hunts are cached, and only by a fetch that is still wanted: a mid-hunt copy
// cached at page load would outlive the hunt and freeze its totals.
const cache = new Map();

export function __resetHuntCacheForTests() {
  cache.clear();
}

export default function useHunt(huntId, summary) {
  const hasBonuses = !!(summary && Array.isArray(summary.bonuses));
  const [state, setState] = useState({ detail: null, error: null });

  useEffect(() => {
    if (!huntId || hasBonuses) return undefined;
    if (cache.has(huntId)) {
      setState({ detail: cache.get(huntId), error: null });
      return undefined;
    }
    setState({ detail: null, error: null });
    let cancelled = false;
    fetch(`/api/communityhunts?view=hunt&id=${encodeURIComponent(huntId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.hunt) throw new Error('Failed');
        if (cancelled) return;
        if (data.hunt.status !== 'live') cache.set(huntId, data.hunt);
        setState({ detail: data.hunt, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ detail: null, error: 'Could not load this hunt’s bonuses.' });
      });
    return () => {
      cancelled = true;
    };
  }, [huntId, hasBonuses]);

  if (!huntId) return { hunt: summary || null, loading: false, error: null };
  if (hasBonuses) return { hunt: summary, loading: false, error: null };
  const cached = cache.get(huntId) || null;
  const detail = state.detail && state.detail.id === huntId ? state.detail : cached;
  return { hunt: detail || summary || null, loading: !detail && !state.error, error: detail ? null : state.error };
}
