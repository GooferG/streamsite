import { useState } from 'react';
import { MONO } from '../onAir/classes';

// The show's art: the IGDB cover (or the live thumbnail), else a card with the
// category set in type. Slots shows have no cover.
export default function ShowArt({ cover, word, wide = false }) {
  const [failed, setFailed] = useState(false);
  const shape = wide ? 'aspect-video' : 'aspect-[3/4]';
  if (cover && !failed) {
    return (
      <img
        src={cover}
        alt=""
        data-testid="show-cover"
        onError={() => setFailed(true)}
        className={`${shape} w-full rounded-onair-inner object-cover shadow-onair-row`}
      />
    );
  }
  return (
    <div
      data-testid="show-ident"
      aria-hidden="true"
      className={`${shape} relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-onair-inner bg-gradient-to-b from-onair-surface-1 to-onair-surface-4 shadow-onair-row`}
    >
      <span className="absolute inset-0 bg-onair-scanlines" />
      <span className="relative max-w-full break-words px-2 text-center text-[1.25rem] font-extrabold leading-none tracking-[-0.02em] text-onair-screen-ink sm:text-[1.5rem]">
        {word}
      </span>
      {/* A phone's card is too narrow for the station name. */}
      <span className={`${MONO} relative hidden text-[0.625rem] tracking-[0.3em] text-onair-screen-dim sm:inline`}>Goofer·vision</span>
    </div>
  );
}
