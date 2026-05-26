import { useEffect, useRef, useState } from 'react';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function format(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export function useSessionTimecode() {
  const startRef = useRef(Date.now());
  const [text, setText] = useState('00:00:00');

  useEffect(() => {
    const tick = () => {
      const seconds = Math.floor((Date.now() - startRef.current) / 1000);
      setText(format(seconds));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return text;
}
