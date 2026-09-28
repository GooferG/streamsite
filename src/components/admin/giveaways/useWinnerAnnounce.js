import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAT_ANNOUNCE_DELAY_MS, pickKey, tsMillis } from '../../../utils/giveaway';
import { postAction, QUIET_ANNOUNCE } from './api';

// Posts the winner in chat once the reveal has played on stream, then shows
// where that stands. Retry appears if Twitch refused the message. Runs above
// the winner window: a bonus-buy winner confirmed quickly moves to 'playing'
// and closes that window before the timer fires.
export default function useWinnerAnnounce(giveaway) {
  const key = pickKey(giveaway);
  const rolledAtMs = tsMillis(giveaway?.rolledAt);
  const enabled = !!giveaway && giveaway.announceWinner !== false && !!giveaway.winnerMessage;
  const posted = !!key && giveaway?.announcedPick === key;
  const id = giveaway?.id;
  const winnerTwitchId = giveaway?.winnerTwitchId;
  const [state, setState] = useState({ key: null, posting: false, error: null });

  const post = useCallback(async () => {
    setState({ key, posting: true, error: null });
    try {
      const { ok, status, data } = await postAction('announce', {
        id,
        winnerTwitchId,
        rolledAtMs,
      });
      if (status === 409) return setState({ key, posting: false, error: null }); // pick moved on
      const failed = !ok || (data.announce?.posted === false && !QUIET_ANNOUNCE.includes(data.announce.reason));
      setState({
        key,
        posting: false,
        error: failed ? data.announce?.reason || data.error || 'unknown' : null,
      });
    } catch {
      setState({ key, posting: false, error: 'Network error' });
    }
  }, [key, id, winnerTwitchId, rolledAtMs]);

  // One timer per pick. A reroll or skip changes the key and cancels it.
  const postRef = useRef(post);
  postRef.current = post;
  const alreadyPosted = useRef(posted);
  alreadyPosted.current = posted;
  useEffect(() => {
    if (!key || !enabled || alreadyPosted.current) return undefined;
    const delay = Math.max(0, rolledAtMs + CHAT_ANNOUNCE_DELAY_MS - Date.now());
    const t = setTimeout(() => {
      if (!alreadyPosted.current) postRef.current();
    }, delay);
    return () => clearTimeout(t);
  }, [key, enabled, rolledAtMs]);

  const mine = state.key === key;
  return {
    enabled,
    posted,
    posting: mine && state.posting,
    error: mine ? state.error : null,
    dueAt: rolledAtMs != null ? rolledAtMs + CHAT_ANNOUNCE_DELAY_MS : null,
    retry: post,
  };
}
