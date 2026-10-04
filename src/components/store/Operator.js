import { useState } from 'react';
import { OPERATOR } from './storeArt';

// The GSN operator: set dressing for the order moment (aria-hidden; the
// visible text carries the meaning). Renders nothing until the art exists.
export default function Operator({ pose, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={OPERATOR[pose]}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      className={`object-cover shadow-onair-card ${className}`}
    />
  );
}
