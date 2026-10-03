import { useEffect, useState } from 'react';
import { authedFetch } from '../utils/authedFetch';
import { DAILY_COOLDOWN_MS } from '../utils/earnRates';

export { clockLabel, shortLabel } from '../utils/countdown';

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// The daily ticket drop: cooldown from the user doc's lastDailyClaimAt, a
// ticking countdown, and the claim call. Shared by /store and /account.
export default function useDailyDrop(user) {
  const last = toMillis(user && user.lastDailyClaimAt);
  const [nextAt, setNextAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(null);
  const [awarded, setAwarded] = useState(null);

  useEffect(() => {
    const next = last ? last + DAILY_COOLDOWN_MS : null;
    setNextAt(next && next > Date.now() ? next : null);
  }, [last]);

  useEffect(() => {
    if (!nextAt) return undefined;
    setNow(Date.now());
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= nextAt) setNextAt(null);
    }, 1000);
    return () => clearInterval(t);
  }, [nextAt]);

  async function claim() {
    setClaiming(true);
    setError(null);
    try {
      const res = await authedFetch('/api/me/claim-daily', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'COOLDOWN' && data.nextAt) {
          setNextAt(data.nextAt);
          setError('Already claimed. Come back later.');
        } else {
          setError(data.error || 'Claim failed.');
        }
        return null;
      }
      setAwarded(data.awarded);
      return data.awarded;
    } catch (err) {
      setError('Network error.');
      return null;
    } finally {
      setClaiming(false);
    }
  }

  return {
    ready: !!user && !nextAt,
    nextAt,
    remainingMs: nextAt ? Math.max(0, nextAt - now) : 0,
    claim,
    claiming,
    error,
    awarded,
  };
}
