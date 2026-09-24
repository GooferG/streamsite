import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { db } from '../config/firebase';

const ENTRY_LIMIT = 40;

/**
 * Live feed for the stream overlay: the most recent giveaway (any status, so
 * the overlay can show a wrap-up after it ends), its newest entries, and the
 * winner's first chat message while a pick is on screen.
 *
 * All three are public reads, so this works in an OBS browser source with
 * nobody signed in.
 */
export function useGiveawayFeed({ enabled = true } = {}) {
  const [giveaway, setGiveaway] = useState(null);
  const [entries, setEntries] = useState([]);
  const [firstMessage, setFirstMessage] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const q = query(collection(db, 'giveaways'), orderBy('createdAt', 'desc'), fLimit(1));
    return onSnapshot(
      q,
      (snap) => setGiveaway(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
      (err) => console.error('giveaway feed failed', err)
    );
  }, [enabled]);

  const id = giveaway?.id || null;
  useEffect(() => {
    setEntries([]);
    if (!enabled || !id) return undefined;
    const q = query(
      collection(db, 'giveaways', id, 'entries'),
      orderBy('enteredAt', 'desc'),
      fLimit(ENTRY_LIMIT)
    );
    return onSnapshot(q, (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [enabled, id]);

  const rolling = giveaway?.status === 'rolling';
  const winnerId = giveaway?.winnerTwitchId || null;
  useEffect(() => {
    setFirstMessage(null);
    if (!enabled || !id || !rolling || !winnerId) return undefined;
    const q = query(
      collection(db, 'giveaways', id, 'winner_messages'),
      orderBy('createdAt', 'asc'),
      fLimit(1)
    );
    return onSnapshot(q, (snap) =>
      setFirstMessage(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() })
    );
  }, [enabled, id, rolling, winnerId]);

  return { giveaway, entries, firstMessage };
}
