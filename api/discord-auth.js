import { adminDb, FieldValue } from './_lib/firebaseAdmin.js';
import { applyCors, requireAuth } from './_lib/verifyAuth.js';

const AWARD = Number(process.env.DISCORD_LINK_TICKET_AWARD) || 100;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decoded = await requireAuth(req, res);
  if (!decoded) return;
  const twitchId = decoded.uid;

  const { code, redirect_uri } = req.body || {};
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing code or redirect_uri' });
  }

  const clientId = process.env.REACT_APP_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!clientId || !clientSecret || !guildId) {
    return res.status(500).json({ error: 'DISCORD_NOT_CONFIGURED' });
  }

  try {
    // 1. Exchange code for user access token.
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({ error: 'TOKEN_EXCHANGE_FAILED', details: tokenData });
    }
    const accessToken = tokenData.access_token;

    // 2. Fetch the user's identity.
    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = await meRes.json();
    if (!meRes.ok || !me.id) {
      return res.status(400).json({ error: 'USER_FETCH_FAILED' });
    }

    // 3. Fetch the user's guild list and verify our guild is in it.
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const guilds = await guildsRes.json();
    if (!guildsRes.ok || !Array.isArray(guilds)) {
      return res.status(400).json({ error: 'GUILDS_FETCH_FAILED' });
    }
    const inGuild = guilds.some((g) => g.id === guildId);
    if (!inGuild) {
      return res.status(403).json({ error: 'NOT_IN_GUILD' });
    }

    // 4. Atomic: check that we haven't already granted this user, and that
    //    nobody else has linked this Discord account. Then grant tickets.
    const userRef = adminDb.collection('users').doc(twitchId);
    const ledgerRef = adminDb.collection('ticket_ledger').doc();

    // Check: is this Discord id already linked to another twitch account?
    const dupSnap = await adminDb
      .collection('users')
      .where('discordId', '==', me.id)
      .limit(1)
      .get();
    if (!dupSnap.empty && dupSnap.docs[0].id !== twitchId) {
      return res.status(409).json({ error: 'DISCORD_ALREADY_LINKED' });
    }

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('USER_NOT_FOUND');
      const user = snap.data();

      // Already linked? Refresh display fields but don't double-grant.
      const alreadyLinked = !!user.discordVerifiedAt;
      const ts = FieldValue.serverTimestamp();

      const updates = {
        discordId: me.id,
        discordUsername: me.username || null,
        discordGlobalName: me.global_name || null,
        updatedAt: ts,
      };

      if (!alreadyLinked) {
        updates.discordVerifiedAt = ts;
        updates.tickets = FieldValue.increment(AWARD);
        updates.totalEarned = FieldValue.increment(AWARD);
      }
      tx.update(userRef, updates);

      if (!alreadyLinked) {
        tx.set(ledgerRef, {
          userId: twitchId,
          delta: AWARD,
          reason: 'discord_link',
          discordId: me.id,
          createdAt: ts,
        });
      }
      return { alreadyLinked, awarded: alreadyLinked ? 0 : AWARD };
    });

    return res.status(200).json({
      ok: true,
      discordId: me.id,
      discordUsername: me.username,
      ...result,
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'USER_NOT_FOUND' });
    console.error('discord-auth error', err);
    return res.status(500).json({ error: 'INTERNAL', detail: err.message });
  }
}
