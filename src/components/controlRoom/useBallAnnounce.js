import { useCallback, useEffect, useRef, useState } from 'react';
import { STREAM_DELAY_MS, tsMillis } from '../../utils/giveaway';
import { AUTO_POST_WINDOW_MS, drawAnnounceDueAt, pendingDrawAnnounces, pendingScratchAnnounces } from '../../utils/ball';
import { announceProblem, ballAction } from './ballApi';

const TOO_EARLY_RETRY_MS = 1500;

// Posts each draw's chat line once the reveal has played on stream (chat runs
// ahead of the video), and each scratch line no earlier than that draw's own
// line time. Driving tab only; the server claims each line, so several staff
// tabs still post once.
export function useBallDrawAnnounce(round, { armed = true } = {}) {
  // Failures are kept per round and per draw: one draw's success never hides
  // another's failure, and another round's never shows.
  const [state, setState] = useState({ roundId: null, failed: {} });
  const tried = useRef(new Set());
  const retryTimers = useRef(new Set());
  const id = round ? round.id : null;
  const pending = round ? pendingDrawAnnounces(round, Date.now()) : [];
  const pendingScratches = round ? pendingScratchAnnounces(round, Date.now()) : [];
  const pendingKey = `${pending.map((e) => e.drawNo).join(',')}|${pendingScratches.map((e) => e.drawNo).join(',')}`;

  const postRef = useRef(null);
  const post = useCallback(
    async (drawNo, again = true, event = 'draw') => {
      const failKey = event === 'draw' ? drawNo : `s${drawNo}`;
      const { ok, data } = await ballAction({ action: 'announce', id, event, drawNo });
      // TOO_EARLY: this browser's clock runs ahead of the server's. Once more.
      const later = event === 'scratch' && data && data.announce && data.announce.reason === 'later';
      if (((data && data.error === 'TOO_EARLY') || later) && again) {
        const t = setTimeout(() => {
          retryTimers.current.delete(t);
          postRef.current(drawNo, false, event);
        }, TOO_EARLY_RETRY_MS);
        retryTimers.current.add(t);
        return;
      }
      // Still "later" after the retry: the clock is too far ahead to wait out
      // here, so surface it with a Retry like a draw line's TOO_EARLY.
      const problem = later ? 'TOO_EARLY' : announceProblem(ok, data);
      setState((s) => {
        const failed = s.roundId === id ? { ...s.failed } : {};
        if (problem) failed[failKey] = problem;
        else delete failed[failKey];
        return { roundId: id, failed };
      });
    },
    [id]
  );
  postRef.current = post;

  // A TOO_EARLY / later retry belongs to its round: only leaving the round
  // (or unmounting) cancels it. A new draw landing must not silently drop it.
  useEffect(() => {
    const timers = retryTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [id]);

  useEffect(() => {
    if (!armed || !id) return undefined;
    const timers = pending
      .filter((e) => !tried.current.has(`${id}:${e.drawNo}`))
      .map((e) =>
        setTimeout(() => {
          tried.current.add(`${id}:${e.drawNo}`);
          postRef.current(e.drawNo);
        }, Math.max(0, drawAnnounceDueAt(e) - Date.now()))
      );
    // max(now, the draw line's time): a scratch never beats its draw's line.
    pendingScratches
      .filter((e) => !tried.current.has(`${id}:s${e.drawNo}`))
      .forEach((e) =>
        timers.push(
          setTimeout(() => {
            tried.current.add(`${id}:s${e.drawNo}`);
            postRef.current(e.drawNo, true, 'scratch');
          }, Math.max(0, drawAnnounceDueAt(e) - Date.now()))
        )
      );
    return () => timers.forEach(clearTimeout);
    // pendingKey stands in for `pending`, which is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, id, pendingKey]);

  const failed = state.roundId === id ? state.failed : {};
  const failedNos = Object.keys(failed);
  const error = failedNos.length ? failed[failedNos[0]] : null;

  const retry = useCallback(() => {
    const now = Date.now();
    (round ? round.rack || [] : []).forEach((e) => {
      if (drawAnnounceDueAt(e) == null || drawAnnounceDueAt(e) > now) return;
      if (failed[e.drawNo]) postRef.current(e.drawNo);
      if (failed[`s${e.drawNo}`]) postRef.current(e.drawNo, true, 'scratch');
    });
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
