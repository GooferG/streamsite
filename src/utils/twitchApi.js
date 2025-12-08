import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_USERNAME } from '../constants';

export async function getTwitchAccessToken() {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await response.json();
  return data.access_token;
}

export async function getTwitchUserId(accessToken) {
  const response = await fetch(
    `https://api.twitch.tv/helix/users?login=${TWITCH_USERNAME}`,
    {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await response.json();
  return data.data[0]?.id;
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

export async function getTwitchVideos(accessToken, userId) {
  const response = await fetch(
    `https://api.twitch.tv/helix/videos?user_id=${userId}&first=20&type=archive`,
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
  return data.data[0] || null;
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
