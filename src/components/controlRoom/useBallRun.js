import { useCallback, useState } from 'react';
import { ballAction, ballErrorText } from './ballApi';

// One staff action at a time, with its error in words.
export function useBallRun() {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const run = useCallback(async (body) => {
    setBusy(body.action);
    setError(null);
    const result = await ballAction(body);
    setBusy(null);
    if (!result.ok) setError(ballErrorText(result.data.error, result.status));
    return result;
  }, []);
  return { busy, error, run, setError };
}
