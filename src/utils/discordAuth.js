const DISCORD_CLIENT_ID = process.env.REACT_APP_DISCORD_CLIENT_ID;
const DISCORD_REDIRECT_URI =
  process.env.REACT_APP_DISCORD_REDIRECT_URI ||
  (typeof window !== 'undefined' ? `${window.location.origin}/discord-callback` : '');

// Discord OAuth URL for linking an account, or null when linking isn't configured.
export function discordAuthUrl() {
  if (!DISCORD_CLIENT_ID) return null;
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
