import { useRef, useState } from 'react';
import { ClipboardList, Check, X, Radio, RotateCcw, Ban, UserPlus } from 'lucide-react';
import { parseSuggestions, countSlots } from '../utils/suggestionsParse';
import { authedFetch } from '../utils/authedFetch';

const inputCls =
  'bg-zinc-broadcast/60 border border-white/10 px-3.5 py-2.5 text-sm text-white-body placeholder:text-white/50 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

// One slot pill. Click cycles the action: open → in bonus → (lands) done.
// A done pill can be reopened (e.g. mis-click). The "lands" step is delegated
// to the parent so it can prompt for a stake and push into the hunt's bonuses.
function SlotPill({ person, slot, onSetStatus, onLand }) {
  const base =
    'inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold border transition-colors duration-150 max-w-full';
  if (slot.status === 'done') {
    return (
      <button
        type="button"
        onClick={() => onSetStatus(slot.id, 'open')}
        title="Already in the hunt — click to reopen"
        className={`${base} border-emerald-signal/50 bg-emerald-signal/10 text-emerald-signal`}
      >
        <Check size={11} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{slot.name}</span>
      </button>
    );
  }
  if (slot.status === 'passed') {
    return (
      <button
        type="button"
        onClick={() => onSetStatus(slot.id, 'open')}
        title="Didn't bonus — click to reopen"
        className={`${base} border-red-destructive/40 bg-red-destructive/10 text-red-destructive/80 hover:text-red-destructive hover:border-red-destructive/60`}
      >
        <Ban size={11} aria-hidden="true" className="shrink-0" />
        <span className="truncate line-through">{slot.name}</span>
      </button>
    );
  }
  if (slot.status === 'in_bonus') {
    return (
      <span className={`${base} border-orange-admin bg-orange-admin/10 text-orange-admin`}>
        <Radio size={11} aria-hidden="true" className="shrink-0 animate-pulse" />
        <span className="truncate">{slot.name}</span>
        <button
          type="button"
          onClick={() => onLand(person, slot)}
          title="Bonus landed — add to hunt"
          className="shrink-0 ml-0.5 px-1.5 py-0.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright text-[10px] uppercase tracking-eyebrow-md font-mono leading-none"
        >
          Got in
        </button>
        <button
          type="button"
          onClick={() => onSetStatus(slot.id, 'passed')}
          title="Didn't bonus"
          className="shrink-0 px-1.5 py-0.5 border border-white/20 text-white/55 hover:text-white-body hover:border-white/40 text-[10px] uppercase tracking-eyebrow-md font-mono leading-none"
        >
          Nope
        </button>
        <button
          type="button"
          onClick={() => onSetStatus(slot.id, 'open')}
          title="Cancel — back to open"
          className="shrink-0 text-orange-admin/70 hover:text-orange-admin"
        >
          <X size={11} aria-hidden="true" />
        </button>
      </span>
    );
  }
  // open
  return (
    <button
      type="button"
      onClick={() => onSetStatus(slot.id, 'in_bonus')}
      onContextMenu={(e) => {
        e.preventDefault();
        onSetStatus(slot.id, 'passed');
      }}
      title="Click: mark in bonus · Right-click: didn't bonus"
      className={`${base} border-white/15 text-white/70 hover:text-white-body hover:border-white/35`}
    >
      <span className="truncate">{slot.name}</span>
    </button>
  );
}

// Owner control: search registered viewers who opted in and add their saved
// default slots straight into this hunt's list (source: 'roster'). Independent
// of the password link — the host is authenticated on their own hunt.
function RosterSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const debounceRef = useRef(null);

  function onQueryChange(value) {
    setQuery(value);
    setMsg(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (!q) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await authedFetch(`/api/roster/search?q=${encodeURIComponent(q)}`);
        const data = await r.json().catch(() => ({}));
        setResults(r.ok && Array.isArray(data.results) ? data.results : []);
      } catch {
        setResults([]);
      }
    }, 250);
  }

  async function add(viewer) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await authedFetch('/api/roster/add', {
        method: 'POST',
        body: JSON.stringify({ twitchId: viewer.twitchId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const map = {
          NO_ACTIVE_HUNT: 'Start a hunt first.',
          LIST_FULL: 'The list is full.',
          NOT_FOUND: 'That viewer is no longer available.',
          NO_DEFAULTS: 'That viewer has no saved slots.',
          NOT_DISCOVERABLE: 'That viewer is no longer shared.',
        };
        setMsg(map[data.error] || 'Could not add.');
      } else if (data.added === 0) {
        setMsg(`${viewer.twitchName} is already on the list.`);
      } else {
        setMsg(
          `Added ${data.added} slot${data.added === 1 ? '' : 's'} for ${viewer.twitchName}.`
        );
        setQuery('');
        setResults([]);
      }
    } catch {
      setMsg('Could not add.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-white/8 bg-zinc-broadcast/40 p-3 space-y-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono text-white/65">
        <UserPlus size={12} aria-hidden="true" className="text-purple-bright" />
        Add a registered viewer
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by name…"
        className={`w-full ${inputCls}`}
      />
      {results.length > 0 && (
        <ul className="border border-white/10 divide-y divide-white/8">
          {results.map((v) => (
            <li key={v.twitchId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-white-body truncate">{v.twitchName}</p>
                <p className="text-xs text-white/40 truncate">{v.defaultSlots.join(', ')}</p>
                {v.rainbetUsername ? (
                  <p className="text-[10px] font-mono tracking-eyebrow-md uppercase text-emerald-signal/80 truncate mt-0.5">
                    Rainbet: {v.rainbetUsername}
                  </p>
                ) : (
                  <p className="text-[10px] font-mono tracking-eyebrow-md uppercase text-white/30 truncate mt-0.5">
                    No Rainbet set
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => add(v)}
                disabled={busy}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Add
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p className="text-[11px] tracking-eyebrow uppercase text-white/55 font-mono">{msg}</p>
      )}
    </div>
  );
}

export default function SuggestionsPanel({
  suggestions,
  onImport,
  onSetStatus,
  onLand,
  onClear,
  isLoggedIn,
}) {
  const [importing, setImporting] = useState(false);
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState(null); // parsed people awaiting confirm
  const [confirmingClear, setConfirmingClear] = useState(false);

  const hasList = suggestions.length > 0;

  function doParse() {
    const parsed = parseSuggestions(raw);
    setPreview(parsed);
  }

  function resetImport() {
    setRaw('');
    setPreview(null);
    setImporting(false);
  }
  function confirm(mode) {
    if (!preview) return;
    onImport(preview, mode); // mode: 'replace' | 'merge'
    resetImport();
  }

  return (
    <div className="space-y-3" data-tour="suggestions">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 font-mono">
          <span className="inline-flex items-center gap-1.5">
            <ClipboardList size={12} aria-hidden="true" className="text-purple-bright" />
            <span>Suggestions</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setImporting((v) => !v);
            setPreview(null);
          }}
          className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono px-2 py-1 border border-white/15 text-white/65 hover:text-white-body hover:border-white/30 transition-colors"
        >
          {importing ? 'Close' : hasList ? 'Import more' : 'Import from sheet'}
        </button>
      </div>

      {/* Owner: add a registered viewer's saved default slots */}
      {isLoggedIn && <RosterSearch />}

      {/* Import flow */}
      {importing && (
        <div className="border border-white/8 bg-zinc-broadcast/40 p-3 space-y-2">
          {!preview ? (
            <>
              <p className="text-[11px] text-white/55 leading-snug">
                Copy the cells from your Google Sheet (Name + Slot columns) and paste
                below. Header row and empty cells are handled automatically.
              </p>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={5}
                placeholder={'Name\tSlot 1\tSlot 2\ncirno\tzeus vs typhon\tle bandit'}
                className={`w-full ${inputCls} resize-none font-mono text-xs`}
              />
              <button
                type="button"
                onClick={doParse}
                disabled={!raw.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-gamba text-white-body hover:bg-purple-bright transition-colors duration-150 disabled:opacity-40"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Preview
                </span>
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold tracking-eyebrow-lg uppercase text-white/65 font-mono">
                {preview.length} {preview.length === 1 ? 'person' : 'people'} ·{' '}
                {countSlots(preview)} slots
              </p>
              <div className="max-h-48 overflow-y-auto border border-white/8 [scrollbar-width:thin]">
                {preview.length === 0 ? (
                  <p className="text-center text-white/50 py-4 text-[11px] font-mono">
                    Nothing parsed — check the paste.
                  </p>
                ) : (
                  preview.map((p) => (
                    <div key={p.id} className="px-3 py-2 border-b border-white/5 last:border-b-0">
                      <p className="text-xs font-bold text-white-body mb-1">{p.person}</p>
                      <p className="text-[11px] text-white/55 leading-snug">
                        {p.slots.map((s) => s.name).join(' · ')}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {hasList && (
                  <button
                    type="button"
                    onClick={() => confirm('merge')}
                    disabled={preview.length === 0}
                    className="flex-1 px-3 py-2 border border-emerald-signal/40 text-emerald-signal hover:bg-emerald-signal/10 transition-colors disabled:opacity-40"
                  >
                    <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                      Add to list
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => confirm('replace')}
                  disabled={preview.length === 0}
                  className="flex-1 px-3 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors disabled:opacity-40"
                >
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                    {hasList ? 'Replace list' : 'Import'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-3 py-2 border border-white/10 text-white/60 hover:text-white-body transition-colors"
                >
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                    Back
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* List */}
      {!hasList ? (
        !importing && (
          <p className="text-center text-white/60 py-4 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
            No suggestions imported.
          </p>
        )
      ) : (
        <>
          <div className="border border-white/8 bg-zinc-broadcast/40 divide-y divide-white/5">
            {suggestions.map((p) => (
              <div key={p.id} className="px-3 py-2.5">
                <p className="text-[11px] font-bold tracking-eyebrow-md uppercase text-purple-bright font-mono mb-1.5 truncate">
                  {p.person}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {p.slots.map((s) => (
                    <SlotPill
                      key={s.id}
                      person={p.person}
                      slot={s}
                      onSetStatus={onSetStatus}
                      onLand={onLand}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {confirmingClear ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setConfirmingClear(false);
                }}
                className="flex-1 px-3 py-1.5 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 transition-colors"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Clear all suggestions
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="px-3 py-1.5 border border-white/10 text-white/60 hover:text-white-body transition-colors"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Keep
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono text-white/40 hover:text-red-destructive transition-colors"
            >
              <RotateCcw size={11} aria-hidden="true" />
              Clear
            </button>
          )}
        </>
      )}
    </div>
  );
}
