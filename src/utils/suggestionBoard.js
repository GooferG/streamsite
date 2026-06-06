// src/utils/suggestionBoard.js
// Shared, pure helpers for the public suggestion board projection and the
// global first-caller-wins duplicate-game block. Used by the board endpoint,
// submit.js, roster/add.js, and the UI so all paths agree on one implementation.

// Internal slot status (open|in_bonus|passed|done) -> public (pending|skipped|in).
export function toPublicStatus(status) {
  if (status === 'done') return 'in';
  if (status === 'passed') return 'skipped';
  return 'pending'; // open, in_bonus, or anything unexpected
}

// Curated public projection: person name + [{name, status}], nothing else.
// Strips slot/person ids, source, submittedAt, and never serializes anything else.
export function projectBoard(suggestions) {
  if (!Array.isArray(suggestions)) return [];
  return suggestions.map((p) => ({
    person: String(p?.person ?? ''),
    slots: (Array.isArray(p?.slots) ? p.slots : []).map((s) => ({
      name: String(s?.name ?? ''),
      status: toPublicStatus(s?.status),
    })),
  }));
}

// Normalized key for matching slot names (case-insensitive, trimmed).
export function normalizeSlotName(name) {
  return String(name ?? '').trim().toLowerCase();
}

// Set of every slot name already claimed in the hunt (all people, all statuses).
// opts.excludePersonId omits one person entry's own slots so a returning
// submitter (same person id) doesn't collide against their own prior picks.
export function takenSlotSet(suggestions, opts = {}) {
  const { excludePersonId } = opts;
  const set = new Set();
  if (!Array.isArray(suggestions)) return set;
  for (const p of suggestions) {
    if (excludePersonId != null && p?.id === excludePersonId) continue;
    for (const s of Array.isArray(p?.slots) ? p.slots : []) {
      const key = normalizeSlotName(s?.name);
      if (key) set.add(key);
    }
  }
  return set;
}

// Partition incoming slot names into accepted vs dropped against the taken set,
// also dropping in-batch duplicates (keeps the first occurrence). Preserves the
// original (un-normalized) strings in the output so the UI can echo them.
export function dedupeAgainstTaken(names, taken) {
  const accepted = [];
  const dropped = [];
  const seen = new Set();
  for (const raw of Array.isArray(names) ? names : []) {
    const key = normalizeSlotName(raw);
    if (!key) continue;
    if (taken.has(key) || seen.has(key)) {
      dropped.push(raw);
    } else {
      seen.add(key);
      accepted.push(raw);
    }
  }
  return { accepted, dropped };
}
