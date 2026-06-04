import { useEffect, useRef, useState } from 'react';

// Late-night broadcast loading copy. A CRT warms up; it doesn't just spin.
// Rotates an eyebrow phrase on a slow interval while `active` is true.
// Text-only — reduced-motion safe by construction (no animation).
export const TUNING_PHRASES = [
  'Tuning signal…',
  'Warming the tubes…',
  'Acquiring feed…',
];

export default function useTuningPhrase(active, phrases = TUNING_PHRASES, intervalMs = 1400) {
  const [index, setIndex] = useState(0);

  // Keep the latest phrases without making them an effect dependency, so callers
  // can pass an inline array (`[label, ...TUNING_PHRASES]`) without resetting the
  // rotation every render. The effect re-keys on the content, not the identity.
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;
  const phrasesKey = phrases.join('|');

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return undefined;
    }
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % phrasesRef.current.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, phrasesKey, intervalMs]);

  return phrasesRef.current[index] ?? phrasesRef.current[0];
}
