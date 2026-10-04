import { TWITCH_CLIENT_ID, TWITCH_USERNAME } from '../constants';

// One app token per tab: App's 120s poll and /vods' useRecentClips share it,
// and it's refreshed at least hourly so a revoked token heals. A failure is
// never cached, so the next call tries again.
const TOKEN_MAX_MS = 60 * 60 * 1000;
const TOKEN_MARGIN_MS = 5 * 60 * 1000;
let tokenCache = null;
let userIdCache = null;

export function resetTwitchApiCache() {
  tokenCache = null;
  userIdCache = null;
}

export function getTwitchAccessToken() {
  if (tokenCache && (tokenCache.expiresAt === null || tokenCache.expiresAt > Date.now())) return tokenCache.promise;
  const entry = { promise: null, expiresAt: null };
  entry.promise = (async () => {
    const response = await fetch('/api/twitch-token', { method: 'POST' });
    if (!response.ok) throw new Error(`twitch-token ${response.status}`);
    const data = await response.json();
    if (!data || !data.access_token) throw new Error(`twitch-token ${response.status}`);
    const seconds = Number(data.expires_in);
    const life = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000 - TOKEN_MARGIN_MS, TOKEN_MAX_MS) : TOKEN_MAX_MS;
    entry.expiresAt = Date.now() + Math.max(life, 0);
    return data.access_token;
  })();
  // Until it settles, concurrent callers share the in-flight request.
  tokenCache = entry;
  entry.promise.catch(() => {
    if (tokenCache === entry) tokenCache = null;
  });
  return entry.promise;
}

// The channel's id never changes, so it's looked up once per tab.
export function getTwitchUserId(accessToken) {
  if (userIdCache) return userIdCache;
  const promise = (async () => {
    const response = await fetch(`https://api.twitch.tv/helix/users?login=${TWITCH_USERNAME}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    return data.data[0]?.id;
  })();
  userIdCache = promise;
  promise.catch(() => {
    if (userIdCache === promise) userIdCache = null;
  });
  return promise;
}

export async function getTwitchClips(accessToken, userId) {
  const response = await fetch(
    `https://api.twitch.tv/helix/clips?broadcaster_id=${userId}&first=20`,
    {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await response.json();
  return data.data || [];
}

// Clips made between two instants (ISO strings). Helix defaults ended_at to a
// week after started_at, so /vods always sends both.
export async function getTwitchClipsBetween(accessToken, userId, startedAt, endedAt, first = 50) {
  const params = new URLSearchParams({
    broadcaster_id: userId,
    first: String(first),
    started_at: startedAt,
    ended_at: endedAt,
  });
  const response = await fetch(`https://api.twitch.tv/helix/clips?${params}`, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error(`Helix clips ${response.status}`);
  const data = await response.json();
  return data.data || [];
}

export async function getTwitchVideos(accessToken, userId) {
  const response = await fetch(
    `https://api.twitch.tv/helix/videos?user_id=${userId}&first=100&type=archive`,
    {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await response.json();
  return data.data || [];
}

export async function getTwitchStreamInfo(accessToken, userId) {
  const response = await fetch(
    `https://api.twitch.tv/helix/streams?user_id=${userId}`,
    {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await response.json();
  const streamInfo = data.data[0] || null;

  // Format stream data to include viewer count in expected format
  if (streamInfo) {
    return {
      ...streamInfo,
      viewers: streamInfo.viewer_count, // Add viewers field from viewer_count
    };
  }

  return null;
}

export async function getTwitchChannelInfo(accessToken, userId) {
  const response = await fetch(
    `https://api.twitch.tv/helix/channels?broadcaster_id=${userId}`,
    {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await response.json();
  return data.data[0] || null;
}

export async function getTwitchFollowers(accessToken, userId) {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${userId}&first=1`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const data = await response.json();
    return data.total || 0;
  } catch (error) {
    console.error('Error fetching followers from Twitch API:', error);
    // Fallback to DecAPI
    try {
      const response = await fetch(
        `https://decapi.me/twitch/followcount/${TWITCH_USERNAME}`
      );
      const followers = await response.text();
      return followers !== 'A user with the name could not be found.'
        ? followers
        : '0';
    } catch (decApiError) {
      console.error('Error fetching followers from DecAPI:', error);
      return '0';
    }
  }
}

export async function getGameNames(accessToken, gameIds) {
  if (!gameIds || gameIds.length === 0) return {};

  try {
    const uniqueIds = [...new Set(gameIds.filter((id) => id))];

    if (uniqueIds.length === 0) return {};

    const idParams = uniqueIds.map((id) => `id=${id}`).join('&');

    const response = await fetch(
      `https://api.twitch.tv/helix/games?${idParams}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();

    const gameMap = {};
    if (data.data) {
      data.data.forEach((game) => {
        gameMap[game.id] = game.name;
      });
    }

    return gameMap;
  } catch (error) {
    console.error('Error fetching game names:', error);
    return {};
  }
}
