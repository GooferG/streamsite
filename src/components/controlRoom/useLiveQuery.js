import { useEffect, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

const EMPTY = { docs: [], error: false, gaveUp: false };

// A live Firestore query that survives blips: on error it resubscribes every
// retryMs, and after maxRetries failures in a row it stops ("reload to
// reconnect"). A good snapshot resets the count.
export function useLiveQuery(makeQuery, enabled, { retryMs = 5000, maxRetries = 5 } = {}) {
  const [state, setState] = useState(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const failures = useRef(0);
  const makeRef = useRef(makeQuery);
  makeRef.current = makeQuery;

  useEffect(() => {
    if (!enabled) {
      failures.current = 0;
      setState(EMPTY);
      return undefined;
    }
    let timer = null;
    const unsubscribe = onSnapshot(
      makeRef.current(),
      (snap) => {
        failures.current = 0;
        setState({ docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: false, gaveUp: false });
      },
      () => {
        failures.current += 1;
        if (failures.current > maxRetries) {
          setState((s) => ({ ...s, error: true, gaveUp: true }));
          return;
        }
        setState((s) => ({ ...s, error: true }));
        timer = setTimeout(() => setAttempt((a) => a + 1), retryMs);
      }
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled, attempt, retryMs, maxRetries]);

  return state;
}
