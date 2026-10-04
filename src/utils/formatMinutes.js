// "14h 5m" from a minute count (watch time).
export function formatMinutes(total) {
  const minutes = Math.max(0, Math.floor(Number(total) || 0));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
