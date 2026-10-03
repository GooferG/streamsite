import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

// Active catalogue, live. items is undefined until the first snapshot.
export default function useStoreItems() {
  const [state, setState] = useState({ items: undefined, error: null });
  useEffect(() => {
    const q = query(collection(db, 'store_items'), where('active', '==', true), orderBy('sortOrder', 'asc'));
    return onSnapshot(
      q,
      (snap) => setState({ items: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null }),
      (err) => {
        console.error('store_items load error', err);
        setState({ items: [], error: err });
      }
    );
  }, []);
  return state;
}
