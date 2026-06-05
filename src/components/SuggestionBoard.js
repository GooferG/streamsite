// src/components/SuggestionBoard.js
import { Check, X, Radio } from 'lucide-react';

// Public, read-only board of everyone's suggested slots + got-in/skipped/pending
// status. Driven by the projected board from /api/hunt-suggest/board.
function StatusChip({ status }) {
  if (status === 'in') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono text-emerald-signal">
        <Check size={11} aria-hidden="true" /> Got in
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono text-red-destructive/80">
        <X size={11} aria-hidden="true" /> Skipped
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-eyebrow-md font-mono text-white/45">
      — Pending
    </span>
  );
}

export default function SuggestionBoard({ board, loading, myName, refreshSeconds = 12 }) {
  const me = String(myName || '').trim().toLowerCase();
  const groups = Array.isArray(board) ? board : [];
  const totalPicks = groups.reduce((n, g) => n + (g.slots?.length || 0), 0);
  const inCount = groups.reduce(
    (n, g) => n + (g.slots || []).filter((s) => s.status === 'in').length,
    0
  );

  return (
    <div className="border border-white/8 bg-zinc-card/40 flex flex-col max-h-[70vh]">
      <div className="px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
          <Radio size={13} className="text-purple-bright" aria-hidden="true" />
          <span className="text-purple-bright">Suggestions so far</span>
          {groups.length > 0 && (
            <span className="ml-auto text-white/45 tabular-nums">
              {totalPicks} picks · {inCount} in
            </span>
          )}
        </div>
        <p className="text-[10px] font-mono text-white/35 mt-1">
          Refreshes every {refreshSeconds}s.
        </p>
      </div>

      <div className="overflow-y-auto [scrollbar-width:thin] flex-1">
        {loading && !groups.length ? (
          <p className="text-center text-white/45 py-10 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
            Loading…
          </p>
        ) : groups.length === 0 ? (
          <p className="text-center text-white/50 py-10 text-[12px] font-mono">
            No picks yet — be the first.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {groups.map((g, gi) => {
              const isMe = me && String(g.person || '').trim().toLowerCase() === me;
              return (
                <li
                  key={`${g.person}-${gi}`}
                  className={`px-4 py-2.5 ${isMe ? 'ring-1 ring-emerald-signal/40 bg-emerald-signal/[0.04]' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-bold tracking-eyebrow-md uppercase text-purple-bright font-mono truncate">
                      {g.person}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-bold uppercase tracking-eyebrow-md font-mono text-emerald-signal border border-emerald-signal/40 px-1 leading-tight">
                        you
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {(g.slots || []).map((s, si) => (
                      <li key={si} className="flex items-center justify-between gap-2">
                        <span className="text-[13px] text-white-body truncate">{s.name}</span>
                        <StatusChip status={s.status} />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
