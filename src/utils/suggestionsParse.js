import { makeId } from './huntCalc';
import rawSlots from '../data/slots';

// Lowercased catalog index for resolving loose sheet text → canonical slot name.
const CATALOG = rawSlots.map((g) => ({
  name: g.name,
  lower: g.name.toLowerCase(),
}));

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * Resolve a loose slot name from the sheet to a canonical catalog name.
 * Returns the catalog's exact casing when matched, else the trimmed input.
 * Match order: exact (case-insensitive) → catalog name is a substring of the
 * input or vice-versa (handles "le bandit" vs "Le Bandit", "sugar rush super
 * scat" vs "Sugar Rush"). Falls back to the raw text — the tracker accepts
 * manual slot names, so an unmatched suggestion is still usable.
 */
export function resolveSlotName(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const q = norm(trimmed);
  const exact = CATALOG.find((c) => c.lower === q);
  if (exact) return exact.name;
  // Prefer the longest catalog name contained in the query (most specific).
  let best = null;
  for (const c of CATALOG) {
    if (q.includes(c.lower) || c.lower.includes(q)) {
      if (!best || c.lower.length > best.lower.length) best = c;
    }
  }
  return best ? best.name : trimmed;
}

const HEADER_FIRST_CELL = /^name$/i;
const HEADER_SLOT_CELL = /^slot\s*\d*$/i;

/**
 * Parse a Google-Sheets clipboard paste (tab-separated rows) into a
 * suggestions list: [{ id, person, slots:[{ id, name, status }] }].
 *
 * Layout (from the sheet): col 0 = person name, cols 1+ = slot picks.
 *  - The header row (Name / Slot 1 / Slot 2 …) is detected and skipped.
 *  - A row whose name cell is blank but which has slot cells appends those
 *    slots to the previous person (covers a person's picks spilling across
 *    multiple sheet rows).
 *  - A row with a name but no slots is dropped (people who didn't suggest).
 *
 * Accepts tab- or comma-separated input; tabs win when present (Sheets paste).
 * Slot names are resolved against the catalog so casing/spacing is normalised.
 */
export function parseSuggestions(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');

  const splitCells = (line) => {
    const cells = line.includes('\t') ? line.split('\t') : line.split(',');
    return cells.map((c) => c.trim());
  };

  const people = [];
  let current = null;

  lines.forEach((line, idx) => {
    const cells = splitCells(line);
    const first = cells[0] || '';
    const slotCells = cells.slice(1).filter((c) => c !== '');

    // Skip a header row (only meaningful as the first content line).
    if (
      idx === 0 &&
      HEADER_FIRST_CELL.test(first) &&
      cells.slice(1).some((c) => HEADER_SLOT_CELL.test(c))
    ) {
      return;
    }

    const makeSlots = (names) =>
      names.map((n) => ({ id: makeId(), name: resolveSlotName(n), status: 'open' }));

    if (first === '') {
      // Continuation row — attach to the previous person if there is one.
      if (current && slotCells.length) {
        current.slots.push(...makeSlots(slotCells));
      }
      return;
    }

    // New named person. Drop them if they have no picks at all.
    if (!slotCells.length) {
      current = null;
      return;
    }
    current = { id: makeId(), person: first, slots: makeSlots(slotCells) };
    people.push(current);
  });

  return people;
}

/** Total slot count across a suggestions list (for preview summaries). */
export function countSlots(people) {
  return people.reduce((n, p) => n + p.slots.length, 0);
}
