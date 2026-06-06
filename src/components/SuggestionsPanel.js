import { useRef, useState } from 'react';
import { ClipboardList, RotateCcw, UserPlus } from 'lucide-react';
import { parseSuggestions, countSlots } from '../utils/suggestionsParse';
import { authedFetch } from '../utils/authedFetch';

const inputCls =
  'bg-zinc-broadcast/60 border border-white/10 px-3.5 py-2.5 text-sm text-white-body placeholder:text-white/50 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

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
      <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-white/65">
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
                  <p className="text-[0.625rem] font-mono tracking-eyebrow-md uppercase text-emerald-signal/80 truncate mt-0.5">
                    Rainbet: {v.rainbetUsername}
                  </p>
                ) : (
                  <p className="text-[0.625rem] font-mono tracking-eyebrow-md uppercase text-white/30 truncate mt-0.5">
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
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Add
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p className="text-[0.6875rem] tracking-eyebrow uppercase text-white/55 font-mono">{msg}</p>
      )}
    </div>
  );
}

// Intake controls for the viewer-call list: import-from-sheet, add a registered
// viewer, and clear. The list itself (and its triage) lives in ViewerCalls now —
// this only feeds slots in. Rendered inside ViewerCalls via its intakeControls
// slot so every suggestion shows in exactly one place.
export default function SuggestionsPanel({
  suggestions,
  onImport,
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
        <div className="flex items-center gap-3 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-white/65 font-mono">
          <span className="inline-flex items-center gap-1.5">
            <ClipboardList size={12} aria-hidden="true" className="text-purple-bright" />
            <span>Add calls</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setImporting((v) => !v);
              setPreview(null);
            }}
            className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono px-2 py-1 border border-white/15 text-white/65 hover:text-white-body hover:border-white/30 transition-colors"
          >
            {importing ? 'Close' : hasList ? 'Import more' : 'Import from sheet'}
          </button>
          {hasList &&
            (confirmingClear ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setConfirmingClear(false);
                  }}
                  className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono px-2 py-1 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 transition-colors"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono px-2 py-1 border border-white/10 text-white/60 hover:text-white-body transition-colors"
                >
                  Keep
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="inline-flex items-center gap-1.5 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono px-2 py-1 border border-white/15 text-white/40 hover:text-red-destructive hover:border-red-destructive/40 transition-colors"
              >
                <RotateCcw size={11} aria-hidden="true" />
                Clear
              </button>
            ))}
        </div>
      </div>

      {/* Owner: add a registered viewer's saved default slots */}
      {isLoggedIn && <RosterSearch />}

      {/* Import flow */}
      {importing && (
        <div className="border border-white/8 bg-zinc-broadcast/40 p-3 space-y-2">
          {!preview ? (
            <>
              <p className="text-[0.6875rem] text-white/55 leading-snug">
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
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Preview
                </span>
              </button>
            </>
          ) : (
            <>
              <p className="text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase text-white/65 font-mono">
                {preview.length} {preview.length === 1 ? 'person' : 'people'} ·{' '}
                {countSlots(preview)} slots
              </p>
              <div className="max-h-48 overflow-y-auto border border-white/8 [scrollbar-width:thin]">
                {preview.length === 0 ? (
                  <p className="text-center text-white/50 py-4 text-[0.6875rem] font-mono">
                    Nothing parsed — check the paste.
                  </p>
                ) : (
                  preview.map((p) => (
                    <div key={p.id} className="px-3 py-2 border-b border-white/5 last:border-b-0">
                      <p className="text-xs font-bold text-white-body mb-1">{p.person}</p>
                      <p className="text-[0.6875rem] text-white/55 leading-snug">
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
                    <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
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
                  <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                    {hasList ? 'Replace list' : 'Import'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-3 py-2 border border-white/10 text-white/60 hover:text-white-body transition-colors"
                >
                  <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                    Back
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
