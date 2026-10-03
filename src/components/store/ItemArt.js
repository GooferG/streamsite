import { useState } from 'react';
import { MONO } from '../onAir/classes';

// Item art in a scanlined frame, so mixed imagery (photos, logos, generated
// art) reads as one channel. No image, or a broken one, shows the channel
// number. Key it by item id so a new item gets a fresh load attempt.
export default function ItemArt({ item, className = '', eager = false, dim = false }) {
  const [failed, setFailed] = useState(false);
  const src = item && item.imageUrl && !failed ? item.imageUrl : null;
  return (
    <span className={`relative block overflow-hidden bg-onair-surface-4 ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${dim ? 'opacity-40 grayscale' : ''}`}
        />
      ) : (
        <span className={`${MONO} flex h-full w-full items-center justify-center text-sm tracking-[0.2em] text-onair-ink-5`}>
          {item ? item.channel : ''}
        </span>
      )}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-onair-scanlines mix-blend-screen" />
    </span>
  );
}
