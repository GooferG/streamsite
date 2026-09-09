import {
  getBotAccessToken,
  getBroadcasterAccessToken,
  helix,
} from './twitchBroadcasterToken.js';

// Send a chat message in GooferG's channel.
//
// Sent by the BOT account when TWITCH_BOT_ID + TWITCH_BOT_REFRESH_TOKEN are
// set, otherwise by the broadcaster. The bot is preferred because a giveaway
// announcement contains the keyword: posted by the broadcaster it is a chat
// message from the broadcaster containing the keyword, which is exactly what
// an entry looks like. (EventSub also refuses to enter the broadcaster or the
// bot, so a misconfigured sender cannot join a giveaway either way.)
//
// Bot token needs `user:write:chat` and `user:bot`; the broadcaster token
// already carries `channel:bot`, which lets the bot post without being a mod.
// Broadcaster token needs `user:write:chat`.
//
// Returns { ok: true, twitchMessageId, sentAs } on success. Throws on failure.
//
// Caller is responsible for catching errors and treating them as non-fatal
// (the giveaway lifecycle should not abort because chat post failed).

const MAX_LEN = 500; // Twitch chat hard limit per message

export function chatSenderId() {
  return process.env.TWITCH_BOT_ID && process.env.TWITCH_BOT_REFRESH_TOKEN
    ? process.env.TWITCH_BOT_ID
    : process.env.TWITCH_BROADCASTER_ID || null;
}

export async function sendChannelMessage(text) {
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  if (!broadcasterId) throw new Error('MISSING_TWITCH_BROADCASTER_ID');
  if (!text || !text.trim()) throw new Error('EMPTY_MESSAGE');

  const clipped = text.length > MAX_LEN ? text.slice(0, MAX_LEN - 1) + '…' : text;

  const senderId = chatSenderId();
  const sentAs = senderId === broadcasterId ? 'broadcaster' : 'bot';
  const accessToken =
    sentAs === 'bot' ? await getBotAccessToken() : await getBroadcasterAccessToken();
  const res = await helix('POST', '/chat/messages', accessToken, {
    broadcaster_id: broadcasterId,
    sender_id: senderId,
    message: clipped,
  });

  // Twitch returns data[0].is_sent and a drop_reason if filtered.
  const sent = res?.data?.[0];
  if (!sent?.is_sent) {
    const reason = sent?.drop_reason?.message || 'unknown';
    throw new Error(`CHAT_DROPPED:${reason}`);
  }
  return { ok: true, twitchMessageId: sent.message_id, sentAs };
}
