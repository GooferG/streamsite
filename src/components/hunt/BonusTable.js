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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  X,
  GripVertical,
  Play,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import ScatterPill from '../ScatterPill';
import CappedScroll from '../CappedScroll';
import { scatterTierKey } from '../../utils/scatterTier';
import { fmt, fmtX } from '../../utils/huntCalc';

function SortableBonusRow({
  bonus,
  reqX,
  opening = false,
  isCurrent = false,
  onJump,
  onWin,
  onStake,
  onRemove,
  onSetTier,
  onToggleHidden,
  onDefer,
  onCaller,
  editingCaller,
  setEditingCaller,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bonus.id, disabled: opening });
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
      className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-1.5 border-b border-white/5 transition-colors ${
        isCurrent
          ? 'bg-purple-gamba/15 border-purple-gamba/30'
          : 'hover:bg-zinc-broadcast/40'
      }`}
    >
      {opening ? (
        <button
          type="button"
          onClick={() => onJump && onJump(bonus.id)}
          title="Jump to this slot"
          className={`p-1 shrink-0 ${isCurrent ? 'text-purple-bright' : 'text-white/25 hover:text-white/65'}`}
        >
          <Play size={13} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 text-white/25 hover:text-white/65 cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
      )}
      <div className="min-w-0">
        <span className="flex items-center gap-1.5 min-w-0 font-bold text-white-body">
          {/* Tier pill — click cycles regular → super → five → regular.
              Shift-click toggles the hidden modifier when already at five. */}
          <button
            type="button"
            onClick={(e) => {
              const tier = scatterTierKey(bonus);
              if (e.shiftKey && tier === 'five') {
                onToggleHidden(bonus.id);
                return;
              }
              const nextTier =
                tier === 'regular' ? 'super' : tier === 'super' ? 'five' : 'regular';
              onSetTier(bonus.id, nextTier);
            }}
            title="Click: cycle tier (regular → super → 5 scatter). Shift-click on 5 scatter: toggle hidden."
            className="shrink-0 leading-none"
          >
            {scatterTierKey(bonus) === 'regular' ? (
              <span className="px-1 py-0.5 text-[0.5rem] font-bold tracking-eyebrow-md uppercase font-mono border border-white/15 text-white/30 hover:text-white/60 hover:border-white/30 leading-none">
                tier
              </span>
            ) : (
              <ScatterPill bonus={bonus} size="sm" />
            )}
          </button>
          <span className="truncate">{bonus.slot}</span>
          {bonus.deferred && (
            <span className="shrink-0 px-1 py-0.5 text-[0.5rem] font-bold tracking-eyebrow-md uppercase font-mono border border-orange-admin/60 text-orange-admin leading-none">
              Later
            </span>
          )}
        </span>
        {/* Caller — click to edit inline. */}
        {editingCaller ? (
          <input
            type="text"
            list="hunt-callers"
            autoFocus
            defaultValue={bonus.caller || ''}
            onBlur={(e) => {
              onCaller(bonus.id, e.target.value);
              setEditingCaller(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onCaller(bonus.id, e.target.value);
                setEditingCaller(null);
              }
              if (e.key === 'Escape') setEditingCaller(null);
            }}
            placeholder="Caller"
            className="mt-0.5 w-32 bg-zinc-broadcast/80 border border-purple-gamba/50 px-1.5 py-0.5 text-[0.6875rem] text-white-body focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingCaller(bonus.id)}
            title="Set slot caller"
            className="mt-0.5 block text-[0.625rem] font-mono tracking-eyebrow-md uppercase truncate max-w-full text-left transition-colors"
          >
            {bonus.caller ? (
              <span className="text-purple-bright">📣 {bonus.caller}</span>
            ) : (
              <span className="text-white/25 hover:text-white/50">
                + caller
              </span>
            )}
          </button>
        )}
      </div>
      {opening ? (
        <span className="w-20 px-2 py-1 text-sm text-right text-white/70 tabular-nums">
          {fmt(bonus.stake)}
        </span>
      ) : (
        <input
          type="number"
          value={bonus.stake || ''}
          onChange={(e) => onStake(bonus.id, e.target.value)}
          placeholder="—"
          aria-label="Bet"
          className="w-20 bg-zinc-broadcast/60 border border-white/10 px-2 py-1 text-sm text-right focus:border-emerald-signal/70 focus:outline-none placeholder:text-white/20 tabular-nums"
        />
      )}
      <input
        type="number"
        value={bonus.win || ''}
        onChange={(e) => onWin(bonus.id, e.target.value)}
        placeholder="—"
        aria-label="Win"
        className="w-24 bg-zinc-broadcast/60 border border-white/10 px-2 py-1 text-sm text-right focus:border-emerald-signal/70 focus:outline-none placeholder:text-white/20 tabular-nums"
      />
      <span
        className={`text-right font-bold tabular-nums px-1 w-16 ${
          x != null && x >= (reqX ?? 0)
            ? 'text-emerald-signal'
            : 'text-white/70'
        }`}
      >
        {x != null ? fmtX(x) : '—'}
      </span>
      {opening ? (
        <button
          type="button"
          onClick={() => onDefer(bonus.id)}
          title={
            bonus.deferred
              ? 'Bring back into order'
              : 'Come back to this slot later'
          }
          className={`p-1 border transition-colors ${
            bonus.deferred
              ? 'border-orange-admin/60 text-orange-admin bg-orange-admin/10'
              : 'border-white/15 text-white/40 hover:text-white-body hover:border-white/30'
          }`}
          aria-label="Defer slot"
        >
          <Clock size={11} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onRemove(bonus.id)}
          className="p-1 border border-red-destructive/30 text-red-destructive/80 hover:bg-red-destructive/15 transition-colors"
          aria-label="Remove bonus"
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function BonusTable({
  rowList,
  bonuses,
  reqX,
  phase,
  currentBonus,
  totalStakes,
  totalWins,
  bonusSort,
  onCycleStakeSort,
  onJump,
  onWin,
  onStake,
  onRemove,
  onSetTier,
  onToggleHidden,
  onDefer,
  onCaller,
  editingCallerId,
  setEditingCallerId,
  onDragEnd,
}) {
  // Drag sensors must be created unconditionally (before any early return).
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (bonuses.length === 0) {
    return (
      <p className="text-center text-white/55 py-6 text-[0.75rem] font-mono">
        Nothing logged yet. Call the first slot.
      </p>
    );
  }

  return (
    <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
      <div className="min-w-[480px] text-sm">
        {/* Column headers */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-2 border-b border-white/10 bg-zinc-broadcast/50 sticky top-0 z-10 text-white/65 text-[0.625rem] uppercase tracking-eyebrow-md font-mono font-bold">
          <span className="w-6" aria-hidden="true" />
          <span className="text-left">Slot</span>
          {phase === 'opening' ? (
            <span className="text-right w-20 px-1">Bet</span>
          ) : (
            <button
              type="button"
              onClick={onCycleStakeSort}
              title={
                bonusSort == null
                  ? 'Sort by bet (high to low)'
                  : bonusSort === 'stake-desc'
                    ? 'Sort by bet (low to high)'
                    : 'Clear sort — back to manual order'
              }
              className={`text-right w-20 px-1 inline-flex items-center justify-end gap-1 uppercase tracking-eyebrow-md transition-colors ${
                bonusSort
                  ? 'text-emerald-signal'
                  : 'hover:text-white-body'
              }`}
            >
              Bet
              {bonusSort === 'stake-desc' ? (
                <ArrowDown size={11} aria-hidden="true" />
              ) : bonusSort === 'stake-asc' ? (
                <ArrowUp size={11} aria-hidden="true" />
              ) : (
                <ArrowUpDown
                  size={11}
                  aria-hidden="true"
                  className="text-white/30"
                />
              )}
            </button>
          )}
          <span className="text-right w-24">Win</span>
          <span className="text-right w-16 px-1">X</span>
          <span className="w-6" aria-hidden="true" />
        </div>
        {/* Sortable rows. Drag only in manual mode (bonusSort == null);
            while a stake sort is active the list is a read-only lens.
            Capped height with internal scroll so a long hunt does not
            stretch the page; header + totals pin above/below. */}
        <CappedScroll maxClass="max-h-[60vh]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={rowList.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {rowList.map((b) => (
                <SortableBonusRow
                  key={b.id}
                  bonus={b}
                  reqX={reqX}
                  opening={phase === 'opening'}
                  isCurrent={
                    phase === 'opening' && currentBonus?.id === b.id
                  }
                  onJump={onJump}
                  onWin={onWin}
                  onStake={onStake}
                  onRemove={onRemove}
                  onSetTier={onSetTier}
                  onToggleHidden={onToggleHidden}
                  onDefer={onDefer}
                  onCaller={onCaller}
                  editingCaller={editingCallerId === b.id}
                  setEditingCaller={setEditingCallerId}
                />
              ))}
            </SortableContext>
          </DndContext>
        </CappedScroll>
        {/* Totals */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center px-2 py-2 border-t border-white/10 bg-zinc-broadcast/50 sticky bottom-0 z-10 text-[0.625rem] uppercase tracking-eyebrow-md font-mono font-bold text-white/70">
          <span className="w-6" aria-hidden="true" />
          <span className="text-left text-white/65">Totals</span>
          <span className="text-right w-20 px-1 tabular-nums">
            {fmt(totalStakes)}
          </span>
          <span className="text-right w-24 tabular-nums">
            {fmt(totalWins)}
          </span>
          <span className="w-16 px-1" aria-hidden="true" />
          <span className="w-6" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
