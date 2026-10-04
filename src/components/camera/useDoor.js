import { useCallback } from 'react';
import { prefetchRoute } from '../../routes/loaders';

export function isPlainClick(e) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
}

// Props for a door's <a> (spec rule: Doors Are Links). Modifier and middle
// clicks and "open in new tab" stay native; a plain click (or Enter) hands the
// anchor to onGo. Hover, focus and touch start loading the page's chunk.
export default function useDoor(href, onGo) {
  const prefetch = useCallback(() => {
    prefetchRoute(href);
  }, [href]);
  const onClick = useCallback(
    (e) => {
      if (!onGo || !isPlainClick(e)) return;
      e.preventDefault();
      onGo(e.currentTarget);
    },
    [onGo]
  );
  return { href, onClick, onPointerEnter: prefetch, onFocus: prefetch, onTouchStart: prefetch };
}
