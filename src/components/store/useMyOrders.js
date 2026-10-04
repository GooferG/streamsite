import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

// The viewer's latest redemptions. Same query shape as /account, so the
// composite index already exists.
export default function useMyOrders(uid, max = 5) {
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    if (!uid) {
      setOrders([]);
      return undefined;
    }
    const q = query(collection(db, 'redemptions'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(
      q,
      (snap) => setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error('my orders load error', err);
        setOrders([]);
      }
    );
  }, [uid, max]);
  return orders;
}
