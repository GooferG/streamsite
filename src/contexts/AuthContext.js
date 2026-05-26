import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const OWNER_EMAIL = 'luimeneghim@gmail.com';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  // role: 'owner' | 'moderator' | null
  // null while loading or when the signed-in account isn't staff.
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      // Owner check is just an email match — no Firestore read.
      if (user.email === OWNER_EMAIL) {
        setRole('owner');
        setLoading(false);
        return;
      }

      // Moderator check — Twitch viewer signed in via custom token. uid
      // equals the Twitch user id. admin_users/{uid} must exist with
      // role='moderator'.
      try {
        const snap = await getDoc(doc(db, 'admin_users', user.uid));
        if (snap.exists() && snap.data().role === 'moderator' && snap.data().active !== false) {
          setRole('moderator');
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error('admin role lookup failed', err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    role,
    isOwner: role === 'owner',
    isModerator: role === 'moderator',
    isStaff: role === 'owner' || role === 'moderator',
    login,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
