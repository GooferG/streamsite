import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

// Public order feed for the chyron (store_public/feed, written by the redeem API).
export default function useStoreFeed() {
  const [orders, setOrders] = useState([]);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'store_public', 'feed'),
        (snap) => setOrders(snap.exists() ? snap.data().orders || [] : []),
        (err) => {
          console.error('store feed load error', err);
          setOrders([]);
        }
      ),
    []
  );
  return orders;
}
