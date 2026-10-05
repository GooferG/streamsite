import { useEffect, useState } from 'react';

// Goofer's last-two-weeks Steam games (/api/steam-games, CDN-cached). null
// until it lands or when it fails.
export default function useSteamGames() {
  const [games, setGames] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/steam-games')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setGames(data && Array.isArray(data.games) ? data.games : null);
      })
      .catch(() => {
        if (!cancelled) setGames(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return games;
}
