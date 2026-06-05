// api/og/cardProps.js
// Pure mappers: data doc -> uniform CardMinimal prop shape. No Satori, no
// Firestore — unit-testable in isolation.

function fmtMoney(n) {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  return '$' + safe.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function liveCardProps(mirror) {
  const huntName = (mirror?.name || '').trim() || 'Bonus Hunt';
  const start = fmtMoney(mirror?.startBalance);
  const bonusCount = Array.isArray(mirror?.bonuses) ? mirror.bonuses.length : 0;
  return {
    variant: 'live',
    pill: { text: 'LIVE', tone: 'live' },
    kicker: 'BONUS HUNT · LIVE NOW',
    huntName,
    statA: { label: 'START', value: start },
    statB: { label: 'BONUSES SO FAR', value: String(bonusCount) },
    cta: 'goofer.tv/live →',
  };
}

export function suggestCardProps(intake, hunt) {
  const huntName = (intake?.huntName || '').trim() || 'Bonus Hunt';
  const suggestions = Array.isArray(hunt?.suggestions) ? hunt.suggestions : [];
  const totalPicks = suggestions.reduce(
    (n, p) => n + (Array.isArray(p?.slots) ? p.slots.length : 0),
    0
  );
  const peopleCount = suggestions.length;
  return {
    variant: 'suggest',
    pill: { text: 'OPEN', tone: 'open' },
    kicker: 'SUGGEST SLOTS · OPEN',
    huntName,
    statA: { label: 'PICKS IN', value: String(totalPicks) },
    statB: { label: 'CALLERS', value: String(peopleCount) },
    cta: 'goofer.tv · drop yours →',
  };
}
