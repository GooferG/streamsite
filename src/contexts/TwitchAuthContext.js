import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { isViewerSession, confirmSwitch, SWITCH_TO_TWITCH_MSG } from '../utils/authSwitch';

const TwitchAuthContext = createContext({});

export const useTwitchAuth = () => useContext(TwitchAuthContext);

const REDIRECT_URI = `${window.location.origin}/twitch-callback`;
const CLIENT_ID = process.env.REACT_APP_TWITCH_CLIENT_ID;

export function TwitchAuthProvider({ children }) {
  const [twitchUser, setTwitchUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('twitch_user')) || null; } catch { return null; }
  });
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      // Keep the stored Twitch profile honest: clear it whenever the real
      // session isn't this viewer (signed out, or an admin account took over).
      // Functional update reads the latest stored profile without making it an
      // effect dep (which would re-subscribe on every login).
      setTwitchUser((prev) => {
        if (isViewerSession(user, prev)) return prev;
        localStorage.removeItem('twitch_user');
        return null;
      });
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithTwitch = () => {
    // If an admin/staff session is active, warn before clobbering it.
    const adminActive = !!auth.currentUser?.email;
    if (!confirmSwitch(SWITCH_TO_TWITCH_MSG, adminActive)) return;
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'user:read:email',
    });
    window.location.href = `https://id.twitch.tv/oauth2/authorize?${params}`;
  };

  const signInWithTwitchCode = async (code) => {
    const res = await fetch('/api/twitch-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
    });
    if (!res.ok) throw new Error('Auth failed');
    const { firebaseToken, twitchId, displayName, profileImageUrl } = await res.json();
    await signInWithCustomToken(auth, firebaseToken);
    const profile = { twitchId, displayName, profileImageUrl };
    setTwitchUser(profile);
    localStorage.setItem('twitch_user', JSON.stringify(profile));
    return profile;
  };

  const logout = async () => {
    await signOut(auth);
    setTwitchUser(null);
    localStorage.removeItem('twitch_user');
  };

  return (
    <TwitchAuthContext.Provider value={{ twitchUser, firebaseUser, loading, loginWithTwitch, signInWithTwitchCode, logout }}>
      {children}
    </TwitchAuthContext.Provider>
  );
}
