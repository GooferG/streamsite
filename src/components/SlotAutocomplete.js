import { useState, useEffect, useRef } from 'react';
import { Dice6 } from 'lucide-react';
import rawSlots from '../data/slots';

const ALL_SLOTS = rawSlots.map((g) => ({
  id: g.id,
  name: g.name,
  provider: g.provider,
  thumbnail: g.image,
}));

export default function SlotAutocomplete({ value, onChange, onSelect, placeholder, className, onKeyDown, autoFocus, 'aria-label': ariaLabel }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!focused || !value.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const q = value.toLowerCase();
    const matches = ALL_SLOTS
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 8);
    setSuggestions(matches);
    setOpen(matches.length > 0);
  }, [value, focused]);

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function select(slot) {
    onChange(slot.name);
    if (onSelect) onSelect(slot);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
      />
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-zinc-900 border border-emerald-signal/30 rounded-lg overflow-hidden shadow-xl max-h-64 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.id}
              onMouseDown={() => select(s)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-emerald-signal/10 cursor-pointer transition-colors"
            >
              {s.thumbnail ? (
                <img
                  src={s.thumbnail}
                  alt=""
                  className="w-8 h-8 rounded object-cover flex-shrink-0 bg-white/10"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span className="w-8 h-8 rounded flex-shrink-0 bg-white/5 inline-flex items-center justify-center">
                  <Dice6 size={14} className="text-emerald-bright/50" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white-body truncate">{s.name}</p>
                {s.provider && (
                  <p className="text-xs text-white/40 truncate">{s.provider}</p>
                )}
              </div>
              <Dice6 size={12} className="text-emerald-bright/50 flex-shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
