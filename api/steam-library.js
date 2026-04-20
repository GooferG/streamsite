export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const STEAM_API_KEY = process.env.STEAM_API_KEY;
  const STEAM_ID = process.env.STEAM_ID;

  if (!STEAM_API_KEY || !STEAM_ID) {
    return res.status(500).json({ error: 'Missing Steam API credentials' });
  }

  try {
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1`
    );

    if (!response.ok) throw new Error(`Steam API error: ${response.status}`);

    const data = await response.json();
    const games = data.response?.games || [];

    const formattedGames = games
      .map(game => ({
        appid: game.appid,
        name: game.name,
        playtime_forever: Math.floor(game.playtime_forever / 60),
        img_logo_url: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      }))
      .sort((a, b) => b.playtime_forever - a.playtime_forever);

    res.status(200).json({ games: formattedGames });
  } catch (error) {
    console.error('Steam Library Error:', error);
    res.status(500).json({ error: 'Failed to fetch Steam library' });
  }
}
