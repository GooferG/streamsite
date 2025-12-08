// Search for a game by name and get its cover image using Vercel serverless function
export async function getGameCover(gameName) {
  if (!gameName) return null;

  try {
    console.log('Fetching cover for:', gameName);

    // Call the Vercel serverless function
    const response = await fetch(`/api/game-cover?gameName=${encodeURIComponent(gameName)}`);

    if (!response.ok) {
      console.error(`API error for "${gameName}":`, response.status);
      return null;
    }

    const data = await response.json();
    console.log('Cover URL received:', data.coverUrl);

    return data.coverUrl;
  } catch (error) {
    console.error(`Error fetching game cover for "${gameName}":`, error);
    return null;
  }
}

// Fetch multiple game covers at once
export async function getGameCovers(gameNames) {
  const coverPromises = gameNames.map((name) => getGameCover(name));
  const covers = await Promise.all(coverPromises);

  // Return a map of game name to cover URL
  const coverMap = {};
  gameNames.forEach((name, index) => {
    if (covers[index]) {
      coverMap[name] = covers[index];
    }
  });

  return coverMap;
}
