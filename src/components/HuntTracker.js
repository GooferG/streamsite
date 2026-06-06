import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  X,
  Users,
  TrendingDown,
  Download,
  CheckCircle2,
  Pencil,
  ArrowLeft,
  Play,
  Radio,
  Trash2,
  MoreHorizontal,
  HelpCircle,
} from 'lucide-react';
import { arrayMove } from '@dnd-kit/sortable';
import SlotAutocomplete from './SlotAutocomplete';
import SuggestionsPanel from './SuggestionsPanel';
import ViewerCalls from './hunt/ViewerCalls';
import HuntStartScreen from './HuntStartScreen';
import Modal from './Modal';
import StatCell from './StatCell';
import CopyLinkButton from './CopyLinkButton';
import HuntLinkControls from './HuntLinkControls';
import HuntTour from './HuntTour';
import PanelLabel from './hunt/PanelLabel';
import BonusTable from './hunt/BonusTable';
import OpeningFocus from './hunt/OpeningFocus';
import HuntHero from './hunt/HuntHero';
import HuntStatGrid from './hunt/HuntStatGrid';
import CallerStatsPanel from './hunt/CallerStatsPanel';
import CallerLogDrawer from './hunt/CallerLogDrawer';
import { useHuntStore } from '../hooks/useHuntStore';
import useTuningPhrase from '../hooks/useTuningPhrase';
import { useFirstVisit } from '../hooks/useFirstVisit';
import {
  fmt,
  makeId,
  computeStats,
  openingOrder,
} from '../utils/huntCalc';
import { renderSplit, renderRecap } from '../utils/huntExport';
import { authedFetch } from '../utils/authedFetch';

const inputCls =
  'bg-zinc-broadcast/60 border border-white/10 px-3.5 py-2.5 text-sm text-white-body placeholder:text-white/50 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

export default function HuntTracker() {
  const store = useHuntStore();
  const tuningPhrase = useTuningPhrase(store.status === 'loading');
  const {
    status,
    activeHunt,
    history,
    isLoggedIn,
    localHuntPending,
    error,
    startHunt,
    updateHunt,
    appendSkippedCalls,
    updateSuggestions,
    completeHunt,
    discardActiveHunt,
    reopenHunt,
    deleteHistoryHunt,
    claimLocalHunt,
    discardLocalHunt,
    shareId,
    startSharing,
    stopSharing,
  } = store;

  // transient input state (not persisted until added)
  const [slotInput, setSlotInput] = useState('');
  const [stakeInput, setStakeInput] = useState('');
  // Add-form scatter tier: 'regular' | 'super' | 'five'. `hiddenInput` only applies to 'five'.
  const [tierInput, setTierInput] = useState('regular');
  const [hiddenInput, setHiddenInput] = useState(false);
  const [callerInput, setCallerInput] = useState('');
  // "Caller is hot": when on, the caller persists across adds (one person calling
  // several slots in a row). Session-only, not persisted. Focus returns to the slot
  // field after each add via slotRef.
  const [callerHot, setCallerHot] = useState(false);
  const slotRef = useRef(null);
  const [editingCallerId, setEditingCallerId] = useState(null);
  // Header overflow menu + coachmark tour.
  const [menuOpen, setMenuOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourSeen, markTourSeen] = useFirstVisit('huntTourSeen');
  // Bonus-list sort lens: null = manual order (drag enabled), or 'stake-desc'/'stake-asc'.
  const [bonusSort, setBonusSort] = useState(null);
  const [gamblerNameInput, setGamblerNameInput] = useState('');
  const [gamblerInInput, setGamblerInInput] = useState('');
  const [editingGamblerId, setEditingGamblerId] = useState(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  // Stake prompt when promoting a suggestion to a real bonus.
  // { person, slot } while open, else null.
  const [landingSuggestion, setLandingSuggestion] = useState(null);
  const [landStakeInput, setLandStakeInput] = useState('');
  // "Hunt complete" wrap-up prompt — opened by Enter on the last opening slot.
  // Asks for finish balance, then Complete + Export. Dismissible (non-destructive).
  const [showWrapUp, setShowWrapUp] = useState(false);
  // Suggestion-intake link controls.
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState(null);
  // Caller call-log drawer — holds the caller name while open, else null.
  const [callerLogName, setCallerLogName] = useState(null);

  // First-visit coachmark tour: auto-open once on the first active view, for
  // both owners and logged-out visitors (the tour rewords its owner-only steps
  // for anon and nudges login). Replay is via the header overflow.
  useEffect(() => {
    if (status === 'active' && !tourSeen) {
      setTourOpen(true);
    }
  }, [status, tourSeen]);

  // ---------- LOADING (auth rehydrating) ----------
  if (status === 'loading') {
    return (
      <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
        <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
          {tuningPhrase}
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
        onReopenHunt={reopenHunt}
        onDeleteHunt={deleteHistoryHunt}
      />
    );
  }

  // ---------- ACTIVE ----------
  const bonuses = activeHunt.bonuses ?? [];
  const gamblers = activeHunt.gamblers ?? [];
  const startBalance = activeHunt.startBalance ?? '';
  const finishBalance = activeHunt.finishBalance ?? '';
  const bannedSlots = activeHunt.bannedSlots ?? '';
  const suggestions = activeHunt.suggestions ?? [];
  const skippedCalls = activeHunt.skippedCalls ?? [];
  const phase = activeHunt.phase === 'opening' ? 'opening' : 'collecting';

  // Opening-phase order + clamped current index.
  const order = openingOrder(bonuses);
  const openingIdx = Math.min(
    Math.max(0, activeHunt.openingIndex ?? 0),
    Math.max(0, order.length - 1)
  );
  const currentBonus = order[openingIdx] || null;
  const openedCount = bonuses.filter((b) => (Number(b.win) || 0) > 0).length;

  function startOpening() {
    updateHunt({ phase: 'opening', openingIndex: 0 });
  }
  function backToCollecting() {
    updateHunt({ phase: 'collecting' });
  }
  function gotoOpening(idx) {
    updateHunt({
      openingIndex: Math.min(Math.max(0, idx), Math.max(0, order.length - 1)),
    });
  }
  function advanceOpening() {
    gotoOpening(openingIdx + 1);
  }
  function prevOpening() {
    gotoOpening(openingIdx - 1);
  }
  function toggleDeferred(id) {
    updateHunt({
      bonuses: bonuses.map((b) =>
        b.id === id ? { ...b, deferred: !b.deferred } : b
      ),
    });
  }

  function addBonus() {
    if (!slotInput.trim()) return;
    const next = [
      ...bonuses,
      {
        id: makeId(),
        slot: slotInput.trim(),
        stake: Number(stakeInput) || 0,
        win: 0,
        super: tierInput === 'super',
        fiveScat: tierInput === 'five',
        hidden: tierInput === 'five' && hiddenInput,
        caller: callerInput.trim(),
      },
    ];
    updateHunt({ bonuses: next });
    setSlotInput('');
    setStakeInput('');
    setTierInput('regular');
    setHiddenInput(false);
    if (!callerHot) setCallerInput('');
    slotRef.current?.focus();
  }
  function removeBonus(id) {
    updateHunt({ bonuses: bonuses.filter((b) => b.id !== id) });
  }
  function updateBonusWin(id, val) {
    updateHunt({
      bonuses: bonuses.map((b) =>
        b.id === id ? { ...b, win: Number(val) || 0 } : b
      ),
    });
  }
  function updateBonusStake(id, val) {
    updateHunt({
      bonuses: bonuses.map((b) =>
        b.id === id ? { ...b, stake: Number(val) || 0 } : b
      ),
    });
  }
  // Set the exclusive scatter tier on an existing bonus. tier ∈ 'regular'|'super'|'five'.
  // Keeps the legacy booleans mutually exclusive and resets `hidden` on any tier change.
  function setBonusTier(id, tier) {
    updateHunt({
      bonuses: bonuses.map((b) =>
        b.id === id
          ? { ...b, super: tier === 'super', fiveScat: tier === 'five', hidden: false }
          : b
      ),
    });
  }
  // Toggle the `hidden` modifier (only meaningful on a five-scatter bonus).
  function toggleBonusHidden(id) {
    updateHunt({
      bonuses: bonuses.map((b) =>
        b.id === id ? { ...b, hidden: b.fiveScat ? !b.hidden : false } : b
      ),
    });
  }
  function updateBonusCaller(id, value) {
    updateHunt({
      bonuses: bonuses.map((b) =>
        b.id === id ? { ...b, caller: value.trim() } : b
      ),
    });
  }
  function updateBonusNote(id, value) {
    updateHunt({
      bonuses: bonuses.map((b) => (b.id === id ? { ...b, note: value } : b)),
    });
  }
  function saveName() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== activeHunt.name) updateHunt({ name: trimmed });
    setEditingName(false);
  }

  // ---- Slot suggestions (imported from the sheet) ----
  // mode 'replace' swaps the whole list; 'merge' appends new people.
  function importSuggestions(people, mode) {
    const next = mode === 'merge' ? [...suggestions, ...people] : people;
    updateSuggestions(next);
  }
  function clearSuggestions() {
    updateSuggestions([]);
  }
  // Skip a viewer call: record it against the caller (accept-rate), then mark
  // the suggestion 'passed' so it leaves the open list.
  function skipCall(person, slot) {
    appendSkippedCalls([{ caller: person, slot: slot.name, ts: Date.now() }]);
    updateSuggestions(
      suggestions.map((p) => ({
        ...p,
        slots: p.slots.map((s) => (s.id === slot.id ? { ...s, status: 'passed' } : s)),
      }))
    );
  }
  function skipAllCalls(person, slots) {
    appendSkippedCalls(slots.map((s) => ({ caller: person, slot: s.name, ts: Date.now() })));
    const ids = new Set(slots.map((s) => s.id));
    updateSuggestions(
      suggestions.map((p) => ({
        ...p,
        slots: p.slots.map((s) => (ids.has(s.id) ? { ...s, status: 'passed' } : s)),
      }))
    );
  }
  // "Got in" — open the stake prompt for this suggested slot.
  function startLanding(person, slot) {
    setLandingSuggestion({ person, slot });
    setLandStakeInput('');
  }
  // Confirm the stake → push a real bonus (caller = suggester) and mark the
  // suggestion done. Bonus goes via updateHunt (merge-safe debounced write);
  // the suggestion status via updateSuggestions (targeted field write) so the
  // two writes don't ride together and can't clobber a public submission.
  function confirmLanding() {
    if (!landingSuggestion) return;
    const { person, slot } = landingSuggestion;
    const newBonus = {
      id: makeId(),
      slot: slot.name,
      stake: Number(landStakeInput) || 0,
      win: 0,
      super: false,
      fiveScat: false,
      hidden: false,
      caller: person,
    };
    updateHunt({ bonuses: [...bonuses, newBonus] });
    updateSuggestions(
      suggestions.map((p) => ({
        ...p,
        slots: p.slots.map((s) =>
          s.id === slot.id ? { ...s, status: 'done' } : s
        ),
      }))
    );
    setLandingSuggestion(null);
    setLandStakeInput('');
  }

  // ---- Suggestion-intake link (password-gated public submissions) ----
  async function createIntakeLink(password) {
    setLinkBusy(true);
    setLinkError(null);
    try {
      const r = await authedFetch('/api/hunt-suggest/manage', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLinkError(
          data.error === 'PASSWORD_TOO_SHORT'
            ? 'Password too short.'
            : data.error === 'NO_ACTIVE_HUNT'
              ? 'Start a hunt first.'
              : 'Could not create the link.'
        );
        return;
      }
      // Persist on the hunt so the link survives reloads + is owner-visible.
      // password === '' means an open link (no password gate).
      updateHunt({
        intakeLinkId: data.linkId,
        intakeOpen: true,
        intakeRequiresPassword: Boolean(password),
      });
    } catch {
      setLinkError('Could not create the link.');
    } finally {
      setLinkBusy(false);
    }
  }
  async function toggleIntakeOpen(open) {
    if (!activeHunt.intakeLinkId) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      const r = await authedFetch('/api/hunt-suggest/manage', {
        method: 'POST',
        body: JSON.stringify({
          action: 'toggle',
          linkId: activeHunt.intakeLinkId,
          open,
        }),
      });
      if (!r.ok) {
        setLinkError('Could not update the link.');
        return;
      }
      updateHunt({ intakeOpen: open });
    } catch {
      setLinkError('Could not update the link.');
    } finally {
      setLinkBusy(false);
    }
  }
  async function deleteIntakeLink() {
    if (!activeHunt.intakeLinkId) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      await authedFetch('/api/hunt-suggest/manage', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          linkId: activeHunt.intakeLinkId,
        }),
      });
    } catch {
      // Best-effort — clear locally regardless so the UI doesn't get stuck.
    } finally {
      // Null out rather than delete — updateHunt merges a patch, so explicit
      // nulls are how we clear fields. The UI treats null linkId as "no link".
      updateHunt({ intakeLinkId: null, intakeOpen: null });
      setLinkBusy(false);
    }
  }
  function handleBonusDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Reorder against the CURRENTLY VISIBLE order. If a stake sort is active,
    // dragging bakes that sorted order in as the new manual order and releases
    // the sort — so you can sort by bet size, then hand-tweak from there.
    const current =
      bonusSort == null
        ? bonuses
        : [...bonuses].sort((a, b) =>
            bonusSort === 'stake-asc'
              ? (Number(a.stake) || 0) - (Number(b.stake) || 0)
              : (Number(b.stake) || 0) - (Number(a.stake) || 0)
          );
    const oldIndex = current.findIndex((b) => b.id === active.id);
    const newIndex = current.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    if (bonusSort != null) setBonusSort(null);
    updateHunt({ bonuses: arrayMove(current, oldIndex, newIndex) });
  }
  function addGambler() {
    if (
      !gamblerNameInput.trim() ||
      !gamblerInInput ||
      Number(gamblerInInput) <= 0
    )
      return;
    updateHunt({
      gamblers: [
        ...gamblers,
        {
          id: makeId(),
          name: gamblerNameInput.trim(),
          inFor: Number(gamblerInInput),
        },
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
    updateHunt({
      gamblers: gamblers.map((g) => (g.id === id ? { ...g, inFor: num } : g)),
    });
  }

  async function handleComplete() {
    const completed = await completeHunt();
    if (completed) renderRecap(completed);
    setConfirmingComplete(false);
    setShowWrapUp(false);
  }

  const shareUrl = shareId ? `${window.location.origin}/live/${shareId}` : null;

  const stats = computeStats(activeHunt);
  const totalStakes = stats.totalStakes;
  const totalWins = stats.totalWins;
  const reqX = stats.reqX;
  const profit = stats.profit;
  const runningProfit = stats.runningProfit;
  const wlMultiplier = stats.wlMultiplier;
  const totalBuyIns = stats.totalBuyIns;

  const gamblerRows = gamblers.map((g) => {
    const pct = totalBuyIns > 0 ? (g.inFor / totalBuyIns) * 100 : 0;
    const payout =
      finishBalance !== '' && totalBuyIns > 0
        ? (pct / 100) * Number(finishBalance)
        : null;
    return { ...g, pct, payout };
  });

  // Sort is a display lens — it never rewrites the saved order. Manual
  // (drag) order is preserved and restored when the sort is cleared.
  const displayBonuses =
    bonusSort == null
      ? bonuses
      : [...bonuses].sort((a, b) =>
          bonusSort === 'stake-asc'
            ? (Number(a.stake) || 0) - (Number(b.stake) || 0)
            : (Number(b.stake) || 0) - (Number(a.stake) || 0)
        );

  // none -> desc -> asc -> none
  function cycleStakeSort() {
    setBonusSort((s) =>
      s == null ? 'stake-desc' : s === 'stake-desc' ? 'stake-asc' : null
    );
  }

  // The list under the panel: opening order while opening, else the sort lens.
  const rowList = phase === 'opening' ? order : displayBonuses;

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      {/* Hunt header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/8">
        <div className="min-w-0">
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-0.5">
            ▸ {phase === 'opening' ? 'Opening slots' : 'Active hunt'}
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
        {/* Phase toggle — grouped with identity, it is a mode switch */}
        {phase === 'collecting' ? (
          <button
            type="button"
            onClick={startOpening}
            disabled={bonuses.length === 0}
            data-html2canvas-ignore="true"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-gamba text-white-body hover:bg-purple-bright transition-colors duration-150 disabled:opacity-40"
          >
            <Play size={12} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">
              START OPENING
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={backToCollecting}
            data-html2canvas-ignore="true"
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/15 text-white/70 hover:text-white-body hover:border-white/30 transition-colors duration-150"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">
              EDIT BONUSES
            </span>
          </button>
        )}
        <div className="ml-auto flex gap-2 items-center" data-html2canvas-ignore="true">
          {/* Primary actions — spotlit by the tour */}
          <div data-tour="complete-actions" className="flex gap-2 items-center">
            <button
              type="button"
              disabled
              title="Collab — coming soon"
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 text-white/30 cursor-not-allowed"
            >
              <Users size={12} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">COLLAB</span>
            </button>
            <button
              type="button"
              onClick={() => renderSplit(activeHunt)}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-signal/40 text-emerald-signal hover:bg-emerald-signal/10 transition-colors duration-150"
            >
              <Download size={12} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">
                EXPORT SPLIT
              </span>
            </button>
            {!confirmingComplete ? (
              <button
                type="button"
                onClick={() => setConfirmingComplete(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150"
              >
                <CheckCircle2 size={12} aria-hidden="true" />
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">
                  COMPLETE
                </span>
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleComplete}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
                >
                  <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">
                    CONFIRM + EXPORT
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingComplete(false)}
                  className="px-3 py-1.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
                >
                  <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">
                    CANCEL
                  </span>
                </button>
              </div>
            )}
          </div>
          {/* Discard confirm — only while confirming, never an always-on button */}
          {confirmingDiscard && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await discardActiveHunt();
                  setConfirmingDiscard(false);
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 transition-colors duration-150"
              >
                <Trash2 size={12} aria-hidden="true" />
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">
                  DISCARD HUNT
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDiscard(false)}
                className="px-3 py-1.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
              >
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg">
                  KEEP
                </span>
              </button>
            </div>
          )}
          {/* Overflow: tour replay + discard */}
          {!confirmingComplete && !confirmingDiscard && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="More"
                className="w-8 h-8 inline-flex items-center justify-center border border-white/10 text-white/45 hover:text-white-body hover:border-white/30 transition-colors"
              >
                <MoreHorizontal size={14} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 w-44 border border-white/15 bg-zinc-card shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setTourOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-white/70 hover:bg-white/5 inline-flex items-center gap-2"
                  >
                    <HelpCircle size={12} aria-hidden="true" /> How it works
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmingDiscard(true);
                    }}
                    className="w-full text-left px-3 py-2 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-white/60 hover:text-red-destructive hover:bg-red-destructive/10 inline-flex items-center gap-2"
                  >
                    <Trash2 size={12} aria-hidden="true" /> Discard hunt
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Broadcast & collect bar — owner only */}
      {isLoggedIn && (
        <div
          data-tour="share-bar"
          data-html2canvas-ignore="true"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-4 py-3 border-b border-white/8 bg-purple-gamba/5"
        >
          {/* WATCH track */}
          <div className="border border-white/10 bg-zinc-broadcast/40 p-2.5">
            <p className="flex items-center gap-2 text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-red-destructive mb-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${shareId ? 'bg-red-destructive animate-pulse' : 'bg-white/25'}`}
              />
              Watch{shareId ? ' · live' : ''}
            </p>
            {shareId ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 bg-zinc-broadcast/60 border border-white/10 px-2.5 py-2 text-[0.6875rem] font-mono text-white/70 focus:outline-none"
                />
                <CopyLinkButton
                  url={shareUrl}
                  label="Copy watch link"
                  iconClassName="text-red-destructive"
                />
                <button
                  type="button"
                  onClick={stopSharing}
                  title="Stop sharing. Link dies."
                  className="px-2.5 py-2 border border-red-destructive/55 text-red-300 hover:bg-red-destructive/15 transition-colors text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono"
                >
                  Stop
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startSharing}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-red-destructive/40 text-red-300 hover:bg-red-destructive/10 transition-colors duration-150"
              >
                <Radio size={13} aria-hidden="true" />
                <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Go live
                </span>
              </button>
            )}
          </div>
          {/* COLLECT track */}
          <div className="border border-white/10 bg-zinc-broadcast/40 p-2.5">
            <p className="flex items-center gap-2 text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-purple-bright mb-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeHunt.intakeLinkId && activeHunt.intakeOpen !== false
                    ? 'bg-emerald-signal animate-pulse'
                    : 'bg-white/25'
                }`}
              />
              Collect
            </p>
            <HuntLinkControls
              linkId={activeHunt.intakeLinkId || null}
              linkOpen={activeHunt.intakeOpen !== false}
              linkBusy={linkBusy}
              linkError={linkError}
              linkRequiresPassword={Boolean(activeHunt.intakeRequiresPassword)}
              onCreateLink={createIntakeLink}
              onToggleLink={toggleIntakeOpen}
              onDeleteLink={deleteIntakeLink}
            />
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
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
            <span className="text-red-destructive normal-case tracking-normal">
              {error}
            </span>
          </>
        )}
      </div>

      {/* Stat grid — hero P/L + 4-up secondary */}
      <div data-tour="stats" className="border-b border-white/8 bg-emerald-signal/[0.03] px-4 py-4">
        <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
          <HuntHero
            profit={profit != null ? profit : runningProfit}
            avgReqRemaining={stats.avgReqRemaining}
            totalWins={totalWins}
            start={stats.start}
            wlMultiplier={wlMultiplier}
          />
          <HuntStatGrid
            stats={stats}
            bonusCount={bonuses.length}
            pendingCount={bonuses.length - openedCount}
          />
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <label className="block">
            <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              Start bal
            </span>
            <input
              type="number"
              placeholder="0.00"
              value={startBalance}
              onChange={(e) => updateHunt({ startBalance: e.target.value })}
              className={`w-28 ${inputCls} tabular-nums`}
            />
          </label>
          <label className="block">
            <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              Finish bal
            </span>
            <input
              type="number"
              placeholder="0.00"
              value={finishBalance}
              onChange={(e) => updateHunt({ finishBalance: e.target.value })}
              className={`w-28 ${inputCls} tabular-nums`}
            />
          </label>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-5">
        <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6">
          {/* LEFT — Bonus list */}
          <div className="space-y-4">
            <PanelLabel
              code="01"
              label={phase === 'opening' ? 'Opening slots' : 'Bonus list'}
              accent={phase === 'opening' ? 'purple' : 'emerald'}
            />

            {/* OPENING — centered focus card */}
            {phase === 'opening' && currentBonus && (
              <OpeningFocus
                order={order}
                idx={openingIdx}
                openedCount={openedCount}
                onWin={updateBonusWin}
                onNote={updateBonusNote}
                onPrev={prevOpening}
                onNext={advanceOpening}
                onDefer={toggleDeferred}
                onExit={backToCollecting}
                onFinish={() => setShowWrapUp(true)}
              />
            )}

            {/* COLLECTING — add bonus form */}
            {phase === 'collecting' && (
              <div
                data-tour="add-form"
                className="border border-white/8 bg-zinc-broadcast/40 p-4 space-y-3"
              >
                <SlotAutocomplete
                  ref={slotRef}
                  value={slotInput}
                  onChange={setSlotInput}
                  placeholder="Slot name"
                  className={`w-full ${inputCls}`}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                />
                <input
                  type="number"
                  placeholder="Bet ($)"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                  className={`w-full ${inputCls}`}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    list="hunt-callers"
                    placeholder="Slot caller (optional)"
                    value={callerInput}
                    onChange={(e) => setCallerInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addBonus()}
                    className={`flex-1 ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={() => setCallerHot((h) => !h)}
                    aria-pressed={callerHot}
                    title={callerHot ? 'Caller is hot — kept after each bonus. Click to clear after add.' : 'Keep this caller after logging each bonus'}
                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-2.5 border transition-colors duration-150 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono ${
                      callerHot
                        ? 'border-orange-admin bg-orange-admin/10 text-orange-admin'
                        : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
                    }`}
                  >
                    {callerHot ? '🔥 Hot' : 'Hot?'}
                  </button>
                </div>
                <datalist id="hunt-callers">
                  {gamblers.map((g) => (
                    <option key={g.id} value={g.name} />
                  ))}
                </datalist>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'regular', label: 'Regular', active: 'border-white/30 bg-white/5 text-white-body' },
                      { key: 'super', label: 'Super', active: 'border-orange-admin bg-orange-admin/10 text-orange-admin' },
                      { key: 'five', label: '5 Scatter', active: 'border-gold-scatter bg-gold-scatter/10 text-gold-scatter' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setTierInput(opt.key);
                          if (opt.key !== 'five') setHiddenInput(false);
                        }}
                        aria-pressed={tierInput === opt.key}
                        className={`inline-flex items-center justify-center px-3 py-2.5 border transition-colors duration-150 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono ${
                          tierInput === opt.key
                            ? opt.active
                            : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {tierInput === 'five' && (
                    <button
                      type="button"
                      onClick={() => setHiddenInput((h) => !h)}
                      aria-pressed={hiddenInput}
                      className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 border transition-colors duration-150 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono ${
                        hiddenInput
                          ? 'border-gold-scatter bg-gold-scatter text-zinc-broadcast'
                          : 'border-gold-scatter/40 text-gold-scatter/80 hover:border-gold-scatter'
                      }`}
                    >
                      {hiddenInput ? '★ Hidden 5 scatter' : 'Mark as hidden'}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addBonus}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
                >
                  <Plus size={14} aria-hidden="true" />
                  <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                    Log bonus
                  </span>
                </button>
              </div>
            )}

            <BonusTable
              rowList={rowList}
              bonuses={bonuses}
              reqX={reqX}
              phase={phase}
              currentBonus={currentBonus}
              totalStakes={totalStakes}
              totalWins={totalWins}
              bonusSort={bonusSort}
              onCycleStakeSort={cycleStakeSort}
              onJump={(id) =>
                gotoOpening(order.findIndex((o) => o.id === id))
              }
              onWin={updateBonusWin}
              onStake={updateBonusStake}
              onRemove={removeBonus}
              onSetTier={setBonusTier}
              onToggleHidden={toggleBonusHidden}
              onDefer={toggleDeferred}
              onCaller={updateBonusCaller}
              editingCallerId={editingCallerId}
              setEditingCallerId={setEditingCallerId}
              onDragEnd={handleBonusDragEnd}
            />
          </div>

          {/* RIGHT — Split / Banned / Suggestions / Callers (quiet) */}
          <div className="space-y-5">

            <div className="space-y-3">
              <PanelLabel
                icon={Users}
                label="Squad split"
                accent="purple"
                quiet
              />
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
                <p className="text-center text-white/55 py-4 text-[0.75rem] font-mono">
                  No squad yet.
                </p>
              ) : (
                <div className="border border-white/8 overflow-x-auto overflow-y-auto max-h-[60vh] [scrollbar-width:thin]">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-white/10 text-white/65 text-[0.625rem] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono sticky top-0 z-10">
                        <th className="text-left px-3 py-2 font-bold">Name</th>
                        <th className="text-right px-3 py-2 font-bold">
                          In for
                        </th>
                        <th className="text-right px-3 py-2 font-bold">%</th>
                        <th className="text-right px-3 py-2 font-bold">
                          Payout
                        </th>
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
                      <tr className="border-t border-white/10 bg-zinc-broadcast/50 text-[0.625rem] uppercase tracking-eyebrow-md font-mono sticky bottom-0 z-10">
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

            {/* Single home for viewer calls: intake (import / add registered
                viewer / clear) feeds the list; triage is Add → hunt, Skip →
                passed. Every suggestion shows in exactly one place. */}
            <ViewerCalls
              suggestions={suggestions}
              onAdd={(person, slot) => startLanding(person, slot)}
              onSkip={skipCall}
              onSkipAll={skipAllCalls}
              onOpenLog={setCallerLogName}
              intakeControls={
                <SuggestionsPanel
                  suggestions={suggestions}
                  onImport={importSuggestions}
                  onClear={clearSuggestions}
                  isLoggedIn={isLoggedIn}
                />
              }
            />

            <div className="space-y-2">
              <PanelLabel
                icon={TrendingDown}
                label="Soft banned"
                accent="orange"
                quiet
              />
              <textarea
                placeholder="Slots to avoid this hunt. Comma or newline separated."
                value={bannedSlots}
                onChange={(e) => updateHunt({ bannedSlots: e.target.value })}
                rows={3}
                className={`w-full ${inputCls} resize-none`}
              />
            </div>

            {/* Caller stats (05) */}
            <CallerStatsPanel
              bonuses={bonuses}
              history={history}
              skippedCalls={skippedCalls}
              onOpenLog={setCallerLogName}
            />
          </div>
        </div>
      </div>

      {/* Wrap-up prompt — last slot opened, ready to finish the hunt */}
      {showWrapUp && (
        <Modal
          onClose={() => setShowWrapUp(false)}
          label="Hunt complete"
          panelClassName="w-full max-w-md border border-emerald-signal/40 bg-zinc-card p-5 space-y-4"
        >
          <div>
            <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-1">
              ▸ Hunt complete
            </p>
            <p className="text-sm text-white/65 leading-snug">
              All slots opened. Fill in the finish balance, then export the
              results.
            </p>
          </div>
          <label className="block">
            <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              Finish balance ($)
            </span>
            <input
              type="number"
              autoFocus
              placeholder="0.00"
              value={finishBalance}
              onChange={(e) => updateHunt({ finishBalance: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleComplete();
                if (e.key === 'Escape') setShowWrapUp(false);
              }}
              className={`w-full ${inputCls} tabular-nums`}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <StatCell
              label="Profit"
              value={
                profit == null ? (
                  '—'
                ) : (
                  <span
                    className={
                      profit >= 0
                        ? 'text-emerald-signal'
                        : 'text-red-destructive'
                    }
                  >
                    {profit >= 0 ? '+' : ''}
                    {fmt(profit)}
                  </span>
                )
              }
            />
            <StatCell label="Total wins" value={fmt(totalWins)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleComplete}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                Complete + Export
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowWrapUp(false)}
              className="px-4 py-2 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
            >
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                Keep editing
              </span>
            </button>
          </div>
        </Modal>
      )}

      {/* Stake prompt — promoting a suggestion into a real bonus */}
      {landingSuggestion && (
        <Modal
          onClose={() => setLandingSuggestion(null)}
          label="Bonus landed — add to hunt"
          panelClassName="w-full max-w-sm border border-emerald-signal/40 bg-zinc-card p-5 space-y-3"
        >
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono">
            ▸ Bonus landed
          </p>
          <div>
            <p className="font-black text-white-body text-xl leading-tight truncate">
              {landingSuggestion.slot.name}
            </p>
            <p className="text-[0.6875rem] font-mono text-purple-bright mt-0.5 truncate">
              📣 {landingSuggestion.person}
            </p>
          </div>
          <label className="block">
            <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/65 mb-1.5 font-mono">
              Bet ($)
            </span>
            <input
              type="number"
              autoFocus
              placeholder="0.00"
              value={landStakeInput}
              onChange={(e) => setLandStakeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmLanding();
                if (e.key === 'Escape') setLandingSuggestion(null);
              }}
              className={`w-full ${inputCls} tabular-nums`}
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={confirmLanding}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
            >
              <Plus size={14} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                Add to hunt
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLandingSuggestion(null)}
              className="px-4 py-2 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150"
            >
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                Cancel
              </span>
            </button>
          </div>
        </Modal>
      )}

      {callerLogName && (
        <CallerLogDrawer
          name={callerLogName}
          bonuses={bonuses}
          history={history}
          skippedCalls={skippedCalls}
          onClose={() => setCallerLogName(null)}
        />
      )}

      <HuntTour
        open={tourOpen}
        isLoggedIn={isLoggedIn}
        onClose={() => {
          setTourOpen(false);
          markTourSeen();
        }}
      />
    </div>
  );
}
