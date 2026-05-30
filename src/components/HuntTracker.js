import { useState } from 'react';
import {
  Plus,
  X,
  Users,
  DollarSign,
  TrendingDown,
  Download,
  CheckCircle2,
  Star,
  GripVertical,
  Pencil,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SlotAutocomplete from './SlotAutocomplete';
import HuntStartScreen from './HuntStartScreen';
import { useHuntStore } from '../hooks/useHuntStore';
import { fmt, fmtX, makeId, computeStats } from '../utils/huntCalc';
import { renderSplit, renderRecap } from '../utils/huntExport';

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
    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 font-mono">
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
      <p className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/65 mb-1 font-mono">
        {label}
      </p>
      <p className="font-bold text-white-body text-base tabular-nums">{value}</p>
    </div>
  );
}

function SortableBonusRow({ bonus, reqX, onWin, onRemove, onToggleMarker }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: bonus.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const x = bonus.stake > 0 ? bonus.win / bonus.stake : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-1.5 border-b border-white/5 hover:bg-zinc-broadcast/40 transition-colors"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 text-white/25 hover:text-white/65 cursor-grab active:cursor-grabbing shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <span className="flex items-center gap-1.5 min-w-0 font-bold text-white-body">
        {/* 5-scat — rare, the standout: filled gold star. Click to toggle. */}
        <button
          type="button"
          onClick={() => onToggleMarker(bonus.id, 'fiveScat')}
          aria-pressed={!!bonus.fiveScat}
          title={bonus.fiveScat ? '5-scatter — click to clear' : 'Mark as 5-scatter'}
          className="shrink-0 leading-none"
        >
          <Star
            size={13}
            aria-label="5 scatter"
            className={bonus.fiveScat ? 'fill-yellow-400 text-yellow-400' : 'text-white/25 hover:text-white/55'}
          />
        </button>
        {/* Super — secondary: small 'S' pill. Click to toggle. */}
        <button
          type="button"
          onClick={() => onToggleMarker(bonus.id, 'super')}
          aria-pressed={!!bonus.super}
          title={bonus.super ? 'Super — click to clear' : 'Mark as super'}
          className={`shrink-0 px-1 py-0.5 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono border leading-none transition-colors ${
            bonus.super
              ? 'border-orange-admin bg-orange-admin/15 text-orange-admin'
              : 'border-white/15 text-white/30 hover:text-white/60 hover:border-white/30'
          }`}
        >
          S
        </button>
        <span className="truncate">{bonus.slot}</span>
      </span>
      <span className="text-right text-white/70 tabular-nums px-1 w-20">{fmt(bonus.stake)}</span>
      <input
        type="number"
        value={bonus.win || ''}
        onChange={(e) => onWin(bonus.id, e.target.value)}
        placeholder="—"
        className="w-24 bg-zinc-broadcast/60 border border-white/10 px-2 py-1 text-sm text-right focus:border-emerald-signal/70 focus:outline-none placeholder:text-white/20 tabular-nums"
      />
      <span
        className={`text-right font-bold tabular-nums px-1 w-16 ${
          x != null && x >= (reqX ?? 0) ? 'text-emerald-signal' : 'text-white/70'
        }`}
      >
        {x != null ? fmtX(x) : '—'}
      </span>
      <button
        type="button"
        onClick={() => onRemove(bonus.id)}
        className="p-1 border border-red-destructive/30 text-red-destructive/80 hover:bg-red-destructive/15 transition-colors"
        aria-label="Remove bonus"
      >
        <X size={11} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function HuntTracker() {
  const store = useHuntStore();
  const {
    status,
    activeHunt,
    history,
    isLoggedIn,
    localHuntPending,
    error,
    startHunt,
    updateHunt,
    completeHunt,
    claimLocalHunt,
    discardLocalHunt,
  } = store;

  // transient input state (not persisted until added)
  const [slotInput, setSlotInput] = useState('');
  const [stakeInput, setStakeInput] = useState('');
  const [superInput, setSuperInput] = useState(false);
  const [fiveScatInput, setFiveScatInput] = useState(false);
  const [gamblerNameInput, setGamblerNameInput] = useState('');
  const [gamblerInInput, setGamblerInInput] = useState('');
  const [editingGamblerId, setEditingGamblerId] = useState(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Drag sensors must be created unconditionally (before any early return).
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ---------- LOADING (auth rehydrating) ----------
  if (status === 'loading') {
    return (
      <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
        <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
          Loading hunt…
        </p>
      </div>
    );
  }

  // ---------- IDLE ----------
  if (status === 'idle') {
    return (
      <HuntStartScreen
        isLoggedIn={isLoggedIn}
        history={history}
        localHuntPending={localHuntPending}
        onStart={startHunt}
        onClaimLocal={claimLocalHunt}
        onDiscardLocal={discardLocalHunt}
        onReexport={renderRecap}
      />
    );
  }

  // ---------- ACTIVE ----------
  const bonuses = activeHunt.bonuses ?? [];
  const gamblers = activeHunt.gamblers ?? [];
  const startBalance = activeHunt.startBalance ?? '';
  const finishBalance = activeHunt.finishBalance ?? '';
  const bannedSlots = activeHunt.bannedSlots ?? '';

  function addBonus() {
    if (!slotInput.trim()) return;
    const next = [
      ...bonuses,
      {
        id: makeId(),
        slot: slotInput.trim(),
        stake: Number(stakeInput) || 0,
        win: 0,
        super: superInput,
        fiveScat: fiveScatInput,
      },
    ];
    updateHunt({ bonuses: next });
    setSlotInput('');
    setStakeInput('');
    setSuperInput(false);
    setFiveScatInput(false);
  }
  function removeBonus(id) {
    updateHunt({ bonuses: bonuses.filter((b) => b.id !== id) });
  }
  function updateBonusWin(id, val) {
    updateHunt({
      bonuses: bonuses.map((b) => (b.id === id ? { ...b, win: Number(val) || 0 } : b)),
    });
  }
  // Toggle a boolean marker ('super' | 'fiveScat') on an existing bonus.
  function toggleBonusMarker(id, key) {
    updateHunt({
      bonuses: bonuses.map((b) => (b.id === id ? { ...b, [key]: !b[key] } : b)),
    });
  }
  function saveName() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== activeHunt.name) updateHunt({ name: trimmed });
    setEditingName(false);
  }
  function handleBonusDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = bonuses.findIndex((b) => b.id === active.id);
    const newIndex = bonuses.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    updateHunt({ bonuses: arrayMove(bonuses, oldIndex, newIndex) });
  }
  function addGambler() {
    if (!gamblerNameInput.trim() || !gamblerInInput || Number(gamblerInInput) <= 0) return;
    updateHunt({
      gamblers: [
        ...gamblers,
        { id: makeId(), name: gamblerNameInput.trim(), inFor: Number(gamblerInInput) },
      ],
    });
    setGamblerNameInput('');
    setGamblerInInput('');
  }
  function removeGambler(id) {
    updateHunt({ gamblers: gamblers.filter((g) => g.id !== id) });
  }
  function updateGamblerInFor(id, value) {
    const num = value === '' ? 0 : Number(value);
    if (Number.isNaN(num) || num < 0) return;
    updateHunt({ gamblers: gamblers.map((g) => (g.id === id ? { ...g, inFor: num } : g)) });
  }

  async function handleComplete() {
    const completed = await completeHunt();
    if (completed) renderRecap(completed);
    setConfirmingComplete(false);
  }

  const stats = computeStats(activeHunt);
  const totalStakes = stats.totalStakes;
  const totalWins = stats.totalWins;
  const reqX = stats.reqX;
  const profit = stats.profit;
  const wlMultiplier = stats.wlMultiplier;
  const totalBuyIns = stats.totalBuyIns;

  const gamblerRows = gamblers.map((g) => {
    const pct = totalBuyIns > 0 ? (g.inFor / totalBuyIns) * 100 : 0;
    const payout =
      finishBalance !== '' && totalBuyIns > 0 ? (pct / 100) * Number(finishBalance) : null;
    return { ...g, pct, payout };
  });

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      {/* Hunt header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/8">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-0.5">
            ▸ Active hunt
          </p>
          {editingName ? (
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="font-black text-white-body text-lg leading-tight bg-zinc-broadcast/80 border border-emerald-signal/50 px-2 py-0.5 focus:outline-none w-full max-w-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameInput(activeHunt.name);
                setEditingName(true);
              }}
              title="Click to rename hunt"
              className="group inline-flex items-center gap-2 min-w-0 text-left"
            >
              <span className="font-black text-white-body text-lg leading-tight truncate">
                {activeHunt.name}
              </span>
              <Pencil
                size={12}
                aria-hidden="true"
                className="shrink-0 text-white/30 group-hover:text-emerald-signal transition-colors"
              />
            </button>
          )}
        </div>
        <div className="ml-auto flex gap-2" data-html2canvas-ignore="true">
          <button
            type="button"
            onClick={() => renderSplit(activeHunt)}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-signal/40 text-emerald-signal hover:bg-emerald-signal/10 transition-colors duration-150"
          >
            <Download size={12} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg">EXPORT SPLIT</span>
          </button>
          {!confirmingComplete ? (
            <button
              type="button"
              onClick={() => setConfirmingComplete(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150"
            >
              <CheckCircle2 size={12} aria-hidden="true" />
              <span className="text-[10px] font-bold tracking-eyebrow-lg">COMPLETE</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleComplete}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg">CONFIRM + EXPORT</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmingComplete(false)}
                className="px-3 py-1.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg">CANCEL</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="text-white/65">BONUSES</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {String(bonuses.length).padStart(3, '0')}
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">SQUAD</span>
        <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
          {String(gamblers.length).padStart(2, '0')}
        </span>
        {!isLoggedIn && (
          <>
            <span className="text-white/15">·</span>
            <span className="text-white/40">LOCAL ONLY — LOGIN TO SAVE</span>
          </>
        )}
        {error && (
          <>
            <span className="text-white/15">·</span>
            <span className="text-red-destructive normal-case tracking-normal">{error}</span>
          </>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-5">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT — Bonus list */}
          <div className="space-y-4">
            <PanelLabel code="01" label="Bonus list" />
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFiveScatInput((s) => !s)}
                  aria-pressed={fiveScatInput}
                  className={`inline-flex items-center justify-center gap-2 px-3 py-2 border transition-colors duration-150 ${
                    fiveScatInput
                      ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                      : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
                  }`}
                >
                  <Star size={13} aria-hidden="true" className={fiveScatInput ? 'fill-yellow-400' : ''} />
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                    5 scat
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSuperInput((s) => !s)}
                  aria-pressed={superInput}
                  className={`inline-flex items-center justify-center gap-2 px-3 py-2 border transition-colors duration-150 ${
                    superInput
                      ? 'border-orange-admin bg-orange-admin/10 text-orange-admin'
                      : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
                  }`}
                >
                  <span className={`text-[11px] font-bold font-mono leading-none ${superInput ? 'text-orange-admin' : ''}`}>S</span>
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                    Super
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={addBonus}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
              >
                <Plus size={14} aria-hidden="true" />
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">Log bonus</span>
              </button>
            </div>

            {bonuses.length === 0 ? (
              <p className="text-center text-white/60 py-6 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
                No bonuses logged.
              </p>
            ) : (
              <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
                <div className="min-w-[480px] text-sm">
                  {/* Column headers */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-2 border-b border-white/10 bg-zinc-broadcast/50 text-white/65 text-[10px] uppercase tracking-eyebrow-md font-mono font-bold">
                    <span className="w-6" aria-hidden="true" />
                    <span className="text-left">Slot</span>
                    <span className="text-right w-20 px-1">Stake</span>
                    <span className="text-right w-24">Win</span>
                    <span className="text-right w-16 px-1">X</span>
                    <span className="w-6" aria-hidden="true" />
                  </div>
                  {/* Sortable rows */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleBonusDragEnd}
                  >
                    <SortableContext
                      items={bonuses.map((b) => b.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {bonuses.map((b) => (
                        <SortableBonusRow
                          key={b.id}
                          bonus={b}
                          reqX={reqX}
                          onWin={updateBonusWin}
                          onRemove={removeBonus}
                          onToggleMarker={toggleBonusMarker}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  {/* Totals */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-2 border-t border-white/10 bg-zinc-broadcast/50 text-[10px] uppercase tracking-eyebrow-md font-mono font-bold text-white/70">
                    <span className="w-6" aria-hidden="true" />
                    <span className="text-left text-white/65">Totals</span>
                    <span className="text-right w-20 px-1 tabular-nums">{fmt(totalStakes)}</span>
                    <span className="text-right w-24 tabular-nums">{fmt(totalWins)}</span>
                    <span className="w-16 px-1" aria-hidden="true" />
                    <span className="w-6" aria-hidden="true" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Stats / Split / Banned */}
          <div className="space-y-5">
            <div className="space-y-3">
              <PanelLabel code="02" icon={DollarSign} label="Financials" />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">Start balance</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={startBalance}
                    onChange={(e) => updateHunt({ startBalance: e.target.value })}
                    className={`w-full ${inputCls} tabular-nums`}
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">Finish balance</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={finishBalance}
                    onChange={(e) => updateHunt({ finishBalance: e.target.value })}
                    className={`w-full ${inputCls} tabular-nums`}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <StatCell
                  label="Profit"
                  value={
                    profit == null ? '—' : (
                      <span className={profit >= 0 ? 'text-emerald-signal' : 'text-red-destructive'}>
                        {profit >= 0 ? '+' : ''}{fmt(profit)}
                      </span>
                    )
                  }
                />
                <StatCell label="Req X" value={reqX != null ? `${reqX.toFixed(1)}x` : '—'} />
                <StatCell
                  label="W/L Multiplier"
                  value={wlMultiplier != null ? fmtX(Math.round(wlMultiplier * 100) / 100) : '—'}
                />
                <StatCell label="Total wins" value={fmt(totalWins)} />
              </div>
            </div>

            <div className="space-y-3">
              <PanelLabel code="03" icon={Users} label="Squad split" accent="purple" />
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
                  className="px-3 py-2 border border-purple-gamba/40 text-purple-bright hover:bg-purple-gamba/15 transition-colors duration-150"
                  aria-label="Add gambler"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>

              {gamblers.length === 0 ? (
                <p className="text-center text-white/60 py-4 text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  No squad added.
                </p>
              ) : (
                <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                        <th className="text-left px-3 py-2 font-bold">Name</th>
                        <th className="text-right px-3 py-2 font-bold">In for</th>
                        <th className="text-right px-3 py-2 font-bold">%</th>
                        <th className="text-right px-3 py-2 font-bold">Payout</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {gamblerRows.map((g) => (
                        <tr key={g.id} className="border-b border-white/5 hover:bg-zinc-broadcast/40 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-white-body">{g.name}</td>
                          <td className="px-3 py-2.5 text-right text-white/70 tabular-nums">
                            {editingGamblerId === g.id ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                autoFocus
                                value={g.inFor}
                                onChange={(e) => updateGamblerInFor(g.id, e.target.value)}
                                onBlur={() => setEditingGamblerId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Escape') setEditingGamblerId(null);
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
                          <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                            g.payout != null
                              ? g.payout >= g.inFor ? 'text-emerald-signal' : 'text-red-destructive'
                              : 'text-white/60'
                          }`}>
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
                      <tr className="border-t border-white/10 bg-zinc-broadcast/50 text-[10px] uppercase tracking-eyebrow-md font-mono">
                        <td className="px-3 py-2 font-bold text-white/65">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">{fmt(totalBuyIns)}</td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">100.00%</td>
                        <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                          {finishBalance !== '' ? fmt(Number(finishBalance)) : '—'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <PanelLabel code="04" icon={TrendingDown} label="Soft banned" accent="orange" />
              <textarea
                placeholder="Slots to avoid this hunt — comma or newline separated."
                value={bannedSlots}
                onChange={(e) => updateHunt({ bannedSlots: e.target.value })}
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
