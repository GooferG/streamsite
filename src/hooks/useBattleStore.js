import { useEffect, useState, useCallback } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { makeId } from '../utils/huntCalc';

const LS_KEY = 'bonus_battle_active';

const EMPTY_BATTLE = (ownerUid) => ({
  ownerTwitchId: ownerUid || null,
  title: 'Bonus Battle',
  rakePct: 10,
  currentPlayerId: null,
  status: 'active',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || null;
  } catch {
    return null;
  }
}
function saveLocal(state) {
  if (state) localStorage.setItem(LS_KEY, JSON.stringify(state));
  else localStorage.removeItem(LS_KEY);
}

// Local shape mirrors the Firestore split: { battle, players: [] }.
export function useBattleStore() {
  const { twitchUser, firebaseUser } = useTwitchAuth();
  const uid = firebaseUser?.uid || twitchUser?.twitchId || null;
  const isLoggedIn = !!uid;

  const [battle, setBattle] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);

  // --- subscribe / load ---
  useEffect(() => {
    if (!isLoggedIn) {
      const local = loadLocal();
      setBattle(local?.battle || null);
      setPlayers(local?.players || []);
      return;
    }
    const battleRef = doc(db, 'bonus_battles', uid);
    const unsubBattle = onSnapshot(
      battleRef,
      (snap) => setBattle(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (err) => {
        console.error('battle sub error:', err);
        setError('Could not load the battle.');
      }
    );
    const playersQ = query(
      collection(db, 'bonus_battles', uid, 'players'),
      orderBy('order', 'asc')
    );
    const unsubPlayers = onSnapshot(
      playersQ,
      (snap) => setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('players sub error:', err)
    );
    return () => {
      unsubBattle();
      unsubPlayers();
    };
  }, [isLoggedIn, uid]);

  // --- local persistence (logged out) ---
  const persistLocal = useCallback((nextBattle, nextPlayers) => {
    saveLocal({ battle: nextBattle, players: nextPlayers });
  }, []);

  // --- battle-level writes ---
  const writeBattle = useCallback(
    (patch) => {
      setBattle((prev) => {
        const base = prev || EMPTY_BATTLE(uid);
        const next = { ...base, ...patch, updatedAt: Date.now() };
        if (!isLoggedIn) {
          setPlayers((pl) => {
            persistLocal(next, pl);
            return pl;
          });
        } else {
          setDoc(doc(db, 'bonus_battles', uid), next, { merge: true }).catch((e) => {
            console.error('battle write failed:', e);
            setError('Save failed.');
          });
        }
        return next;
      });
    },
    [isLoggedIn, uid, persistLocal]
  );

  const startBattle = useCallback(() => {
    writeBattle(EMPTY_BATTLE(uid));
  }, [writeBattle, uid]);

  const setRake = useCallback((pct) => writeBattle({ rakePct: Number(pct) || 0 }), [writeBattle]);
  const setTitle = useCallback((title) => writeBattle({ title }), [writeBattle]);
  const setCurrentPlayer = useCallback(
    (playerId) => writeBattle({ currentPlayerId: playerId }),
    [writeBattle]
  );

  // --- player-level writes ---
  const addPlayer = useCallback(
    ({ name, slot }) => {
      if (!name || !name.trim()) return;
      const id = makeId();
      const order = players.length;
      const player = {
        name: name.trim(),
        slot: (slot || '').trim(),
        payout: null,
        ran: false,
        addedByUid: uid || 'local',
        order,
        createdAt: Date.now(),
      };
      if (!isLoggedIn) {
        setPlayers((prev) => {
          const next = [...prev, { id, ...player }];
          persistLocal(battle || EMPTY_BATTLE(uid), next);
          return next;
        });
      } else {
        setDoc(doc(db, 'bonus_battles', uid, 'players', id), player).catch((e) =>
          console.error('addPlayer failed:', e)
        );
      }
    },
    [players.length, isLoggedIn, uid, battle, persistLocal]
  );

  const removePlayer = useCallback(
    (playerId) => {
      if (!isLoggedIn) {
        setPlayers((prev) => {
          const next = prev.filter((p) => p.id !== playerId);
          persistLocal(battle || EMPTY_BATTLE(uid), next);
          return next;
        });
      } else {
        deleteDoc(doc(db, 'bonus_battles', uid, 'players', playerId)).catch((e) =>
          console.error('removePlayer failed:', e)
        );
      }
    },
    [isLoggedIn, uid, battle, persistLocal]
  );

  const setPayout = useCallback(
    (playerId, payout) => {
      const value = Number(payout) || 0;
      if (!isLoggedIn) {
        setPlayers((prev) => {
          const next = prev.map((p) =>
            p.id === playerId ? { ...p, payout: value, ran: true } : p
          );
          persistLocal(battle || EMPTY_BATTLE(uid), next);
          return next;
        });
      } else {
        updateDoc(doc(db, 'bonus_battles', uid, 'players', playerId), {
          payout: value,
          ran: true,
        }).catch((e) => console.error('setPayout failed:', e));
      }
    },
    [isLoggedIn, uid, battle, persistLocal]
  );

  const reset = useCallback(() => {
    if (!isLoggedIn) {
      saveLocal(null);
      setBattle(null);
      setPlayers([]);
      return;
    }
    // Delete players then the battle doc. Best-effort.
    Promise.all(
      players.map((p) =>
        deleteDoc(doc(db, 'bonus_battles', uid, 'players', p.id)).catch(() => {})
      )
    ).then(() => deleteDoc(doc(db, 'bonus_battles', uid)).catch(() => {}));
  }, [isLoggedIn, uid, players]);

  return {
    battle,
    players,
    error,
    isLoggedIn,
    ownerId: uid,
    startBattle,
    setRake,
    setTitle,
    setCurrentPlayer,
    addPlayer,
    removePlayer,
    setPayout,
    reset,
  };
}
