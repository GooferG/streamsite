import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { makeId } from '../utils/huntCalc';
import { authedFetch } from '../utils/authedFetch';

// Best-effort deletion of a hunt's suggestion-intake link via the server
// endpoint (the intake doc is server-only; rules block client deletes). Called
// when a hunt ends so links don't outlive their hunt.
async function deleteIntake(linkId) {
  if (!linkId) return;
  try {
    await authedFetch('/api/hunt-suggest/manage', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', linkId }),
    });
  } catch (e) {
    console.error('intake cleanup failed:', e);
  }
}

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

// Public mirror shape for a live-shared hunt. Built explicitly so we control
// exactly what spectators can see. ownerTwitchId gates writes in the rules.
function buildMirror(hunt, ownerTwitchId) {
  return {
    ownerTwitchId,
    name: hunt.name || 'Untitled',
    startBalance: hunt.startBalance ?? '',
    finishBalance: hunt.finishBalance ?? '',
    bonuses: Array.isArray(hunt.bonuses) ? hunt.bonuses : [],
    gamblers: Array.isArray(hunt.gamblers) ? hunt.gamblers : [],
    bannedSlots: hunt.bannedSlots || '',
    phase: hunt.phase === 'opening' ? 'opening' : 'collecting',
    openingIndex: hunt.openingIndex ?? 0,
    updatedAt: Date.now(),
  };
}

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
          // Merge-write WITHOUT suggestions: this debounced write fires on every
          // keystroke, and the public submission endpoint mutates suggestions[]
          // via a transaction. A full-doc setDoc here would clobber an in-flight
          // submission. Suggestions are written separately via updateSuggestions.
          const { suggestions, ...rest } = hunt;
          await setDoc(doc(db, 'users', uid, 'active_hunt', 'current'), rest, { merge: true });
          // Mirror to the public live doc while sharing is on. (buildMirror never
          // includes suggestions, so the mirror is unaffected.)
          if (hunt.shareId) {
            await setDoc(doc(db, 'shared_hunts', hunt.shareId), buildMirror(hunt, uid));
          }
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
      // Fire-and-forget; on unload the request is sent best-effort. Same
      // suggestions-excluded merge as the debounced write so a last-moment
      // flush can't clobber a concurrent public submission.
      const { suggestions, ...rest } = pending.hunt;
      setDoc(doc(db, 'users', pending.uid, 'active_hunt', 'current'), rest, { merge: true }).catch(
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

  // Owner-side suggestions writer. Writes ONLY the suggestions[] field, and does
  // it immediately (not debounced) via a targeted update, so it never rides
  // along in the keystroke-debounced full-doc write that could clobber a public
  // submission. Local state updates optimistically; the snapshot reconciles.
  const updateSuggestions = useCallback(
    (nextSuggestions) => {
      if (!activeHunt) return;
      // Functional update so this composes with a same-tick updateHunt (e.g.
      // landing a bonus writes bonuses via updateHunt + suggestions here) —
      // each patches the latest local state instead of a stale snapshot.
      if (!isLoggedIn) {
        setActiveHunt((prev) => {
          const next = { ...(prev || activeHunt), suggestions: nextSuggestions };
          saveLocal(next);
          return next;
        });
        return;
      }
      setActiveHunt((prev) => ({ ...(prev || activeHunt), suggestions: nextSuggestions }));
      updateDoc(doc(db, 'users', uid, 'active_hunt', 'current'), {
        suggestions: nextSuggestions,
      }).catch((e) => {
        console.error('suggestions write failed:', e);
        setError('Could not save suggestions.');
      });
    },
    [activeHunt, isLoggedIn, uid]
  );

  const startSharing = useCallback(async () => {
    if (!isLoggedIn || !activeHunt) return;
    if (activeHunt.shareId) return; // already sharing
    const shareId = makeId();
    try {
      await setDoc(doc(db, 'shared_hunts', shareId), buildMirror(activeHunt, uid));
      // Persist shareId on the active hunt (also re-mirrors via writeActive).
      writeActive({ ...activeHunt, shareId });
    } catch (e) {
      console.error('start sharing failed:', e);
      setError('Could not start sharing.');
    }
  }, [isLoggedIn, uid, activeHunt, writeActive]);

  const stopSharing = useCallback(async () => {
    if (!activeHunt?.shareId) return;
    const shareId = activeHunt.shareId;
    try {
      await deleteDoc(doc(db, 'shared_hunts', shareId));
    } catch (e) {
      console.error('stop sharing failed:', e);
    }
    const next = { ...activeHunt };
    delete next.shareId;
    writeActive(next);
  }, [activeHunt, writeActive]);

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
      // End the live share cleanly when the hunt completes.
      if (activeHunt.shareId) {
        await deleteDoc(doc(db, 'shared_hunts', activeHunt.shareId)).catch((e) =>
          console.error('mirror cleanup failed:', e)
        );
      }
      // Kill the suggestion-intake link so it doesn't outlive the hunt.
      await deleteIntake(activeHunt.intakeLinkId);
      setActiveHunt(null);
    } catch (e) {
      console.error('complete failed:', e);
      setError('Could not complete the hunt. Try again.');
    }
    return completed;
  }, [activeHunt, isLoggedIn, uid]);

  // Discard the in-progress hunt WITHOUT archiving it to history.
  const discardActiveHunt = useCallback(async () => {
    if (!activeHunt) return;
    // Cancel any pending debounced write so it can't resurrect the hunt.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingWriteRef.current = null;
    if (!isLoggedIn) {
      saveLocal(null);
      setActiveHunt(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', uid, 'active_hunt', 'current'));
      if (activeHunt.shareId) {
        await deleteDoc(doc(db, 'shared_hunts', activeHunt.shareId)).catch((e) =>
          console.error('mirror cleanup failed:', e)
        );
      }
      await deleteIntake(activeHunt.intakeLinkId);
      setActiveHunt(null);
    } catch (e) {
      console.error('discard failed:', e);
      setError('Could not discard the hunt. Try again.');
    }
  }, [activeHunt, isLoggedIn, uid]);

  // Re-open a completed hunt: move it back to active_hunt/current and remove it
  // from history, so the user lands in the tracker on its previous state.
  // Only valid when nothing is currently active (the history UI only shows on
  // the idle screen, so there's no in-progress hunt to clobber).
  const reopenHunt = useCallback(
    async (huntId) => {
      if (!isLoggedIn || !huntId || activeHunt) return;
      const hunt = history.find((h) => h.id === huntId);
      if (!hunt) return;
      const restored = { ...hunt };
      delete restored.id;
      // Drop a stale shareId — the live mirror was deleted on completion, so a
      // leftover id would show a dead "Live" badge until re-shared.
      delete restored.shareId;
      // Same for a suggestion-intake link: the old link is no longer wired to
      // this (now re-activated) hunt. Owner can create a fresh one.
      delete restored.intakeLinkId;
      delete restored.intakeOpen;
      restored.status = 'active';
      restored.completedAt = null;
      try {
        await setDoc(doc(db, 'users', uid, 'active_hunt', 'current'), restored);
        await deleteDoc(doc(db, 'users', uid, 'hunts', huntId));
        // Active subscription will stream the restored hunt into state.
      } catch (e) {
        console.error('reopen failed:', e);
        setError('Could not re-open that hunt.');
      }
    },
    [isLoggedIn, uid, history, activeHunt]
  );

  // Delete one of the user's own completed hunts (logged-in only).
  const deleteHistoryHunt = useCallback(
    async (huntId) => {
      if (!isLoggedIn || !huntId) return;
      try {
        await deleteDoc(doc(db, 'users', uid, 'hunts', huntId));
      } catch (e) {
        console.error('delete history hunt failed:', e);
        setError('Could not delete that hunt.');
      }
    },
    [isLoggedIn, uid]
  );

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
    shareId: activeHunt?.shareId || null,
    startHunt,
    updateHunt,
    updateSuggestions,
    completeHunt,
    discardActiveHunt,
    reopenHunt,
    deleteHistoryHunt,
    claimLocalHunt,
    discardLocalHunt,
    startSharing,
    stopSharing,
  };
}
