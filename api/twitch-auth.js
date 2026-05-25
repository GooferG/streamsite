import { adminAuth, adminDb, FieldValue } from './_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, redirect_uri } = req.body;
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing code or redirect_uri' });
  }

  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    return res.status(400).json({ error: 'Twitch token exchange failed', details: tokenData });
  }

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  const userData = await userRes.json();
  if (!userRes.ok || !userData.data?.[0]) {
    return res.status(400).json({ error: 'Failed to fetch Twitch user' });
  }

  const twitchUser = userData.data[0];

  // Upsert users/{twitchId} — initialize ticket fields only on first login.
  const userRef = adminDb.collection('users').doc(twitchUser.id);
  const existing = await userRef.get();
  if (!existing.exists) {
    await userRef.set({
      twitchId: twitchUser.id,
      twitchName: twitchUser.login,
      displayName: twitchUser.display_name,
      profileImageUrl: twitchUser.profile_image_url || null,
      tickets: 0,
      totalEarned: 0,
      totalSpent: 0,
      lastDailyClaimAt: null,
      lastWatchTimeAwardAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    // Refresh profile fields (display name / avatar) on every login.
    await userRef.update({
      twitchName: twitchUser.login,
      displayName: twitchUser.display_name,
      profileImageUrl: twitchUser.profile_image_url || null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const firebaseToken = await adminAuth.createCustomToken(twitchUser.id, {
    twitchName: twitchUser.display_name,
    twitchLogin: twitchUser.login,
    profileImageUrl: twitchUser.profile_image_url,
  });

  return res.status(200).json({
    firebaseToken,
    twitchId: twitchUser.id,
    twitchLogin: twitchUser.login,
    displayName: twitchUser.display_name,
    profileImageUrl: twitchUser.profile_image_url,
  });
}
