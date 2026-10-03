import { useState } from 'react';
import { prefersReducedMotion } from './useChannelSwitch';

const DIGITS = '0123456789'.split('');

// A balance that rolls like an odometer: one 0–9 strip per digit, moved with
// translateY. Columns are keyed from the right, so the units column stays the
// same element when the number gains or loses a digit. Screen readers get the
// plain number; reduced motion gets only the plain number.
export default function RollingNumber({ value, className = '' }) {
  const [reduce] = useState(prefersReducedMotion);
  const text = value == null ? '—' : Number(value).toLocaleString('en-US');
  if (reduce || value == null) return <span className={`tabular-nums ${className}`}>{text}</span>;
  const chars = [...text];
  return (
    <span className={`relative inline-flex leading-none tabular-nums ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex">
        {chars.map((ch, i) => {
          const key = chars.length - i;
          if (!/\d/.test(ch)) return <span key={`s${key}`}>{ch}</span>;
          return (
            <span key={key} className="relative inline-block h-[1em] overflow-hidden">
              <span
                data-digit={ch}
                className="block transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
                style={{ transform: `translateY(-${ch}em)` }}
              >
                {DIGITS.map((d) => (
                  <span key={d} className="block h-[1em]">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
