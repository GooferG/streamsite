import { useState } from 'react';
import { Swords, Trophy, Ticket, X } from 'lucide-react';
import SlotAutocomplete from './SlotAutocomplete';
import BattleWheel from './BattleWheel';
import { useBattleStore } from '../hooks/useBattleStore';
import { computeBattle, currency } from '../utils/battleCalc';

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
}) {
  const [name, setName] = useState('');
  const [slot, setSlot] = useState('');
  const [payoutInput, setPayoutInput] = useState('');

  const current = players.find((p) => p.id === battle?.currentPlayerId) || null;
  const unplayed = players.filter((p) => !p.ran);
  const rakePct = battle?.rakePct ?? 10;
  const sorted = [...players].sort((a, b) => (b.payout || 0) - (a.payout || 0));

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
        <div className="border border-purple-gamba/70 bg-purple-gamba/10 p-4 mb-4">
          <div className="text-[11px] tracking-eyebrow-md uppercase text-purple-bright">Total Pot</div>
          <div className="text-3xl font-black text-white-body mt-1 tabular-nums">{currency(derived.totalPot)}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat n={derived.total} k="Total" border="border-amber-rust/60" text="text-amber-rust" />
          <Stat n={derived.ran} k="Ran" border="border-emerald-signal/60" text="text-emerald-signal" />
          <Stat n={derived.left} k="Left" border="border-white/10" text="text-crt-amber" />
        </div>

        {interactive && (
          <div className="space-y-2 mb-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name"
              className="w-full bg-black/30 border border-white/10 text-white-body text-sm px-3 py-2.5 font-mono focus:outline-none focus:border-emerald-signal/60"
            />
            <SlotAutocomplete
              value={slot}
              onChange={setSlot}
              placeholder="Slot pick…"
              className="w-full"
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

        <div className="space-y-2">
          {players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 border border-white/7 px-3 py-2.5 ${p.ran ? '' : 'opacity-60'}`}
            >
              <span className="text-sm font-bold text-white-body truncate">{p.name}</span>
              {p.slot && <span className="text-[10px] uppercase text-white/50 tracking-eyebrow-sm truncate">· {p.slot}</span>}
              <span className={`ml-auto text-sm font-black tabular-nums ${p.ran ? 'text-emerald-signal' : 'text-white/40'}`}>
                {p.ran ? currency(p.payout) : '—'}
              </span>
              {interactive && (
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

        {interactive && current && (
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
        {current && (
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

        <div className="border border-purple-gamba/70 bg-purple-gamba/10 p-4 mt-4 text-center">
          <div className="text-[12px] tracking-eyebrow-md uppercase text-purple-bright flex items-center justify-center gap-1.5">
            <Trophy size={13} /> Winner Takes All
          </div>
          <div className="text-3xl font-black text-white-body my-1.5 tabular-nums">{currency(derived.potAfterRake)}</div>
          <div className="text-[12px] text-white/55 tabular-nums">
            Pot {currency(derived.totalPot)} − {rakePct}% rake ({currency(derived.rakeAmount)})
          </div>
          {interactive && (
            <label className="block mt-3 text-[10px] tracking-eyebrow-md uppercase text-white/50">
              Rake %
              <input
                type="number"
                value={rakePct}
                onChange={(e) => onSetRake?.(e.target.value)}
                className="ml-2 w-16 bg-black/30 border border-white/12 text-white-body text-sm px-2 py-1 font-mono tabular-nums"
              />
            </label>
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

// ---- Admin tool: owns state, renders the interactive board. ----
export default function BonusBattle() {
  const store = useBattleStore();
  const { battle, players, startBattle, addPlayer, removePlayer, setPayout, setCurrentPlayer, setRake, reset } = store;

  const derived = computeBattle(players, battle?.rakePct ?? 10);

  if (!battle) {
    return (
      <div className="border border-white/8 bg-zinc-card/40 p-10 text-center font-mono">
        <p className="text-sm text-white/70 mb-4">No active battle.</p>
        <button
          type="button"
          onClick={startBattle}
          className="px-6 py-3 bg-purple-gamba hover:bg-purple-bright text-white text-xs font-bold tracking-eyebrow-lg uppercase transition-colors"
        >
          Start a Bonus Battle
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-eyebrow-lg uppercase text-emerald-signal">◉ Bonus Battle</h2>
        <button
          type="button"
          onClick={() => { if (window.confirm('Reset the battle? This clears all players.')) reset(); }}
          className="text-[10px] tracking-eyebrow-md uppercase text-white/40 hover:text-red-destructive font-mono"
        >
          Reset
        </button>
      </div>
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
      />
    </div>
  );
}
