import { useState } from 'react';

const POSES = {
  restock: '/gsn/video/clerk-restock.webp',
  asleep: '/gsn/video/clerk-asleep.webp',
};

// The night clerk: set dressing for the loading and empty floor (DESIGN.md §7,
// Video store). Always aria-hidden; the text beside it says what is going on.
// Until the art is committed (or if it fails to load) it bows out.
export default function Clerk({ pose, className = '' }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <img
      src={POSES[pose]}
      alt=""
      aria-hidden="true"
      width={240}
      height={300}
      onError={() => setMissing(true)}
      data-testid={`clerk-${pose}`}
      className={`rounded-onair-inner shadow-onair-card ${className}`}
    />
  );
}
