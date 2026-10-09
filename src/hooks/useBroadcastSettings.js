import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

// Where full-screen reveals play (settings/broadcast): 'overlay' (OBS) or
// 'stage' (a staff browser). A missing doc or a failed read means 'overlay'.
export default function useBroadcastSettings(enabled = true) {
  const [reveals, setReveals] = useState('overlay');
  useEffect(() => {
    if (!enabled) return undefined;
    return onSnapshot(
      doc(db, 'settings', 'broadcast'),
      (snap) => {
        const data = snap && typeof snap.exists === 'function' && snap.exists() ? snap.data() : null;
        setReveals(data && data.reveals === 'stage' ? 'stage' : 'overlay');
      },
      () => setReveals('overlay')
    );
  }, [enabled]);
  return { reveals };
}
