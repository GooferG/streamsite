import { useCallback, useState } from 'react';
import { authedFetch } from '../../utils/authedFetch';
import { redemptionErrorText } from './redemptions';

const without = (obj, key) => {
  const next = { ...obj };
  delete next[key];
  return next;
};

// Fulfil or refund redemptions from the panel. Each row has its own busy
// state and its own error, so one slow request never locks the queue.
export function useRedemptionAction() {
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  const run = useCallback(async (id, action, note) => {
    setBusy((b) => ({ ...b, [id]: action }));
    setErrors((e) => without(e, id));
    try {
      const res = await authedFetch('/api/admin/redemptions', {
        method: 'POST',
        body: JSON.stringify({ id, action, note: note || null }),
      });
      if (res.ok) return true;
      const data = await res.json().catch(() => ({}));
      setErrors((e) => ({ ...e, [id]: redemptionErrorText(data && data.error) }));
      return false;
    } catch {
      setErrors((e) => ({ ...e, [id]: redemptionErrorText(null) }));
      return false;
    } finally {
      setBusy((b) => without(b, id));
    }
  }, []);
  return { busy, errors, run };
}
