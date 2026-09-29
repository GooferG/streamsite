import { useCallback, useState } from 'react';
import { giveawayErrorText, postAction } from '../admin/giveaways/api';

// One giveaway action at a time, with the error in plain words.
export function useGiveawayAction(id) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const run = useCallback(
    async (action, body = {}) => {
      setBusy(action);
      setError(null);
      try {
        const { ok, status, data } = await postAction(action, { id, ...body });
        if (!ok) {
          setError(giveawayErrorText(data?.error, status));
          return null;
        }
        return data;
      } catch (err) {
        setError(
          err && err.message === 'NOT_AUTHENTICATED'
            ? giveawayErrorText('NOT_AUTHENTICATED')
            : 'Network error, try again.'
        );
        return null;
      } finally {
        setBusy(null);
      }
    },
    [id]
  );
  return { busy, error, run };
}
