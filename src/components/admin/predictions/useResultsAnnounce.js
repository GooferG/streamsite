import { useCallback, useEffect, useRef, useState } from 'react';
import { STREAM_DELAY_MS } from '../../../utils/giveaway';
import { roundsAction, announceFailure } from './shared';

// Only a fresh settle posts on its own. Older results post through Retry, so
// opening the admin page hours later can't post stale winners to chat.
export const AUTO_POST_WINDOW_MS = 5 * 60 * 1000;

function toMs(ts) {
  return ts && ts.toMillis ? ts.toMillis() : null;
}

// Posts a settled round's results to chat once the stream has caught up with
// the reveal (chat runs STREAM_DELAY_MS ahead of the video). The server claims
// the post, so several open admin tabs still post once. Each round gets one
// automatic attempt; after that it's Retry.
export default function useResultsAnnounce(round) {
  const [state, setState] = useState({ roundId: null, posting: false, error: null });
  const tried = useRef(new Set());
  const id = round ? round.id : null;
  const settledMs = toMs(round && round.settledAt);
  const armed =
    !!round &&
    round.status === 'settled' &&
    !!round.announce &&
    !(round.announced && round.announced.results) &&
    settledMs != null;
  const dueAt = armed ? settledMs + STREAM_DELAY_MS : null;

  const post = useCallback(async () => {
    if (!id) return;
    setState({ roundId: id, posting: true, error: null });
    const { ok, data } = await roundsAction({ action: 'announce', id, event: 'results' });
    setState({ roundId: id, posting: false, error: announceFailure(ok, data) });
  }, [id]);

  useEffect(() => {
    if (!armed || tried.current.has(id)) return undefined;
    if (Date.now() - settledMs > AUTO_POST_WINDOW_MS) return undefined;
    const t = setTimeout(() => {
      tried.current.add(id);
      post();
    }, Math.max(0, dueAt - Date.now()));
    return () => clearTimeout(t);
  }, [armed, id, settledMs, dueAt, post]);

  const mine = state.roundId === id;
  return {
    dueAt,
    posting: mine && state.posting,
    error: mine ? state.error : null,
    retry: post,
  };
}
