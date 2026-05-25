import { applyCors, requireAdmin } from '../_lib/verifyAuth.js';
import { getAppAccessToken, helix } from '../_lib/twitchBroadcasterToken.js';

// Admin-only management endpoint for the channel.chat.message EventSub
// subscription. One-time click to subscribe; lists current subscriptions for
// visibility; allows deleting if you ever need to re-create.
//
// Required env:
//   TWITCH_BROADCASTER_ID
//   TWITCH_EVENTSUB_SECRET
//   PUBLIC_BASE_URL          e.g. https://goofer.tv  (the EventSub webhook URL
//                            will be `${PUBLIC_BASE_URL}/api/twitch/eventsub`)

function callbackUrl(req) {
  const base = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
  return `${base.replace(/\/$/, '')}/api/twitch/eventsub`;
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!broadcasterId || !secret) {
    return res.status(500).json({ error: 'EVENTSUB_NOT_CONFIGURED' });
  }

  try {
    const appToken = await getAppAccessToken();

    if (req.method === 'GET') {
      const list = await helix('GET', '/eventsub/subscriptions', appToken);
      // Filter to chat.message for our broadcaster to keep response focused.
      const ours = (list.data || []).filter(
        (s) =>
          s.type === 'channel.chat.message' &&
          s.condition?.broadcaster_user_id === broadcasterId
      );
      return res.status(200).json({ ok: true, total: list.total, ours });
    }

    if (req.method === 'POST') {
      // Idempotent subscribe: check first, only create if missing.
      const list = await helix('GET', '/eventsub/subscriptions', appToken);
      const existing = (list.data || []).find(
        (s) =>
          s.type === 'channel.chat.message' &&
          s.condition?.broadcaster_user_id === broadcasterId &&
          s.transport?.callback === callbackUrl(req)
      );
      if (existing && (existing.status === 'enabled' || existing.status === 'webhook_callback_verification_pending')) {
        return res.status(200).json({ ok: true, status: existing.status, id: existing.id, alreadyExists: true });
      }

      // user_id is required for chat.message and must equal a user the broadcaster
      // has authorized chat-read for. The broadcaster reading their own chat is fine.
      const created = await helix('POST', '/eventsub/subscriptions', appToken, {
        type: 'channel.chat.message',
        version: '1',
        condition: {
          broadcaster_user_id: broadcasterId,
          user_id: broadcasterId,
        },
        transport: {
          method: 'webhook',
          callback: callbackUrl(req),
          secret,
        },
      });
      const sub = created.data?.[0];
      return res.status(200).json({
        ok: true,
        id: sub?.id,
        status: sub?.status,
        cost: created.total_cost,
      });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || (req.body && req.body.id);
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await helix('DELETE', `/eventsub/subscriptions?id=${encodeURIComponent(id)}`, appToken);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin/eventsub error', err);
    return res.status(500).json({
      error: 'INTERNAL',
      detail: err.message,
      twitch: err.body || null,
    });
  }
}
