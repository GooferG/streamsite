import { useState, useEffect, useRef } from 'react';
import { Gamepad2 } from 'lucide-react';

let cachedGames = null;

async function fetchGames() {
  if (cachedGames) return cachedGames;
  try {
    const res = await fetch('/api/steam-games');
    if (!res.ok) return [];
    const data = await res.json();
    cachedGames = data.games || [];
    return cachedGames;
  } catch {
    return [];
  }
}

export default function GameAutocomplete({ value, onChange, placeholder, className }) {
  const [games, setGames] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchGames().then(setGames);
  }, []);

  useEffect(() => {
    if (!focused || !value.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const q = value.toLowerCase();
    const matches = games
      .filter(g => g.name.toLowerCase().includes(q))
      .slice(0, 8);
    setSuggestions(matches);
    setOpen(matches.length > 0);
  }, [value, games, focused]);

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function select(name) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={className}
      />
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-zinc-900 border border-emerald-500/30 rounded-lg overflow-hidden shadow-xl max-h-64 overflow-y-auto">
          {suggestions.map(g => (
            <li
              key={g.appid}
              onMouseDown={() => select(g.name)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-emerald-500/10 cursor-pointer transition-colors"
            >
              {g.img_logo_url && (
                <img
                  src={g.img_logo_url}
                  alt=""
                  className="w-8 h-8 rounded object-cover flex-shrink-0 bg-white/10"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <span className="text-sm text-white truncate">{g.name}</span>
              <Gamepad2 size={12} className="text-emerald-400/50 flex-shrink-0 ml-auto" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
