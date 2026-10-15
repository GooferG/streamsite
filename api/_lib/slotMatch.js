// Turns what chat typed after !slot into one catalogue slot. Pure, so it is
// unit tested; api/_lib/slotCommand.js builds the index once per warm
// instance from communityhunts' /slots catalogue.
import { SLOT_ALIASES } from './slotAliases.js';

const MAX_OPTIONS = 3;
const FUZZY_ACCEPT = 0.75;
const FUZZY_MARGIN = 0.08;
const FUZZY_OFFER = 0.5;

export function normalizeName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ');
}

const squash = (s) => s.replace(/ /g, '');

// Optimal string alignment distance: insert, delete, substitute, and swap two
// neighbouring letters, each costing 1.
export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j += 1) d[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function bigrams(s) {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i += 1) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}

function diceOf(aGrams, aLen, bGrams, bLen) {
  if (aLen < 2 || bLen < 2) return 0;
  let overlap = 0;
  for (const [g, n] of aGrams) overlap += Math.min(n, bGrams.get(g) || 0);
  return (2 * overlap) / (aLen - 1 + (bLen - 1));
}

// Sørensen–Dice similarity over letter pairs.
export function dice(a, b) {
  if (a === b) return 1;
  return diceOf(bigrams(a), a.length, bigrams(b), b.length);
}

export function toCatalogSlot(row) {
  if (!row || !row.name) return null;
  return {
    id: String(row.rainbetSlug || row.slug || row.name),
    name: String(row.name),
    thumb: row.thumb || null,
    bonusBuy: row.bonusBuy === true,
  };
}

export function buildSlotIndex(rows, aliases = SLOT_ALIASES) {
  const slots = [];
  const seen = new Set();
  for (const row of rows || []) {
    const slot = toCatalogSlot(row);
    if (!slot || seen.has(slot.id)) continue;
    seen.add(slot.id);
    const norm = normalizeName(slot.name);
    if (!norm) continue;
    const flat = squash(norm);
    slots.push({ ...slot, norm, flat, tokens: norm.split(' '), grams: bigrams(flat) });
  }
  const byNorm = new Map();
  const byFlat = new Map();
  for (const s of slots) {
    // Two rows that normalize alike: keep the one with a bonus buy.
    const keep = (map, key) => {
      const prev = map.get(key);
      if (!prev || (!prev.bonusBuy && s.bonusBuy)) map.set(key, s);
    };
    keep(byNorm, s.norm);
    keep(byFlat, s.flat);
  }
  const alias = new Map();
  for (const [nick, target] of Object.entries(aliases || {})) {
    const hit = byNorm.get(normalizeName(target));
    if (hit) alias.set(normalizeName(nick), hit);
  }
  return { slots, byNorm, byFlat, alias };
}

// A typed word matches a name word when equal, when it is a 4+ letter prefix,
// or within 1 edit (5+ letters) or 2 edits (8+ letters).
function tokenClose(q, t) {
  if (q === t) return true;
  if (q.length >= 4 && t.startsWith(q)) return true;
  const allow = q.length >= 8 ? 2 : q.length >= 5 ? 1 : 0;
  if (allow === 0 || Math.abs(q.length - t.length) > allow) return false;
  return editDistance(q, t) <= allow;
}

const publicSlot = ({ id, name, thumb, bonusBuy }) => ({ id, name, thumb, bonusBuy });

export function matchSlot(index, query) {
  const q = normalizeName(String(query || '').slice(0, 80));
  if (!q) return { kind: 'none' };
  const flat = squash(q);

  const exact = index.byNorm.get(q) || index.byFlat.get(flat);
  if (exact) return { kind: 'exact', slot: publicSlot(exact) };
  const nick = index.alias.get(q);
  if (nick) return { kind: 'alias', slot: publicSlot(nick) };

  const qTokens = q.split(' ');
  // Rank by how many typed words did not match a name word exactly, then by
  // extra name words, so "dead" prefers names containing the word Dead over a
  // one-word name that merely starts with it.
  const candidates = index.slots
    .filter((s) => qTokens.every((qt) => s.tokens.some((t) => tokenClose(qt, t))))
    .map((s) => ({
      s,
      inexact: qTokens.filter((qt) => !s.tokens.includes(qt)).length,
      extra: s.tokens.length - qTokens.length,
    }))
    .sort((a, b) => a.inexact - b.inexact || a.extra - b.extra || a.s.name.length - b.s.name.length || a.s.name.localeCompare(b.s.name));
  const better = (a, b) => a.inexact < b.inexact || (a.inexact === b.inexact && a.extra < b.extra);
  if (candidates.length === 1 || (candidates.length > 1 && better(candidates[0], candidates[1]))) {
    return { kind: 'guess', slot: publicSlot(candidates[0].s) };
  }
  // Did-you-mean lists only offer slots that can be entered.
  const offerable = candidates.filter((c) => c.s.bonusBuy);
  if (candidates.length > 1 && offerable.length) {
    return { kind: 'ambiguous', options: offerable.slice(0, MAX_OPTIONS).map((c) => publicSlot(c.s)) };
  }

  const qGrams = bigrams(flat);
  const scored = index.slots
    .map((s) => ({ s, score: diceOf(qGrams, flat.length, s.grams, s.flat.length) }))
    .filter((x) => x.score >= FUZZY_OFFER)
    .sort((a, b) => b.score - a.score);
  if (scored.length && scored[0].score >= FUZZY_ACCEPT && (scored.length === 1 || scored[0].score - scored[1].score >= FUZZY_MARGIN)) {
    return { kind: 'guess', slot: publicSlot(scored[0].s) };
  }
  const offered = scored.filter((x) => x.s.bonusBuy);
  if (offered.length) return { kind: 'ambiguous', options: offered.slice(0, MAX_OPTIONS).map((x) => publicSlot(x.s)) };
  return { kind: 'none' };
}
