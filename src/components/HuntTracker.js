import { useState, useMemo } from 'react';
import {
  Plus,
  X,
  RefreshCcw,
  Users,
  DollarSign,
  TrendingDown,
  Download,
} from 'lucide-react';
import SlotAutocomplete from './SlotAutocomplete';

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

const inputCls =
  'bg-zinc-broadcast/60 border border-white/10 px-3 py-2 text-sm text-white-body placeholder:text-white/50 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

function PanelLabel({ code, icon: Icon, label, accent = 'emerald' }) {
  const color =
    accent === 'orange'
      ? 'text-orange-admin'
      : accent === 'purple'
        ? 'text-purple-bright'
        : 'text-emerald-signal';
  return (
    <div
      className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 font-mono"
      >
      <span className={`${color} tabular-nums`}>{code}</span>
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon size={12} aria-hidden="true" className={color} />}
        <span>{label}</span>
      </span>
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="px-3 py-2.5 bg-zinc-broadcast/50 border border-white/8">
      <p
        className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 mb-1 font-mono"
      >
        {label}
      </p>
      <p className="font-bold text-white-body text-base tabular-nums">{value}</p>
    </div>
  );
}

export default function HuntTracker() {
  const saved = load();
  const [startBalance, setStartBalance] = useState(saved?.startBalance ?? '');
  const [finishBalance, setFinishBalance] = useState(
    saved?.finishBalance ?? ''
  );
  const [bonuses, setBonuses] = useState(saved?.bonuses ?? []);
  const [gamblers, setGamblers] = useState(saved?.gamblers ?? []);
  const [bannedSlots, setBannedSlots] = useState(saved?.bannedSlots ?? '');

  const [slotInput, setSlotInput] = useState('');
  const [stakeInput, setStakeInput] = useState('');

  const [gamblerNameInput, setGamblerNameInput] = useState('');
  const [gamblerInInput, setGamblerInInput] = useState('');
  const [editingGamblerId, setEditingGamblerId] = useState(null);

  function persist(patch) {
    const next = {
      startBalance,
      finishBalance,
      bonuses,
      gamblers,
      bannedSlots,
      ...patch,
    };
    save(next);
  }

  function updateStart(v) {
    setStartBalance(v);
    persist({ startBalance: v });
  }
  function updateFinish(v) {
    setFinishBalance(v);
    persist({ finishBalance: v });
  }
  function updateBanned(v) {
    setBannedSlots(v);
    persist({ bannedSlots: v });
  }

  function addBonus() {
    if (!slotInput.trim()) return;
    const bonus = {
      id: makeId(),
      slot: slotInput.trim(),
      stake: Number(stakeInput) || 0,
      win: 0,
    };
    const next = [...bonuses, bonus];
    setBonuses(next);
    persist({ bonuses: next });
    setSlotInput('');
    setStakeInput('');
  }

  function removeBonus(id) {
    const next = bonuses.filter((b) => b.id !== id);
    setBonuses(next);
    persist({ bonuses: next });
  }

  function updateBonusWin(id, val) {
    const next = bonuses.map((b) =>
      b.id === id ? { ...b, win: Number(val) || 0 } : b
    );
    setBonuses(next);
    persist({ bonuses: next });
  }

  function addGambler() {
    if (
      !gamblerNameInput.trim() ||
      !gamblerInInput ||
      Number(gamblerInInput) <= 0
    )
      return;
    if (gamblers.length >= 10) return;
    const next = [
      ...gamblers,
      {
        id: makeId(),
        name: gamblerNameInput.trim(),
        inFor: Number(gamblerInInput),
      },
    ];
    setGamblers(next);
    persist({ gamblers: next });
    setGamblerNameInput('');
    setGamblerInInput('');
  }

  function removeGambler(id) {
    const next = gamblers.filter((g) => g.id !== id);
    setGamblers(next);
    persist({ gamblers: next });
  }

  function updateGamblerInFor(id, value) {
    const num = value === '' ? 0 : Number(value);
    if (Number.isNaN(num) || num < 0) return;
    const next = gamblers.map((g) =>
      g.id === id ? { ...g, inFor: num } : g
    );
    setGamblers(next);
    persist({ gamblers: next });
  }

  const [downloading, setDownloading] = useState(false);

  function downloadImage() {
    if (gamblers.length === 0) {
      alert('Add at least one gambler before downloading.');
      return;
    }
    setDownloading(true);
    try {
      const scale = 2;
      const W = 720;
      const padding = 40;
      const headerH = 110;
      const colHeaderH = 40;
      const rowH = 48;
      const totalRowH = 56;
      const footerH = 50;
      const H = headerH + colHeaderH + rowH * gamblers.length + totalRowH + footerH + padding * 2;

      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // Background
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#0a0e1a');
      bg.addColorStop(1, '#1a0e1f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Card border
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(padding / 2, padding / 2, W - padding, H - padding);

      // Header
      let y = padding + 10;
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
      ctx.fillText('GAMBLER SPLIT', padding, y);

      y += 28;
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px system-ui, -apple-system, sans-serif';
      ctx.fillText('Bonus Hunt Equity', padding, y);

      y += 24;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      ctx.fillText(dateStr, padding, y);

      // Hunt totals (if any)
      if (finishBalance !== '' && totalBuyIns > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Hunt End: ${fmt(Number(finishBalance))}`, W - padding, y);
        ctx.textAlign = 'left';
      }

      // Column headers
      y = padding + headerH;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const cols = {
        name: padding,
        inFor: W * 0.45,
        pct: W * 0.65,
        payout: W - padding,
      };
      ctx.fillText('NAME', cols.name, y);
      ctx.textAlign = 'right';
      ctx.fillText('IN FOR', cols.inFor, y);
      ctx.fillText('%', cols.pct, y);
      ctx.fillText('PAYOUT', cols.payout, y);
      ctx.textAlign = 'left';

      // Header underline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, y + 12);
      ctx.lineTo(W - padding, y + 12);
      ctx.stroke();

      // Rows
      y += colHeaderH;
      gamblerRows.forEach((g, i) => {
        const rowY = y + i * rowH;

        // Alternating row bg
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.fillRect(padding - 8, rowY - rowH + 12, W - padding * 2 + 16, rowH);
        }

        // Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(g.name, cols.name, rowY);

        // In For
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '15px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(fmt(g.inFor), cols.inFor, rowY);

        // %
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${g.pct.toFixed(2)}%`, cols.pct, rowY);

        // Payout
        if (g.payout != null) {
          ctx.fillStyle = g.payout >= g.inFor ? '#34d399' : '#f87171';
          ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
          ctx.fillText(fmt(g.payout), cols.payout, rowY);
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.font = '15px system-ui, -apple-system, sans-serif';
          ctx.fillText('—', cols.payout, rowY);
        }
      });

      // Total row
      const totalY = y + gamblers.length * rowH + 12;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(padding, totalY - 16);
      ctx.lineTo(W - padding, totalY - 16);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('TOTAL', cols.name, totalY + 16);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(fmt(totalBuyIns), cols.inFor, totalY + 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('100.00%', cols.pct, totalY + 16);
      if (finishBalance !== '') {
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(fmt(Number(finishBalance)), cols.payout, totalY + 16);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillText('—', cols.payout, totalY + 16);
      }

      // Footer
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('goofer.tv · Bonus Hunt Tracker', W / 2, H - padding);

      // Download
      const link = document.createElement('a');
      link.download = `gambler-split-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Render failed:', err);
      alert('Failed to render image.');
    } finally {
      setDownloading(false);
    }
  }

  function resetAll() {
    if (
      !window.confirm(
        'Reset hunt? This clears all bonuses, gamblers, and balances.'
      )
    )
      return;
    setStartBalance('');
    setFinishBalance('');
    setBonuses([]);
    setGamblers([]);
    setBannedSlots('');
    localStorage.removeItem(LS_KEY);
  }

  const totalStakes = useMemo(
    () => bonuses.reduce((s, b) => s + b.stake, 0),
    [bonuses]
  );
  const totalWins = useMemo(
    () => bonuses.reduce((s, b) => s + b.win, 0),
    [bonuses]
  );
  const reqX = useMemo(() => {
    if (totalStakes === 0 || !startBalance) return null;
    return Number(startBalance) / totalStakes;
  }, [totalStakes, startBalance]);

  const profit = useMemo(() => {
    if (finishBalance === '' || startBalance === '') return null;
    return Number(finishBalance) - Number(startBalance);
  }, [finishBalance, startBalance]);

  const wlMultiplier = useMemo(() => {
    if (finishBalance === '' || !startBalance || Number(startBalance) === 0)
      return null;
    return Number(finishBalance) / Number(startBalance);
  }, [finishBalance, startBalance]);

  const totalBuyIns = useMemo(
    () => gamblers.reduce((s, g) => s + g.inFor, 0),
    [gamblers]
  );

  const gamblerRows = useMemo(
    () =>
      gamblers.map((g) => {
        const pct = totalBuyIns > 0 ? (g.inFor / totalBuyIns) * 100 : 0;
        const payout =
          finishBalance !== '' && totalBuyIns > 0
            ? (pct / 100) * Number(finishBalance)
            : null;
        return { ...g, pct, payout };
      }),
    [gamblers, totalBuyIns, finishBalance]
  );

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      {/* Status bar */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono"
      >
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
          <span>HUNT TRACKER</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">BONUSES</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {String(bonuses.length).padStart(3, '0')}
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">SQUAD</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {String(gamblers.length).padStart(2, '0')}
        </span>
        <div className="ml-auto flex gap-2" data-html2canvas-ignore="true">
          <button
            type="button"
            onClick={downloadImage}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-signal/40 text-emerald-signal hover:bg-emerald-signal/10 transition-colors duration-150 disabled:opacity-50"
          >
            <Download size={12} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg">
              {downloading ? 'SAVING…' : 'EXPORT'}
            </span>
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 text-white/75 hover:text-red-destructive hover:border-red-destructive/50 transition-colors duration-150"
          >
            <RefreshCcw size={12} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg">
              RESET
            </span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-5">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT — Bonus list */}
          <div className="space-y-4">
            <PanelLabel code="01" label="Bonus list" />

            {/* Add bonus */}
            <div className="border border-white/8 bg-zinc-broadcast/40 p-3 space-y-2">
              <SlotAutocomplete
                value={slotInput}
                onChange={setSlotInput}
                placeholder="Slot name"
                className={`w-full ${inputCls}`}
                onKeyDown={(e) => e.key === 'Enter' && addBonus()}
              />
              <input
                type="number"
                placeholder="Stake ($)"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                className={`w-full ${inputCls}`}
              />
              <button
                type="button"
                onClick={addBonus}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
              >
                <Plus size={14} aria-hidden="true" />
                <span
                  className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                  Log bonus
                </span>
              </button>
            </div>

            {/* Bonus table */}
            {bonuses.length === 0 ? (
              <p
                className="text-center text-white/60 py-6 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                No bonuses logged.
              </p>
            ) : (
              <div className="border border-white/8 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono"
      >
                      <th className="text-left px-3 py-2 font-bold">Slot</th>
                      <th className="text-right px-3 py-2 font-bold">Stake</th>
                      <th className="text-right px-3 py-2 font-bold">Win</th>
                      <th className="text-right px-3 py-2 font-bold">X</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map((b) => {
                      const x = b.stake > 0 ? b.win / b.stake : null;
                      return (
                        <tr
                          key={b.id}
                          className="border-b border-white/5 hover:bg-zinc-broadcast/40 transition-colors"
                        >
                          <td className="px-3 py-2.5 font-bold text-white-body truncate max-w-[140px]">
                            {b.slot}
                          </td>
                          <td className="px-3 py-2.5 text-right text-white/70 tabular-nums">
                            {fmt(b.stake)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              value={b.win || ''}
                              onChange={(e) => updateBonusWin(b.id, e.target.value)}
                              placeholder="—"
                              className="w-24 bg-zinc-broadcast/60 border border-white/10 px-2 py-1 text-sm text-right focus:border-emerald-signal/70 focus:outline-none placeholder:text-white/20 tabular-nums"
                            />
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                              x != null && x >= (reqX ?? 0)
                                ? 'text-emerald-signal'
                                : 'text-white/70'
                            }`}
                          >
                            {x != null ? fmtX(x) : '—'}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => removeBonus(b.id)}
                              className="p-1 border border-red-destructive/30 text-red-destructive/80 hover:bg-red-destructive/15 transition-colors"
                              aria-label="Remove bonus"
                            >
                              <X size={11} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr
                      className="border-t border-white/10 bg-zinc-broadcast/50 text-[10px] uppercase tracking-eyebrow-md font-mono"
      >
                      <td className="px-3 py-2 font-bold text-white/65">
                        Totals
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                        {fmt(totalStakes)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                        {fmt(totalWins)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT — Stats / Split / Banned */}
          <div className="space-y-5">
            {/* Hunt Financials */}
            <div className="space-y-3">
              <PanelLabel code="02" icon={DollarSign} label="Financials" />

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span
                    className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono"
      >
                    Start balance
                  </span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={startBalance}
                    onChange={(e) => updateStart(e.target.value)}
                    className={`w-full ${inputCls} tabular-nums`}
                  />
                </label>
                <label className="block">
                  <span
                    className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono"
      >
                    Finish balance
                  </span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={finishBalance}
                    onChange={(e) => updateFinish(e.target.value)}
                    className={`w-full ${inputCls} tabular-nums`}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <StatCell
                  label="Profit"
                  value={
                    profit == null ? (
                      '—'
                    ) : (
                      <span
                        className={
                          profit >= 0 ? 'text-emerald-signal' : 'text-red-destructive'
                        }
                      >
                        {profit >= 0 ? '+' : ''}
                        {fmt(profit)}
                      </span>
                    )
                  }
                />
                <StatCell
                  label="Req X"
                  value={reqX != null ? `${reqX.toFixed(1)}x` : '—'}
                />
                <StatCell
                  label="W/L Multiplier"
                  value={
                    wlMultiplier != null
                      ? fmtX(Math.round(wlMultiplier * 100) / 100)
                      : '—'
                  }
                />
                <StatCell label="Total wins" value={fmt(totalWins)} />
              </div>
            </div>

            {/* Gambler Split */}
            <div className="space-y-3">
              <PanelLabel code="03" icon={Users} label="Squad split" accent="purple" />

              {/* Add gambler */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={gamblerNameInput}
                  onChange={(e) => setGamblerNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGambler()}
                  className={`flex-1 ${inputCls}`}
                />
                <input
                  type="number"
                  placeholder="In for ($)"
                  value={gamblerInInput}
                  onChange={(e) => setGamblerInInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGambler()}
                  className={`w-28 ${inputCls} tabular-nums`}
                />
                <button
                  type="button"
                  onClick={addGambler}
                  disabled={gamblers.length >= 10}
                  className="px-3 py-2 border border-purple-gamba/40 text-purple-bright hover:bg-purple-gamba/15 transition-colors duration-150 disabled:opacity-40"
                  aria-label="Add gambler"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>

              {gamblers.length === 0 ? (
                <p
                  className="text-center text-white/60 py-4 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
                  No squad added.
                </p>
              ) : (
                <div className="border border-white/8 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr
                        className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono"
      >
                        <th className="text-left px-3 py-2 font-bold">Name</th>
                        <th className="text-right px-3 py-2 font-bold">In for</th>
                        <th className="text-right px-3 py-2 font-bold">%</th>
                        <th className="text-right px-3 py-2 font-bold">Payout</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {gamblerRows.map((g) => (
                        <tr
                          key={g.id}
                          className="border-b border-white/5 hover:bg-zinc-broadcast/40 transition-colors"
                        >
                          <td className="px-3 py-2.5 font-bold text-white-body">
                            {g.name}
                          </td>
                          <td className="px-3 py-2.5 text-right text-white/70 tabular-nums">
                            {editingGamblerId === g.id ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                autoFocus
                                value={g.inFor}
                                onChange={(e) =>
                                  updateGamblerInFor(g.id, e.target.value)
                                }
                                onBlur={() => setEditingGamblerId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Escape')
                                    setEditingGamblerId(null);
                                }}
                                className="w-24 bg-zinc-broadcast/80 border border-purple-gamba/50 px-2 py-1 text-right text-white-body focus:outline-none tabular-nums"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingGamblerId(g.id)}
                                title="Click to edit"
                                className="px-2 py-1 text-right text-white/70 hover:bg-zinc-broadcast/60 hover:text-white-body transition-colors cursor-pointer tabular-nums"
                              >
                                {fmt(g.inFor)}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-purple-bright font-bold tabular-nums">
                            {g.pct.toFixed(2)}%
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                              g.payout != null
                                ? g.payout >= g.inFor
                                  ? 'text-emerald-signal'
                                  : 'text-red-destructive'
                                : 'text-white/60'
                            }`}
                          >
                            {g.payout != null ? fmt(g.payout) : '—'}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => removeGambler(g.id)}
                              className="p-1 border border-red-destructive/30 text-red-destructive/80 hover:bg-red-destructive/15 transition-colors"
                              aria-label="Remove gambler"
                            >
                              <X size={11} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr
                        className="border-t border-white/10 bg-zinc-broadcast/50 text-[10px] uppercase tracking-eyebrow-md font-mono"
      >
                        <td className="px-3 py-2 font-bold text-white/65">
                          Total
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                          {fmt(totalBuyIns)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                          100.00%
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                          {finishBalance !== ''
                            ? fmt(Number(finishBalance))
                            : '—'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Banned slots */}
            <div className="space-y-2">
              <PanelLabel code="04" icon={TrendingDown} label="Soft banned" accent="orange" />
              <textarea
                placeholder="Slots to avoid this hunt — comma or newline separated."
                value={bannedSlots}
                onChange={(e) => updateBanned(e.target.value)}
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
