// Goofer Ball results: which hunt bonus row belongs to which drawn ball, and
// who won. Mirrored in src/utils/ballResults.js for the live rack; keep the
// two identical (src/__tests__/ballResults.test.js checks they agree).

export function normName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ');
}

function num(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonNegative(value) {
  const n = num(value);
  return n != null && n >= 0 ? n : null;
}

// Staff-typed results from the payout table, keyed by draw number.
export function sanitizeOverrides(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, raw] of Object.entries(input)) {
    const drawNo = Number(key);
    if (!Number.isInteger(drawNo) || drawNo < 1 || !raw || typeof raw !== 'object') continue;
    const bi = Number(raw.bonusIndex);
    const o = {
      multiplier: nonNegative(raw.multiplier),
      win: nonNegative(raw.win),
      bet: nonNegative(raw.bet),
      bonusIndex: raw.bonusIndex !== '' && raw.bonusIndex != null && Number.isInteger(bi) && bi >= 0 ? bi : null,
    };
    if (o.multiplier == null && o.bonusIndex == null) continue;
    out[drawNo] = o;
  }
  return out;
}

export function resultRows(round, bonuses = [], overrides = {}) {
  const rack = ((round && round.rack) || []).filter((e) => !e.scratched);
  const list = Array.isArray(bonuses) ? bonuses : [];
  const safe = sanitizeOverrides(overrides);
  return rack.map((e) => {
    const key = normName(e.slotName);
    const matches = key ? list.filter((b) => b && normName(b.slot) === key) : [];
    const o = safe[e.drawNo] || null;
    const picked = o && o.bonusIndex != null ? matches[o.bonusIndex] || null : matches[0] || null;
    const base = {
      drawNo: e.drawNo,
      twitchId: e.twitchId,
      twitchName: e.twitchName || null,
      displayName: e.displayName || null,
      slotId: e.slotId,
      slotName: e.slotName,
      thumb: e.thumb || null,
      matchCount: matches.length,
    };
    if (o && o.multiplier != null) {
      return { ...base, multiplier: o.multiplier, win: o.win ?? null, bet: o.bet ?? null, source: 'manual' };
    }
    const multiplier = picked ? num(picked.multiplier) : null;
    if (multiplier != null) {
      return { ...base, multiplier, win: num(picked.win), bet: num(picked.bet), source: 'hunt' };
    }
    return { ...base, multiplier: null, win: null, bet: null, source: null };
  });
}

export function rankRows(rows) {
  return (rows || [])
    .filter((r) => r.multiplier != null)
    .sort((a, b) => b.multiplier - a.multiplier || (b.win ?? -1) - (a.win ?? -1) || a.drawNo - b.drawNo);
}

export function winnerOf(rows) {
  return rankRows(rows)[0] || null;
}
