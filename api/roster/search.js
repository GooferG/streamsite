import { adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from '../_lib/verifyAuth.js';

// Host searches opted-in viewers by name. Loads all discoverable profiles and
// fuzzy-matches in memory: case- and underscore-insensitive, matching the query
// as a prefix or a substring against any name the doc carries (display name and
// login handle). Twitch handles are [a-z0-9_], so normalizing to [a-z0-9]
// reconciles "TheOnlyWalker" with "the_only_walker"; substring matching lets
// "randy" find "TheNachoManRandyCabbage". The roster is small (hundreds), so a
// full read per debounced search is cheap and needs no name index.
//
// GET /api/roster/search?q=<text>   Authorization: Bearer <Firebase ID token>

const MAX_RESULTS = 10;

// Lowercase and drop everything that isn't a-z0-9 (underscores, stray display
// chars). Used identically on the query and on every candidate name.
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;

  const q = normalize(req.query.q);
  if (!q) return res.status(200).json({ results: [] });

  try {
    const snap = await adminDb
      .collection('users')
      .where('slotProfile.discoverable', '==', true)
      .get();

    const matches = snap.docs
      .map((d) => {
        const data = d.data();
        const defaultSlots = Array.isArray(data.slotProfile?.defaultSlots)
          ? data.slotProfile.defaultSlots.filter(Boolean)
          : [];
        const twitchName = data.displayName || data.twitchName || 'Viewer';

        // Match against every name form on the doc: display name, the lowercased
        // search key (often the login handle), and any raw twitchName.
        const candidates = [
          data.displayName,
          data.slotProfile?.twitchNameLower,
          data.twitchName,
        ]
          .map(normalize)
          .filter(Boolean);

        // Rank: 0 = prefix match (tightest), 1 = substring, null = no match.
        let rank = null;
        for (const c of candidates) {
          if (c.startsWith(q)) { rank = 0; break; }
          if (c.includes(q)) rank = rank === null ? 1 : rank;
        }

        return {
          twitchId: d.id,
          twitchName,
          defaultSlots,
          rainbetUsername: data.payoutProfile?.rainbetUsername || '',
          _rank: rank,
          _len: twitchName.length,
        };
      })
      // A discoverable profile with no slots has nothing to add — hide it.
      .filter((r) => r._rank !== null && r.defaultSlots.length > 0);

    // Prefix matches first, then substring; within a tier, shorter names rank
    // higher (a tighter match), then alphabetical for a stable order.
    matches.sort(
      (a, b) =>
        a._rank - b._rank ||
        a._len - b._len ||
        a.twitchName.localeCompare(b.twitchName)
    );

    const results = matches.slice(0, MAX_RESULTS).map(({ _rank, _len, ...r }) => r);
    return res.status(200).json({ results });
  } catch (err) {
    console.error('roster/search error', err);
    return res.status(500).json({ error: 'INTERNAL' });
  }
}
