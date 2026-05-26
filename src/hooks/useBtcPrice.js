import { useEffect, useState } from 'react';

const POLL_MS = 60_000;

export function useBtcPrice() {
  const [state, setState] = useState({
    usd: null,
    change24h: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/btc');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setState({
          usd: typeof data.usd === 'number' ? data.usd : null,
          change24h: typeof data.change24h === 'number' ? data.change24h : null,
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error: e.message || 'fetch failed' }));
      }
    };

    fetchPrice();
    const id = setInterval(fetchPrice, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
