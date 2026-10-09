import { useCallback, useEffect, useRef, useState } from 'react';
import { STREAM_DELAY_MS, tsMillis } from '../../utils/giveaway';
import { AUTO_POST_WINDOW_MS, drawAnnounceDueAt, pendingDrawAnnounces } from '../../utils/ball';
import { announceProblem, ballAction } from './ballApi';

const TOO_EARLY_RETRY_MS = 1500;

// Posts each draw's chat line once the reveal has played on stream (chat runs
// ahead of the video). Driving tab only; the server claims each line, so
// several staff tabs still post once.
export function useBallDrawAnnounce(round, { armed = true } = {}) {
  // Failures are kept per round and per draw: one draw's success never hides
  // another's failure, and another round's never shows.
  const [state, setState] = useState({ roundId: null, failed: {} });
  const tried = useRef(new Set());
  const retryTimers = useRef(new Set());
  const id = round ? round.id : null;
  const pending = round ? pendingDrawAnnounces(round, Date.now()) : [];
  const pendingKey = pending.map((e) => e.drawNo).join(',');

  const postRef = useRef(null);
  const post = useCallback(
    async (drawNo, again = true) => {
      const { ok, data } = await ballAction({ action: 'announce', id, event: 'draw', drawNo });
      // TOO_EARLY: this browser's clock runs ahead of the server's. Once more.
      if (data && data.error === 'TOO_EARLY' && again) {
        const t = setTimeout(() => {
          retryTimers.current.delete(t);
          postRef.current(drawNo, false);
        }, TOO_EARLY_RETRY_MS);
        retryTimers.current.add(t);
        return;
      }
      const problem = announceProblem(ok, data);
      setState((s) => {
        const failed = s.roundId === id ? { ...s.failed } : {};
        if (problem) failed[drawNo] = problem;
        else delete failed[drawNo];
        return { roundId: id, failed };
      });
    },
    [id]
  );
  postRef.current = post;

  const clearRetries = () => {
    retryTimers.current.forEach(clearTimeout);
    retryTimers.current.clear();
  };

  useEffect(() => {
    if (!armed || !id) return clearRetries;
    const timers = pending
      .filter((e) => !tried.current.has(`${id}:${e.drawNo}`))
      .map((e) =>
        setTimeout(() => {
          tried.current.add(`${id}:${e.drawNo}`);
          postRef.current(e.drawNo);
        }, Math.max(0, drawAnnounceDueAt(e) - Date.now()))
      );
    return () => {
      timers.forEach(clearTimeout);
      clearRetries();
    };
    // pendingKey stands in for `pending`, which is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, id, pendingKey]);

  const failed = state.roundId === id ? state.failed : {};
  const failedNos = Object.keys(failed);
  const error = failedNos.length ? failed[failedNos[0]] : null;

  const retry = useCallback(() => {
    const now = Date.now();
    (round ? round.rack || [] : [])
      .filter((e) => failed[e.drawNo] && drawAnnounceDueAt(e) != null && drawAnnounceDueAt(e) <= now)
      .forEach((e) => postRef.current(e.drawNo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, state]);

  return { error, retry };
}

// Posts the winner line STREAM_DELAY_MS after the payout, like prediction
// results. Only a fresh settle posts on its own; older ones use Retry.
export function useBallResultsAnnounce(round, { armed = true } = {}) {
  const [state, setState] = useState({ id: null, posting: false, error: null });
  const tried = useRef(new Set());
  const id = round ? round.id : null;
  const settledMs = tsMillis(round && round.settledAt);
  const posted = !!(round && round.announced && round.announced.results);
  const due = !!round && round.status === 'settled' && !!round.winner && !posted && settledMs != null;

  const post = useCallback(async () => {
    if (!id) return;
    setState({ id, posting: true, error: null });
    const { ok, data } = await ballAction({ action: 'announce', id, event: 'results' });
    setState({ id, posting: false, error: announceProblem(ok, data) });
  }, [id]);

  useEffect(() => {
    if (!armed || !due || tried.current.has(id)) return undefined;
    if (Date.now() - settledMs > AUTO_POST_WINDOW_MS) return undefined;
    const t = setTimeout(() => {
      tried.current.add(id);
      post();
    }, Math.max(0, settledMs + STREAM_DELAY_MS - Date.now()));
    return () => clearTimeout(t);
  }, [armed, due, id, settledMs, post]);

  const mine = state.id === id;
  return { posted, posting: mine && state.posting, error: mine ? state.error : null, retry: post };
}
