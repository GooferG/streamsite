import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';

/**
 * Live subscription to users/{twitchId} for the signed-in viewer.
 * Returns null user if not signed in.
 */
export function useUserDoc() {
  const { twitchUser, firebaseUser } = useTwitchAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const uid = firebaseUser?.uid || twitchUser?.twitchId || null;

  useEffect(() => {
    if (!uid) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setUser(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error('useUserDoc error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [uid]);

  return { user, loading };
}
