import { useEffect, useState } from 'react';

// A Twitch avatar that falls back to the name's initial when the image is
// missing or fails to load. Size and colours come from className.
export default function ViewerAvatar({ src, name, className = '' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <span className={`grid flex-none place-items-center overflow-hidden rounded-full font-extrabold ${className}`}>
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
