import { useEffect, useState } from 'react';
import { getGameNames, getTwitchAccessToken, getTwitchClipsBetween, getTwitchUserId } from '../../utils/twitchApi';
import { ARCHIVE_DAYS } from './videoStoreModel';

const DAY_MS = 86400000;

// The last ARCHIVE_DAYS of clips, fetched once per visit to /vods. App's poll
// only carries the all-time top 20, mostly from 2016 to 2018, and this isn't
// worth adding to every visitor's 120s poll. [] while loading or on failure:
// Fresh picks then falls back to the recent clips in the top 20.
export default function useRecentClips() {
  const [clips, setClips] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getTwitchAccessToken();
        const userId = await getTwitchUserId(token);
        const now = Date.now();
        const found = await getTwitchClipsBetween(
          token,
          userId,
          new Date(now - ARCHIVE_DAYS * DAY_MS).toISOString(),
          new Date(now).toISOString()
        );
        const names = await getGameNames(token, found.map((c) => c.game_id));
        if (!cancelled) setClips(found.map((c) => ({ ...c, game_name: names[c.game_id] || '' })));
      } catch {
        // App's top clips still fill Fresh picks.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return clips;
}
