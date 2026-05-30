import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { makeId } from '../utils/huntCalc';

const LS_KEY = 'hunt_tracker_active';

const EMPTY_HUNT = (name, startBalance) => ({
  name: name.trim(),
  casino: null,
  startBalance: startBalance === '' || startBalance == null ? '' : Number(startBalance),
  finishBalance: '',
  bonuses: [],
  gamblers: [],
  bannedSlots: '',
  status: 'active',
  startedAt: Date.now(),
  completedAt: null,
});

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || null;
  } catch {
    return null;
  }
}
function saveLocal(hunt) {
  if (hunt) localStorage.setItem(LS_KEY, JSON.stringify(hunt));
  else localStorage.removeItem(LS_KEY);
}

export function useHuntStore() {
  const { twitchUser, firebaseUser, loading: authLoading } = useTwitchAuth();
  const uid = firebaseUser?.uid || twitchUser?.twitchId || null;
  const isLoggedIn = !!uid;

  const [activeHunt, setActiveHunt] = useState(null);
  const [history, setHistory] = useState([]);
  const [localHuntPending, setLocalHuntPending] = useState(null);
  const debounceRef = useRef(null);
  // Holds the latest un-flushed hunt + its target uid so a pending debounced
  // write can be forced out on page unload / unmount (prevents losing the
  // last <500ms of edits when the user refreshes mid-edit).
  const pendingWriteRef = useRef(null);
  const [error, setError] = useState(null);

  // --- subscribe ---
  useEffect(() => {
    if (!isLoggedIn) {
      setActiveHunt(loadLocal());
      setHistory([]);
      return;
    }
    // Logged in: detect a local hunt to offer claiming.
    setLocalHuntPending(loadLocal());

    const activeRef = doc(db, 'users', uid, 'active_hunt', 'current');
    const unsubActive = onSnapshot(
      activeRef,
      (snap) => setActiveHunt(snap.exists() ? { id: 'current', ...snap.data() } : null),
      (err) => {
        console.error('active_hunt sub error:', err);
        setError('Could not load your hunt.');
      }
    );

    const histQ = query(
      collection(db, 'users', uid, 'hunts'),
      orderBy('completedAt', 'desc')
    );
    const unsubHist = onSnapshot(
      histQ,
      (snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('hunts sub error:', err)
    );

    return () => {
      unsubActive();
      unsubHist();
    };
  }, [isLoggedIn, uid]);

  // --- writers ---
  const writeActive = useCallback(
    (hunt) => {
      if (!isLoggedIn) {
        saveLocal(hunt);
        setActiveHunt(hunt);
        return;
      }
      setActiveHunt(hunt); // optimistic
      pendingWriteRef.current = { uid, hunt };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await setDoc(doc(db, 'users', uid, 'active_hunt', 'current'), hunt);
          pendingWriteRef.current = null;
          setError(null);
        } catch (e) {
          console.error('active write failed:', e);
          setError('Save failed — your latest edit is unsaved.');
        }
      }, 500);
    },
    [isLoggedIn, uid]
  );

  // Flush any pending debounced write immediately — on unmount (e.g. tab/tool
  // switch) and on page unload (refresh/close). Without this, an edit made in
  // the 500ms before navigating away would never reach Firestore.
  useEffect(() => {
    const flush = () => {
      const pending = pendingWriteRef.current;
      if (!pending) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Fire-and-forget; on unload the request is sent best-effort.
      setDoc(doc(db, 'users', pending.uid, 'active_hunt', 'current'), pending.hunt).catch(
        (e) => console.error('flush write failed:', e)
      );
      pendingWriteRef.current = null;
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);

  const startHunt = useCallback(
    ({ name, startBalance }) => {
      if (!name || !name.trim()) return;
      writeActive(EMPTY_HUNT(name, startBalance));
    },
    [writeActive]
  );

  const updateHunt = useCallback(
    (patch) => {
      if (!activeHunt) return;
      writeActive({ ...activeHunt, ...patch });
    },
    [activeHunt, writeActive]
  );

  const completeHunt = useCallback(async () => {
    if (!activeHunt) return;
    const completed = {
      ...activeHunt,
      status: 'completed',
      completedAt: isLoggedIn ? serverTimestamp() : Date.now(),
    };
    delete completed.id;
    if (!isLoggedIn) {
      // Anon: no history kept; just clear active.
      saveLocal(null);
      setActiveHunt(null);
      return completed;
    }
    const huntId = makeId();
    try {
      await setDoc(doc(db, 'users', uid, 'hunts', huntId), completed);
      await deleteDoc(doc(db, 'users', uid, 'active_hunt', 'current'));
      setActiveHunt(null);
    } catch (e) {
      console.error('complete failed:', e);
      setError('Could not complete the hunt. Try again.');
    }
    return completed;
  }, [activeHunt, isLoggedIn, uid]);

  const claimLocalHunt = useCallback(async () => {
    const local = loadLocal();
    if (!local || !isLoggedIn) return;
    try {
      await setDoc(doc(db, 'users', uid, 'active_hunt', 'current'), local);
      saveLocal(null);
      setLocalHuntPending(null);
    } catch (e) {
      console.error('claim failed:', e);
      setError('Could not save the local hunt to your account.');
    }
  }, [isLoggedIn, uid]);

  const discardLocalHunt = useCallback(() => {
    saveLocal(null);
    setLocalHuntPending(null);
  }, []);

  // While Firebase auth is still rehydrating we don't yet know if there's a
  // saved hunt — report 'loading' so the UI doesn't flash the start screen
  // before a logged-in user's active hunt streams in.
  const status = authLoading ? 'loading' : activeHunt ? 'active' : 'idle';

  return {
    status,
    activeHunt,
    history,
    isLoggedIn,
    localHuntPending,
    error,
    startHunt,
    updateHunt,
    completeHunt,
    claimLocalHunt,
    discardLocalHunt,
  };
}
