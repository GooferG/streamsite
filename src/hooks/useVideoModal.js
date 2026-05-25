import { useCallback, useState } from 'react';

/**
 * Manages the state for a single VideoModal at the page level.
 *
 * Usage:
 *   const { open, close, current } = useVideoModal();
 *   ...
 *   <ClipCard clip={clip} onPlay={open} />
 *   <VideoModal video={current} onClose={close} />
 *
 * Pass an object: { id, type: 'vod' | 'clip', title, game, views, duration, twitchUrl, tape }
 */
export function useVideoModal() {
  const [current, setCurrent] = useState(null);

  const open = useCallback((video) => {
    if (!video || !video.id) return;
    setCurrent(video);
  }, []);

  const close = useCallback(() => {
    setCurrent(null);
  }, []);

  return { current, open, close };
}
