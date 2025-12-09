// Serverless function for fetching Steam games
// Works with Vercel/Netlify
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const STEAM_API_KEY = process.env.STEAM_API_KEY;
  const STEAM_ID = process.env.STEAM_ID;

  if (!STEAM_API_KEY || !STEAM_ID) {
    return res.status(500).json({
      error: 'Missing Steam API credentials in environment variables'
    });
  }

  try {
    // Fetch recently played games from Steam
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&count=5`
    );

    if (!response.ok) {
      throw new Error(`Steam API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract and format game data
    const games = data.response?.games || [];
    const formattedGames = games.map(game => ({
      appid: game.appid,
      name: game.name,
      playtime_forever: Math.floor(game.playtime_forever / 60), // Convert minutes to hours
      playtime_2weeks: game.playtime_2weeks ? Math.floor(game.playtime_2weeks / 60) : 0,
      img_icon_url: `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`,
      img_logo_url: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`
    }));

    res.status(200).json({ games: formattedGames });
  } catch (error) {
    console.error('Steam API Error:', error);
    res.status(500).json({ error: 'Failed to fetch Steam games' });
  }
}
