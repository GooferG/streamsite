import { useEffect, useState } from 'react';

export const DRIVER_LOCK = 'goofer-control-driver';

const defaultLocks = () => (typeof navigator !== 'undefined' ? navigator.locks : undefined);
const defaultDoc = () => (typeof document !== 'undefined' ? document : undefined);

/**
 * Elects one tab per browser to run the giveaway and prediction timers.
 *
 * The visible tab wins: browsers throttle timers in hidden tabs (last call
 * could fire a minute late), so a tab that becomes visible steals the lock and
 * the old holder queues up again. Without Web Locks every tab drives and the
 * server's claim-once guards dedupe.
 */
export function useDriverLock(enabled, { locks = defaultLocks(), doc = defaultDoc() } = {}) {
  const supported = !!(locks && typeof locks.request === 'function');
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!enabled || !supported) {
      setHeld(false);
      return undefined;
    }
    let disposed = false;
    let gen = 0;
    let release = null; // resolves the promise that holds the lock
    let controller = null; // aborts a queued (not yet granted) request

    const acquire = (steal) => {
      const mine = (gen += 1);
      const ctrl = steal ? null : new AbortController();
      controller = ctrl;
      const options = steal ? { mode: 'exclusive', steal: true } : { mode: 'exclusive', signal: ctrl.signal };
      locks
        .request(DRIVER_LOCK, options, () => {
          // A stale grant (we moved on, or unmounted): hand it straight back.
          if (disposed || mine !== gen) return undefined;
          setHeld(true);
          return new Promise((resolve) => {
            release = resolve;
          });
        })
        .catch(() => {
          // Aborted by us (ignored below), or stolen by another tab.
          if (disposed || mine !== gen) return;
          release = null;
          setHeld(false);
          acquire(false);
        });
    };

    const takeOver = () => {
      if (disposed || release || !doc || doc.visibilityState !== 'visible') return;
      const queued = controller;
      acquire(true); // bumps gen first, so the aborted request is ignored
      queued?.abort();
    };

    acquire(!!doc && doc.visibilityState === 'visible');
    doc?.addEventListener('visibilitychange', takeOver);

    return () => {
      disposed = true;
      gen += 1;
      doc?.removeEventListener('visibilitychange', takeOver);
      release?.();
      release = null;
      controller?.abort();
    };
  }, [enabled, supported, locks, doc]);

  return { isDriver: enabled && (supported ? held : true), supported };
}
