import { getBroadcasterAccessToken, helix } from './twitchBroadcasterToken.js';

// Send a chat message in GooferG's channel as the broadcaster.
//
// Requires the broadcaster refresh token to include `user:write:chat`.
// Returns { ok: true, twitchId } on success. Throws on failure.
//
// Caller is responsible for catching errors and treating them as non-fatal
// (the giveaway lifecycle should not abort because chat post failed).

const MAX_LEN = 500; // Twitch chat hard limit per message

export async function sendChannelMessage(text) {
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  if (!broadcasterId) throw new Error('MISSING_TWITCH_BROADCASTER_ID');
  if (!text || !text.trim()) throw new Error('EMPTY_MESSAGE');

  const clipped = text.length > MAX_LEN ? text.slice(0, MAX_LEN - 1) + '…' : text;

  const accessToken = await getBroadcasterAccessToken();
  const res = await helix('POST', '/chat/messages', accessToken, {
    broadcaster_id: broadcasterId,
    sender_id: broadcasterId,
    message: clipped,
  });

  // Twitch returns data[0].is_sent and a drop_reason if filtered.
  const sent = res?.data?.[0];
  if (!sent?.is_sent) {
    const reason = sent?.drop_reason?.message || 'unknown';
    throw new Error(`CHAT_DROPPED:${reason}`);
  }
  return { ok: true, twitchMessageId: sent.message_id };
}
