import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

// Where full-screen reveals play (settings/broadcast): 'overlay' (OBS) or
// 'stage' (a staff browser). A missing doc or a failed read means 'overlay'.
// `ready` flips on the first snapshot or error, so an OBS source can hold its
// full-screen moments until it knows the mode. `updatedBy` is who last
// flipped it. A listener error keeps the last known mode (a blip must not flip
// a Stage setup back to OBS) and only flips `ready`.
export default function useBroadcastSettings(enabled = true) {
  const [state, setState] = useState({ reveals: 'overlay', updatedBy: null, ready: false });
  useEffect(() => {
    if (!enabled) return undefined;
    return onSnapshot(
      doc(db, 'settings', 'broadcast'),
      (snap) => {
        const data = snap && typeof snap.exists === 'function' && snap.exists() ? snap.data() : null;
        setState({
          reveals: data && data.reveals === 'stage' ? 'stage' : 'overlay',
          updatedBy: (data && data.updatedBy) || null,
          ready: true,
        });
      },
      () => setState((s) => ({ ...s, ready: true }))
    );
  }, [enabled]);
  return state;
}
