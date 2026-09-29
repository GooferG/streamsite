import { useEffect, useState } from 'react';

export const DRIVER_LOCK = 'goofer-control-driver';
const DRIVER_HIDDEN = 'driver-hidden';

const defaultLocks = () => (typeof navigator !== 'undefined' ? navigator.locks : undefined);
const defaultDoc = () => (typeof document !== 'undefined' ? document : undefined);
const openChannel = () =>
  typeof BroadcastChannel === 'function' ? new BroadcastChannel(DRIVER_LOCK) : null;

/**
 * Elects one tab per browser to run the giveaway and prediction timers.
 *
 * The visible tab wins: browsers throttle timers in hidden tabs (last call
 * could fire a minute late), so a tab that becomes visible steals the lock and
 * the old holder queues up again. A window that is already visible never sees
 * a visibilitychange, so the driver also says 'driver-hidden' on a
 * BroadcastChannel when it goes hidden, and any visible tab takes over. Only
 * visible tabs steal, so the lock never ping-pongs. Without Web Locks every
 * tab drives and the server's claim-once guards dedupe.
 *
 * `channel` is for tests: an object shaped like a BroadcastChannel. Left out,
 * the hook opens (and closes) its own when the browser has one; null turns
 * the hand-off off.
 */
export function useDriverLock(enabled, { locks = defaultLocks(), doc = defaultDoc(), channel } = {}) {
  const supported = !!(locks && typeof locks.request === 'function');
  const [held, setHeld] = useState(false);
  // Set when a Web Locks request rejects with something other than our own
  // abort (e.g. a SecurityError on an opaque origin, or an InvalidStateError
  // on a document that's no longer fully active). Retrying that forever would
  // loop through promise callbacks and peg the tab, so we stop trying and
  // drive unconditionally for the rest of this effect's life instead.
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!enabled || !supported) {
      setHeld(false);
      setFallback(false);
      return undefined;
    }
    let disposed = false;
    let failed = false;
    let gen = 0;
    let release = null; // resolves the promise that holds the lock
    let controller = null; // aborts a queued (not yet granted) request
    setFallback(false);

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
        .catch((err) => {
          if (disposed || mine !== gen) return;
          release = null;
          setHeld(false);
          if (err && err.name === 'AbortError') {
            // Stolen by another tab (or a queued request we aborted
            // ourselves, which never reaches here since its `mine` is
            // already stale by the time we abort it). Re-queue.
            acquire(false);
            return;
          }
          // Something is actually wrong with Web Locks, not a steal.
          // Retrying would loop forever, so fall back to "every tab
          // drives" for the rest of this effect's life.
          failed = true;
          // eslint-disable-next-line no-console
          console.warn('useDriverLock: Web Locks request failed, falling back to unlocked mode', err);
          setFallback(true);
        });
    };

    const takeOver = () => {
      if (disposed || failed || release || !doc || doc.visibilityState !== 'visible') return;
      const queued = controller;
      acquire(true); // bumps gen first, so the aborted request is ignored
      queued?.abort();
    };

    const ownsBus = channel === undefined;
    const bus = ownsBus ? openChannel() : channel;
    const onVisibility = () => {
      // The driver going hidden hands off to a tab that is already visible.
      if (release && doc?.visibilityState === 'hidden') bus?.postMessage(DRIVER_HIDDEN);
      takeOver();
    };
    const onMessage = (e) => {
      if (e && e.data === DRIVER_HIDDEN) takeOver();
    };

    acquire(!!doc && doc.visibilityState === 'visible');
    doc?.addEventListener('visibilitychange', onVisibility);
    bus?.addEventListener('message', onMessage);

    return () => {
      disposed = true;
      gen += 1;
      doc?.removeEventListener('visibilitychange', onVisibility);
      bus?.removeEventListener('message', onMessage);
      if (ownsBus) bus?.close();
      release?.();
      release = null;
      controller?.abort();
    };
  }, [enabled, supported, locks, doc, channel]);

  return { isDriver: enabled && (supported ? fallback || held : true), supported };
}
