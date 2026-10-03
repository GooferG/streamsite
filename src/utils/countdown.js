// Countdown labels for the daily drop. Pure, so presentational components can
// use them without pulling in the auth / Firebase chain behind useDailyDrop.
const pad = (n) => String(n).padStart(2, '0');

// "05:12:03"
export function clockLabel(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// "5h 12m" / "40m"
export function shortLabel(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}
