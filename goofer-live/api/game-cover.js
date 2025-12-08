// Vercel Serverless Function to fetch game covers from IGDB
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '6t0kocnv2iyqathfkgbn60tit8x12b';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '8hmx5yuuk3nrlt74q9wq4os5r9y198';

let cachedToken = null;
let tokenExpiry = null;

async function getIGDBAccessToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

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
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameName } = req.query;

  if (!gameName) {
    return res.status(400).json({ error: 'gameName is required' });
  }

  try {
    const token = await getIGDBAccessToken();

    // Search for the game
    const searchResponse = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: `search "${gameName}"; fields name,cover; limit 1;`,
    });

    if (!searchResponse.ok) {
      console.error('IGDB API error:', searchResponse.status);
      return res.status(searchResponse.status).json({ error: 'IGDB API error' });
    }

    const games = await searchResponse.json();

    if (!games || games.length === 0 || !games[0].cover) {
      return res.status(404).json({ error: 'Game cover not found' });
    }

    const coverId = games[0].cover;

    // Get the cover image URL
    const coverResponse = await fetch('https://api.igdb.com/v4/covers', {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: `fields url,image_id; where id = ${coverId};`,
    });

    if (!coverResponse.ok) {
      console.error('IGDB Cover API error:', coverResponse.status);
      return res.status(coverResponse.status).json({ error: 'IGDB Cover API error' });
    }

    const covers = await coverResponse.json();

    if (!covers || covers.length === 0) {
      return res.status(404).json({ error: 'Cover image not found' });
    }

    // Return high-res cover URL
    const imageUrl = covers[0].url || `https://images.igdb.com/igdb/image/upload/t_cover_big/${covers[0].image_id}.jpg`;
    const finalUrl = imageUrl.replace('t_thumb', 't_cover_big').replace('//', 'https://');

    return res.status(200).json({ coverUrl: finalUrl });
  } catch (error) {
    console.error('Error fetching game cover:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
