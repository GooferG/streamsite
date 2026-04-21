import { useState, useMemo } from 'react';
import { Plus, X, RefreshCcw, Target, Users, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

const LS_KEY = 'hunt_tracker';

function load() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || null;
  } catch {
    return null;
  }
}

function save(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

const defaultState = {
  startBalance: '',
  finishBalance: '',
  bonuses: [],
  gamblers: [],
  bannedSlots: '',
};

function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fmt(val) {
  if (val == null || val === '') return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtX(val) {
  if (val == null || !isFinite(val)) return '—';
  return `${val.toFixed(2)}x`;
}

export default function HuntTracker() {
  const saved = load();
  const [startBalance, setStartBalance] = useState(saved?.startBalance ?? '');
  const [finishBalance, setFinishBalance] = useState(saved?.finishBalance ?? '');
  const [bonuses, setBonuses] = useState(saved?.bonuses ?? []);
  const [gamblers, setGamblers] = useState(saved?.gamblers ?? []);
  const [bannedSlots, setBannedSlots] = useState(saved?.bannedSlots ?? '');

  const [slotInput, setSlotInput] = useState('');
  const [stakeInput, setStakeInput] = useState('');
  const [winInput, setWinInput] = useState('');

  const [gamblerNameInput, setGamblerNameInput] = useState('');
  const [gamblerInInput, setGamblerInInput] = useState('');

  function persist(patch) {
    const next = { startBalance, finishBalance, bonuses, gamblers, bannedSlots, ...patch };
    save(next);
  }

  function updateStart(v) { setStartBalance(v); persist({ startBalance: v }); }
  function updateFinish(v) { setFinishBalance(v); persist({ finishBalance: v }); }
  function updateBanned(v) { setBannedSlots(v); persist({ bannedSlots: v }); }

  function addBonus() {
    if (!slotInput.trim()) return;
    const bonus = { id: makeId(), slot: slotInput.trim(), stake: Number(stakeInput) || 0, win: Number(winInput) || 0 };
    const next = [...bonuses, bonus];
    setBonuses(next);
    persist({ bonuses: next });
    setSlotInput(''); setStakeInput(''); setWinInput('');
  }

  function removeBonus(id) {
    const next = bonuses.filter(b => b.id !== id);
    setBonuses(next);
    persist({ bonuses: next });
  }

  function addGambler() {
    if (!gamblerNameInput.trim() || !gamblerInInput || Number(gamblerInInput) <= 0) return;
    if (gamblers.length >= 10) return;
    const next = [...gamblers, { id: makeId(), name: gamblerNameInput.trim(), inFor: Number(gamblerInInput) }];
    setGamblers(next);
    persist({ gamblers: next });
    setGamblerNameInput(''); setGamblerInInput('');
  }

  function removeGambler(id) {
    const next = gamblers.filter(g => g.id !== id);
    setGamblers(next);
    persist({ gamblers: next });
  }

  function resetAll() {
    if (!window.confirm('Reset hunt? This clears all bonuses, gamblers, and balances.')) return;
    setStartBalance(''); setFinishBalance(''); setBonuses([]); setGamblers([]); setBannedSlots('');
    localStorage.removeItem(LS_KEY);
  }

  const totalStakes = useMemo(() => bonuses.reduce((s, b) => s + b.stake, 0), [bonuses]);
  const totalWins = useMemo(() => bonuses.reduce((s, b) => s + b.win, 0), [bonuses]);
  const reqX = useMemo(() => {
    if (totalStakes === 0 || !startBalance) return null;
    return Number(startBalance) / totalStakes;
  }, [totalStakes, startBalance]);

  const profit = useMemo(() => {
    if (finishBalance === '' || startBalance === '') return null;
    return Number(finishBalance) - Number(startBalance);
  }, [finishBalance, startBalance]);

  const wlMultiplier = useMemo(() => {
    if (finishBalance === '' || !startBalance || Number(startBalance) === 0) return null;
    return Number(finishBalance) / Number(startBalance);
  }, [finishBalance, startBalance]);

  const totalBuyIns = useMemo(() => gamblers.reduce((s, g) => s + g.inFor, 0), [gamblers]);

  const gamblerRows = useMemo(() => gamblers.map(g => {
    const pct = totalBuyIns > 0 ? (g.inFor / totalBuyIns) * 100 : 0;
    const payout = finishBalance !== '' && totalBuyIns > 0 ? (pct / 100) * Number(finishBalance) : null;
    return { ...g, pct, payout };
  }), [gamblers, totalBuyIns, finishBalance]);

  const inputCls = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none placeholder-white/20';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-8 bg-gradient-to-br from-emerald-900/20 to-purple-900/20 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
              <Target size={18} />
              Hunt Tracker
            </div>
            <h2 className="text-3xl font-black tracking-tighter">Bonus Hunt Tracker</h2>
            <p className="text-white/60">Log bonuses, track stats, split payouts among the squad.</p>
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-red-400/60 transition-all"
          >
            <RefreshCcw size={14} />
            RESET
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* LEFT — Bonus List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">Bonus List</h3>

            {/* Add bonus row */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
              <input
                type="text"
                placeholder="Slot name"
                value={slotInput}
                onChange={e => setSlotInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBonus()}
                className={`w-full ${inputCls}`}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Stake ($)"
                  value={stakeInput}
                  onChange={e => setStakeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBonus()}
                  className={inputCls}
                />
                <input
                  type="number"
                  placeholder="Win ($)"
                  value={winInput}
                  onChange={e => setWinInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBonus()}
                  className={inputCls}
                />
              </div>
              <button
                onClick={addBonus}
                className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-purple-500 text-white font-bold text-sm hover:from-emerald-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add Bonus
              </button>
            </div>

            {/* Bonus table */}
            {bonuses.length === 0 ? (
              <p className="text-center text-white/30 py-8 text-sm">No bonuses yet.</p>
            ) : (
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
                      <th className="text-left px-3 py-2">Slot</th>
                      <th className="text-right px-3 py-2">Stake</th>
                      <th className="text-right px-3 py-2">Win</th>
                      <th className="text-right px-3 py-2">X</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map(b => {
                      const x = b.stake > 0 ? b.win / b.stake : null;
                      return (
                        <tr key={b.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-white truncate max-w-[120px]">{b.slot}</td>
                          <td className="px-3 py-2.5 text-right text-white/70">{fmt(b.stake)}</td>
                          <td className="px-3 py-2.5 text-right text-white/70">{fmt(b.win)}</td>
                          <td className={`px-3 py-2.5 text-right font-bold ${x != null && x >= (reqX ?? 0) ? 'text-emerald-400' : 'text-white/50'}`}>
                            {x != null ? fmtX(x) : '—'}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              onClick={() => removeBonus(b.id)}
                              className="p-1 rounded bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 text-white/50 text-xs">
                      <td className="px-3 py-2 font-bold text-white/40">TOTALS</td>
                      <td className="px-3 py-2 text-right font-bold text-white/60">{fmt(totalStakes)}</td>
                      <td className="px-3 py-2 text-right font-bold text-white/60">{fmt(totalWins)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT — Stats & Split */}
          <div className="space-y-4">

            {/* Hunt Financials */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
                <DollarSign size={15} />
                Hunt Financials
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Start Balance</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={startBalance}
                    onChange={e => updateStart(e.target.value)}
                    className={`w-full ${inputCls}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Finish Balance</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={finishBalance}
                    onChange={e => updateFinish(e.target.value)}
                    className={`w-full ${inputCls}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <StatCell
                  label="Profit"
                  value={
                    profit == null ? '—' :
                    <span className={profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {profit >= 0 ? '+' : ''}{fmt(profit)}
                    </span>
                  }
                />
                <StatCell
                  label="Req X"
                  value={reqX != null ? `${reqX.toFixed(1)}x` : '—'}
                />
                <StatCell
                  label="W/L Multiplier"
                  value={wlMultiplier != null ? fmtX(Math.round(wlMultiplier * 100) / 100) : '—'}
                />
                <StatCell
                  label="Total Wins"
                  value={fmt(totalWins)}
                />
              </div>
            </div>

            {/* Gambler Split */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-1">
                <Users size={15} />
                Gambler Split
              </div>

              {/* Add gambler */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={gamblerNameInput}
                  onChange={e => setGamblerNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGambler()}
                  className={`flex-1 ${inputCls}`}
                />
                <input
                  type="number"
                  placeholder="In for ($)"
                  value={gamblerInInput}
                  onChange={e => setGamblerInInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGambler()}
                  className={`w-28 ${inputCls}`}
                />
                <button
                  onClick={addGambler}
                  disabled={gamblers.length >= 10}
                  className="px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-all disabled:opacity-40"
                >
                  <Plus size={16} />
                </button>
              </div>

              {gamblers.length === 0 ? (
                <p className="text-center text-white/30 py-4 text-sm">No gamblers added.</p>
              ) : (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="text-right px-3 py-2">In For</th>
                        <th className="text-right px-3 py-2">%</th>
                        <th className="text-right px-3 py-2">Payout</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {gamblerRows.map(g => (
                        <tr key={g.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-white">{g.name}</td>
                          <td className="px-3 py-2.5 text-right text-white/70">{fmt(g.inFor)}</td>
                          <td className="px-3 py-2.5 text-right text-purple-300 font-bold">{g.pct.toFixed(2)}%</td>
                          <td className={`px-3 py-2.5 text-right font-bold ${g.payout != null ? (g.payout >= g.inFor ? 'text-emerald-400' : 'text-red-400') : 'text-white/30'}`}>
                            {g.payout != null ? fmt(g.payout) : '—'}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              onClick={() => removeGambler(g.id)}
                              className="p-1 rounded bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10 text-xs">
                        <td className="px-3 py-2 font-bold text-white/40">TOTAL</td>
                        <td className="px-3 py-2 text-right font-bold text-white/60">{fmt(totalBuyIns)}</td>
                        <td className="px-3 py-2 text-right font-bold text-white/60">100.00%</td>
                        <td className="px-3 py-2 text-right font-bold text-white/60">
                          {finishBalance !== '' ? fmt(Number(finishBalance)) : '—'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Soft Banned Slots */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
                <TrendingDown size={15} />
                Soft Banned Slots
              </div>
              <textarea
                placeholder="List slots to avoid (e.g. Gates of Olympus, Sweet Bonanza...)"
                value={bannedSlots}
                onChange={e => updateBanned(e.target.value)}
                rows={3}
                className={`w-full ${inputCls} resize-none`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="p-3 bg-black/20 rounded-lg">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="font-black text-white text-lg">{value}</p>
    </div>
  );
}
