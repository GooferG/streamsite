import { getBroadcasterAccessToken, helix } from './twitchBroadcasterToken.js';

// Derive chat roles from the badges array on a channel.chat.message event.
// Twitch sends e.g. [{ set_id: 'subscriber', id: '12', info: '14' },
// { set_id: 'vip', id: '1', info: '' }]. We only care about set_id presence.
export function rolesFromBadges(badges) {
  const sets = new Set((badges || []).map((b) => b?.set_id).filter(Boolean));
  return {
    isTwitchSub: sets.has('subscriber') || sets.has('founder'),
    isVip: sets.has('vip'),
    isMod: sets.has('moderator') || sets.has('broadcaster'),
  };
}

// Check whether a chatter follows the broadcaster. Cached per-invocation to
// avoid repeated Helix calls when multiple giveaways are open. Returns true
// if following, false if not, or null when the check could not be performed
// (missing config / Helix error) so callers can choose how to handle.
export async function isFollower(chatterId, cache) {
  if (cache.has(chatterId)) return cache.get(chatterId);
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  if (!broadcasterId) {
    cache.set(chatterId, null);
    return null;
  }
  try {
    const token = await getBroadcasterAccessToken();
    const r = await helix(
      'GET',
      `/channels/followers?broadcaster_id=${broadcasterId}&user_id=${chatterId}`,
      token
    );
    const following = Array.isArray(r?.data) && r.data.length > 0;
    cache.set(chatterId, following);
    return following;
  } catch (err) {
    console.warn('isFollower check failed', chatterId, err.message);
    cache.set(chatterId, null);
    return null;
  }
}
