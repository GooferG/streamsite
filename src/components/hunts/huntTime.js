// Date helpers for the Hunts tab. Rounds carry Firestore Timestamps, hunts ISO
// strings, fixtures plain Dates; all of them go through toDate.

export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toMs(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  const d = toDate(value);
  return d ? d.getTime() : 0;
}

// "THU OCT 1 · 9:58 PM" / "9:58 PM". Newer ICU puts a narrow no-break space
// before PM; collapse it so the clock reads (and tests) the same everywhere.
export function formatClock(value) {
  const d = toDate(value);
  if (!d) return null;
  const day = d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '');
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s+/g, ' ');
  return { long: `${day} · ${time}`.toUpperCase(), short: time.toUpperCase() };
}

export function timeAgo(value, now = Date.now()) {
  const ms = toMs(value);
  if (!ms) return '';
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatEpisodeDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '—';
}

// The monitor's clock: live while a round or hunt is running, the settle time
// once settled, the hunt's end for an off-air replay.
export function screenClock(mode, { round, hunt, now, isLive } = {}) {
  if (mode === 'open' || mode === 'locked' || (mode === 'offair' && isLive)) return formatClock(now);
  if (mode === 'settled') return formatClock(round && round.settledAt);
  if (mode === 'offair') return formatClock(hunt && (hunt.endedAt || hunt.startedAt));
  return null;
}
