import { useState } from 'react';
import { Swords, Trophy, Ticket, X } from 'lucide-react';
import SlotAutocomplete from './SlotAutocomplete';
import BattleWheel from './BattleWheel';
import CopyLinkButton from './CopyLinkButton';
import { useBattleStore } from '../hooks/useBattleStore';
import { computeBattle, currency } from '../utils/battleCalc';

// Shared input styling so the slot autocomplete reads the same as the name
// input (it only applies the className it's given — without this it renders
// white-on-white).
const INPUT_CLS =
  'w-full bg-black/30 border border-white/10 text-white-body placeholder-white/40 text-sm px-3 py-2.5 font-mono focus:outline-none focus:border-emerald-signal/60';

// ---- Shared presentational board. `interactive` toggles admin controls. ----
// Exported so BattlePage can render the identical board read-only.
export function BattleBoard({
  battle,
  players,
  derived,
  interactive = false,
  // interactive-only handlers:
  onAddPlayer,
  onRemovePlayer,
  onSetPayout,
  onSpinResult,
  onSetRake,
  onSetEntryFee,
  onLockEntries,
  onUnlockEntries,
}) {
  const [name, setName] = useState('');
  const [slot, setSlot] = useState('');
  const [payoutInput, setPayoutInput] = useState('');

  const current = players.find((p) => p.id === battle?.currentPlayerId) || null;
  const unplayed = players.filter((p) => !p.ran);
  const rakePct = battle?.rakePct ?? 10;
  const sorted = [...players].sort((a, b) => (b.payout || 0) - (a.payout || 0));

  // Phase: 'lobby' = signups open; 'running' = entries locked, bonuses playing.
  const phase = battle?.phase || 'lobby';
  const lobby = phase === 'lobby';
  // Add-player UI shows only while interactive AND in the lobby.
  const showAdd = interactive && lobby;

  const submitPlayer = () => {
    if (!name.trim()) return;
    onAddPlayer?.({ name, slot });
    setName('');
    setSlot('');
  };
  const submitPayout = () => {
    if (!current) return;
    onSetPayout?.(current.id, payoutInput === '' ? 0 : payoutInput);
    setPayoutInput('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr_360px] gap-4 items-start">
      {/* ----- LEFT (desktop) / order-3 (mobile): Players & Pot ----- */}
      <div className="order-3 lg:order-1 border border-white/8 bg-zinc-card/50 p-5">
        <p className="text-xs font-bold tracking-eyebrow-lg uppercase text-white/60 mb-4 flex items-center gap-2">
          <Swords size={14} className="text-emerald-signal" /> Players &amp; Pot
        </p>
        <div className="relative overflow-hidden border border-purple-gamba/70 bg-purple-gamba/10 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] tracking-eyebrow-md uppercase text-purple-bright">Total Pot</div>
            <div className="text-[10px] tracking-eyebrow-sm uppercase text-white/55 tabular-nums">
              {currency(derived.entryFee)} entry
            </div>
          </div>
          {/* Hero number with a faded ghost layer behind it (leaderboard look). */}
          <div className="relative mt-1 leading-none">
            <span
              className="absolute -top-1 -left-0.5 text-[3.5rem] sm:text-[4rem] font-extrabold tabular-nums font-mono text-purple-gamba/15 leading-none select-none pointer-events-none"
              aria-hidden="true"
            >
              {currency(derived.totalPot)}
            </span>
            <span className="relative block text-[3.5rem] sm:text-[4rem] font-extrabold tabular-nums font-mono text-white-body leading-none">
              {currency(derived.totalPot)}
            </span>
          </div>
          <div className="text-[10px] tracking-eyebrow-sm uppercase text-white/45 mt-1.5 tabular-nums">
            {currency(derived.entryFee)} × {derived.total} {derived.total === 1 ? 'player' : 'players'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat n={derived.total} k="Total" border="border-amber-rust/60" text="text-amber-rust" />
          <Stat n={derived.ran} k="Ran" border="border-emerald-signal/60" text="text-emerald-signal" />
          <Stat n={derived.left} k="Left" border="border-white/10" text="text-crt-amber" />
        </div>

        {showAdd && (
          <div className="space-y-2 mb-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name"
              className={INPUT_CLS}
            />
            <SlotAutocomplete
              value={slot}
              onChange={setSlot}
              placeholder="Slot pick…"
              className={INPUT_CLS}
            />
            <button
              type="button"
              onClick={submitPlayer}
              className="w-full px-3 py-2.5 bg-white/10 hover:bg-white/15 text-white-body text-[11px] font-bold tracking-eyebrow-md uppercase font-mono transition-colors"
            >
              + Add player
            </button>
          </div>
        )}

        {/* Roster. In the running phase rows are larger (no add UI competing
            for space) and show a play-order index. */}
        <div className="space-y-2">
          {players.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 border border-white/7 ${
                lobby ? 'px-3 py-2.5' : 'px-3 py-3.5'
              } ${p.ran ? '' : 'opacity-70'} ${current && current.id === p.id ? 'border-amber-rust/60 bg-amber-rust/5' : ''}`}
            >
              {!lobby && (
                <span className="text-[11px] font-black text-white/30 tabular-nums w-5">{i + 1}</span>
              )}
              <span className={`font-bold text-white-body truncate ${lobby ? 'text-sm' : 'text-base'}`}>{p.name}</span>
              {p.slot && <span className="text-[10px] uppercase text-white/50 tracking-eyebrow-sm truncate">· {p.slot}</span>}
              {!lobby && !p.ran && current?.id !== p.id && (
                <span className="text-[9px] tracking-eyebrow-sm uppercase text-white/35">waiting</span>
              )}
              <span className={`ml-auto font-black tabular-nums ${lobby ? 'text-sm' : 'text-base'} ${p.ran ? 'text-emerald-signal' : 'text-white/40'}`}>
                {p.ran ? currency(p.payout) : '—'}
              </span>
              {showAdd && (
                <button type="button" onClick={() => onRemovePlayer?.(p.id)} aria-label={`Remove ${p.name}`} className="text-white/30 hover:text-red-destructive">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-xs text-white/40 font-mono py-4 text-center">No players yet.</p>
          )}
        </div>

        {/* Lock / unlock the lineup. */}
        {interactive && lobby && (
          <button
            type="button"
            onClick={onLockEntries}
            disabled={players.length === 0}
            className="w-full mt-4 px-4 py-3.5 bg-purple-gamba hover:bg-purple-bright text-white text-xs font-black tracking-eyebrow-lg uppercase font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🔒 Lock entries &amp; start battle
          </button>
        )}
        {interactive && !lobby && (
          <button
            type="button"
            onClick={onUnlockEntries}
            className="w-full mt-4 px-4 py-2.5 border border-white/15 text-white/55 hover:text-white-body hover:border-white/30 text-[10px] font-bold tracking-eyebrow-md uppercase font-mono transition-colors"
          >
            Unlock entries
          </button>
        )}

        {/* Payout entry — running phase only, for the current player. */}
        {interactive && !lobby && current && (
          <div className="border border-dashed border-emerald-signal/40 p-4 mt-4">
            <div className="text-[11px] tracking-eyebrow-md uppercase text-emerald-signal mb-2">
              {current.name} — How much did it pay?
            </div>
            <input
              value={payoutInput}
              onChange={(e) => setPayoutInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPayout()}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full bg-black/30 border border-white/12 text-white-body text-lg px-3 py-2.5 font-mono tabular-nums focus:outline-none focus:border-emerald-signal"
            />
            <button
              type="button"
              onClick={submitPayout}
              className="w-full mt-2.5 px-3 py-3.5 bg-emerald-signal text-zinc-950 text-sm font-black tracking-eyebrow-md uppercase font-mono hover:opacity-90 transition-opacity"
            >
              ✓ Save Payout
            </button>
          </div>
        )}
      </div>

      {/* ----- CENTER (desktop) / order-1 (mobile): Action ----- */}
      <div className="order-1 lg:order-2 border border-white/8 bg-zinc-card/50 p-5">
        {lobby ? (
          // Lobby: signups open. No wheel, no payout — just the call to add
          // players and lock in.
          <div className="text-center py-6">
            <p className="text-[13px] tracking-eyebrow-lg uppercase text-purple-bright mb-2">Signups open</p>
            <div className="border border-white/10 bg-zinc-broadcast h-44 sm:h-52 flex flex-col items-center justify-center gap-2.5 font-mono px-4">
              <span className="text-5xl font-black text-white-body tabular-nums leading-none">{derived.total}</span>
              <span className="text-sm sm:text-base tracking-eyebrow-sm uppercase text-white/70">
                {derived.total === 1 ? 'player' : 'players'} entered · pot{' '}
                <span className="text-emerald-signal font-bold tabular-nums">{currency(derived.totalPot)}</span>
              </span>
              <span className="text-base sm:text-lg font-bold text-white-body mt-1 text-center">
                {interactive ? 'Add players, then lock entries to start.' : 'Waiting for the host to start the battle…'}
              </span>
            </div>
          </div>
        ) : (
          <>
            <p className="text-center text-[13px] tracking-eyebrow-lg uppercase text-purple-bright mb-2">
              Who plays next?
            </p>
            {interactive ? (
              <BattleWheel players={unplayed} onResult={onSpinResult} disabled={unplayed.length === 0} />
            ) : (
              <div className="border border-white/10 bg-zinc-broadcast h-56 flex items-center justify-center text-white/50 font-mono text-sm">
                {current ? `Now playing: ${current.name}` : 'Waiting for the host to spin…'}
              </div>
            )}
          </>
        )}
        {!lobby && current && (
          <div className="border border-amber-rust/60 bg-amber-rust/10 p-4 mt-5 text-center">
            <div className="text-[11px] tracking-eyebrow-md uppercase text-amber-rust">Now Playing</div>
            <div className="text-2xl font-black text-white-body mt-1">{current.name}</div>
            {current.slot && <div className="text-[12px] uppercase text-white/70 tracking-eyebrow-sm mt-1">{current.slot}</div>}
          </div>
        )}
      </div>

      {/* ----- RIGHT (desktop) / order-4 (mobile): Standings ----- */}
      <div className="order-4 lg:order-3 border border-white/8 bg-zinc-card/50 p-5">
        <p className="text-xs font-bold tracking-eyebrow-lg uppercase text-white/60 mb-4 flex items-center gap-2">
          <Trophy size={14} className="text-crt-amber" /> Standings
        </p>
        <div className="space-y-2">
          {sorted.filter((p) => p.ran).map((p, i) => {
            const isWin = derived.winner && p.id === derived.winner.id;
            const isLose = derived.loser && p.id === derived.loser.id && derived.ran > 1;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2.5 border px-3 py-2.5 ${
                  isWin ? 'border-emerald-signal/60' : isLose ? 'border-red-destructive/60' : 'border-white/7'
                }`}
              >
                <span className="text-base font-black text-crt-amber w-5 tabular-nums">{i + 1}</span>
                <span className="text-sm font-bold text-white-body truncate">{p.name}</span>
                {p.slot && <span className="text-[10px] uppercase text-white/45 truncate">· {p.slot}</span>}
                <span className={`ml-auto text-base font-black tabular-nums ${isWin ? 'text-emerald-signal' : isLose ? 'text-red-destructive' : 'text-white-body'}`}>
                  {currency(p.payout)}
                </span>
              </div>
            );
          })}
          {derived.ran === 0 && <p className="text-xs text-white/40 font-mono py-4 text-center">No payouts entered yet.</p>}
        </div>

        <div className="relative overflow-hidden border border-purple-gamba/70 bg-purple-gamba/10 p-4 mt-4 text-center">
          <div className="text-[12px] tracking-eyebrow-md uppercase text-purple-bright flex items-center justify-center gap-1.5">
            <Trophy size={13} /> Winner Takes All
          </div>
          {/* Hero prize number with ghost layer behind. */}
          <div className="relative my-2 leading-none">
            <span
              className="absolute inset-0 flex items-center justify-center text-[3.25rem] sm:text-[3.75rem] font-extrabold tabular-nums font-mono text-purple-gamba/15 leading-none select-none pointer-events-none"
              aria-hidden="true"
            >
              {currency(derived.potAfterRake)}
            </span>
            <span className="relative block text-[3.25rem] sm:text-[3.75rem] font-extrabold tabular-nums font-mono text-white-body leading-none">
              {currency(derived.potAfterRake)}
            </span>
          </div>
          <div className="text-[12px] text-white/55 tabular-nums">
            Pot {currency(derived.totalPot)} − {rakePct}% rake ({currency(derived.rakeAmount)})
          </div>
          <div className="text-[10px] text-white/40 tabular-nums mt-0.5">
            {currency(derived.totalPayouts)} paid out across {derived.ran} {derived.ran === 1 ? 'bonus' : 'bonuses'}
          </div>
          {interactive && (
            <div className="flex items-center justify-center gap-4 mt-3">
              <label className="text-[10px] tracking-eyebrow-md uppercase text-white/50">
                Entry $
                <input
                  type="number"
                  value={derived.entryFee}
                  onChange={(e) => onSetEntryFee?.(e.target.value)}
                  className="ml-2 w-16 bg-black/30 border border-white/12 text-white-body text-sm px-2 py-1 font-mono tabular-nums"
                />
              </label>
              <label className="text-[10px] tracking-eyebrow-md uppercase text-white/50">
                Rake %
                <input
                  type="number"
                  value={rakePct}
                  onChange={(e) => onSetRake?.(e.target.value)}
                  className="ml-2 w-16 bg-black/30 border border-white/12 text-white-body text-sm px-2 py-1 font-mono tabular-nums"
                />
              </label>
            </div>
          )}
        </div>
        <div className="border border-red-destructive/50 bg-red-destructive/10 p-3 mt-2.5 text-center text-[12px] tracking-eyebrow-sm uppercase text-red-destructive/90 flex items-center justify-center gap-1.5">
          <Ticket size={13} /> Biggest loser → free ticket
        </div>
      </div>
    </div>
  );
}

function Stat({ n, k, border, text }) {
  return (
    <div className={`border p-3 text-center ${border}`}>
      <div className={`text-2xl font-black tabular-nums ${text}`}>{n}</div>
      <div className="text-[10px] tracking-eyebrow-md uppercase text-white/55 mt-1">{k}</div>
    </div>
  );
}

// ---- Start screen: name the battle + set the entry fee before it begins. ----
function StartScreen({ onStart }) {
  const [title, setTitle] = useState('');
  const [entryFee, setEntryFee] = useState('');

  const feeNum = Number(entryFee) || 0;
  const previewTitle = title.trim() || (feeNum ? `${currency(feeNum)} Bonus Battle` : 'Bonus Battle');

  return (
    <div className="border border-white/8 bg-zinc-card/40 p-8 sm:p-10 max-w-md mx-auto font-mono">
      <p className="text-sm font-bold tracking-eyebrow-lg uppercase text-emerald-signal mb-1">◉ New Bonus Battle</p>
      <p className="text-xs text-white/50 mb-6">Name it and set the buy-in. Entry fees fund the pot.</p>

      <label className="block text-[10px] tracking-eyebrow-md uppercase text-white/50 mb-1.5">Battle title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={feeNum ? `${currency(feeNum)} Bonus Battle` : 'Bonus Battle'}
        className={`${INPUT_CLS} mb-4`}
      />

      <label className="block text-[10px] tracking-eyebrow-md uppercase text-white/50 mb-1.5">Entry fee ($ per player)</label>
      <input
        type="number"
        inputMode="decimal"
        value={entryFee}
        onChange={(e) => setEntryFee(e.target.value)}
        placeholder="20"
        className={`${INPUT_CLS} mb-6 tabular-nums`}
      />

      <button
        type="button"
        onClick={() => onStart({ title: previewTitle, entryFee: feeNum })}
        className="w-full px-6 py-3.5 bg-purple-gamba hover:bg-purple-bright text-white text-xs font-bold tracking-eyebrow-lg uppercase transition-colors"
      >
        Start {previewTitle}
      </button>
    </div>
  );
}

// ---- Admin tool: owns state, renders the interactive board. ----
export default function BonusBattle() {
  const store = useBattleStore();
  const {
    battle,
    players,
    ownerId,
    startBattle,
    addPlayer,
    removePlayer,
    setPayout,
    setCurrentPlayer,
    setRake,
    setEntryFee,
    lockEntries,
    unlockEntries,
    reset,
  } = store;

  const derived = computeBattle(players, { rakePct: battle?.rakePct ?? 10, entryFee: battle?.entryFee ?? 0 });

  if (!battle) {
    return <StartScreen onStart={startBattle} />;
  }

  const liveUrl = ownerId ? `${window.location.origin}/battle/${ownerId}` : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold tracking-eyebrow-lg uppercase text-emerald-signal truncate">
          ◉ {battle.title || 'Bonus Battle'}
        </h2>
        <div className="flex items-center gap-2">
          {liveUrl && <CopyLinkButton url={liveUrl} label="Copy live link" />}
          <button
            type="button"
            onClick={() => { if (window.confirm('Reset the battle? This clears all players.')) reset(); }}
            className="text-[10px] tracking-eyebrow-md uppercase text-white/40 hover:text-red-destructive font-mono"
          >
            Reset
          </button>
        </div>
      </div>
      {!ownerId && (
        <p className="text-[10px] tracking-eyebrow-sm uppercase text-amber-rust/80 font-mono">
          Not signed in — running locally. Log in to share a live link with viewers.
        </p>
      )}
      <BattleBoard
        battle={battle}
        players={players}
        derived={derived}
        interactive
        onAddPlayer={addPlayer}
        onRemovePlayer={removePlayer}
        onSetPayout={setPayout}
        onSpinResult={(p) => setCurrentPlayer(p.id)}
        onSetRake={setRake}
        onSetEntryFee={setEntryFee}
        onLockEntries={lockEntries}
        onUnlockEntries={unlockEntries}
      />
    </div>
  );
}
