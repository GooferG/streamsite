import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// The shared reveals switch (spec: Reveals switch). Staff write it from the
// control room header; both OBS overlays read it.
export function writeReveals(mode) {
  const user = auth && auth.currentUser;
  return setDoc(
    doc(db, 'settings', 'broadcast'),
    {
      reveals: mode === 'stage' ? 'stage' : 'overlay',
      updatedAt: serverTimestamp(),
      updatedBy: (user && (user.email || user.uid)) || null,
    },
    { merge: true }
  );
}
