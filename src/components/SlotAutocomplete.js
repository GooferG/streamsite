import { useState, useEffect, useRef, useId, forwardRef, useImperativeHandle } from 'react';
import { Dice6 } from 'lucide-react';
import rawSlots from '../data/slots';

const ALL_SLOTS = rawSlots.map((g) => ({
  id: g.id,
  name: g.name,
  provider: g.provider,
  thumbnail: g.image,
}));

const SlotAutocomplete = forwardRef(function SlotAutocomplete(
  { value, onChange, onSelect, placeholder, className, onKeyDown, autoFocus, 'aria-label': ariaLabel },
  ref
) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  // -1 = nothing highlighted (typing freely); >=0 highlights a suggestion for
  // arrow/Enter/Tab selection.
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current && inputRef.current.focus(),
  }));

  useEffect(() => {
    if (!focused || !value.trim()) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    const q = value.toLowerCase();
    const matches = ALL_SLOTS
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 8);
    setSuggestions(matches);
    setOpen(matches.length > 0);
    setActiveIndex(-1); // reset highlight whenever the query changes
  }, [value, focused]);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

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
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    // Let the dropdown own navigation keys when it's open; otherwise defer
    // entirely to the parent's handler (preserves existing callers).
    if (open && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      // Enter or Tab on a highlighted row commits it. Tab still moves focus
      // afterward (we don't preventDefault on Tab) for natural form flow.
      if ((e.key === 'Enter' || e.key === 'Tab') && activeIndex >= 0) {
        if (e.key === 'Enter') e.preventDefault();
        select(suggestions[activeIndex]);
        return;
      }
    }
    if (onKeyDown) onKeyDown(e);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-zinc-900 border border-emerald-signal/30 rounded-lg overflow-hidden shadow-xl max-h-64 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              onMouseDown={() => select(s)}
              onMouseEnter={() => setActiveIndex(i)}
              aria-selected={i === activeIndex}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                i === activeIndex ? 'bg-emerald-signal/15' : 'hover:bg-emerald-signal/10'
              }`}
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
});

export default SlotAutocomplete;
