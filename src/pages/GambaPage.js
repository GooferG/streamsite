import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, X, LayoutGrid } from 'lucide-react';
import BonusHuntsPage from './BonusHunts';
import SuggestAdminTab from '../components/SuggestAdminTab';
import Leaderboard from '../components/Leaderboard';
import GambaHub from '../components/GambaHub';
import { GAMBA_TOOLS } from '../data/gambaTools';

// Code-split the two tools that pull in the slot DB (~874KB via ../data/slots).
// SlotPicker imports it directly; HuntTracker reaches it through SlotAutocomplete.
// Both must be lazy or the data stays in the main bundle. The data now lives in
// its own chunk and only downloads when one of these tools is opened.
const SlotPicker = lazy(() => import('../components/SlotPicker'));
const HuntTracker = lazy(() => import('../components/HuntTracker'));

// Shared on-brand fallback while a tool chunk loads.
const ToolLoading = ({ label }) => (
  <div className="border border-white/8 bg-zinc-card/30 px-4 py-16 text-center font-mono">
    <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal motion-safe:animate-pulse">
      {label}
    </p>
  </div>
);

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ChannelTab({ tool, channelNumber, active, onClick }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      data-active={active}
      className={`group relative flex items-center justify-center gap-2 px-3 lg:px-4 py-2 transition-colors duration-150 border-r border-white/8 last:border-r-0 flex-1 min-w-0 ${
        active
          ? 'bg-zinc-card text-white-body'
          : 'text-white/70 hover:text-white-body hover:bg-zinc-card/40'
      }`}
    >
      <span
        className={`text-[10px] font-bold tracking-eyebrow-md tabular-nums font-mono ${
          active ? 'text-emerald-signal' : 'text-white/55'
        }`}
      >
        CH {pad2(channelNumber)}
      </span>
      <Icon size={13} aria-hidden="true" className="opacity-80 flex-shrink-0" />
      <span className="text-xs font-bold tracking-eyebrow-sm uppercase font-mono whitespace-nowrap">
        {tool.label}
      </span>
      {active && (
        <span
          className="absolute inset-x-0 -bottom-px h-px bg-emerald-signal"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function MobileChannelTrigger({ activeIndex, onOpen }) {
  const tool = GAMBA_TOOLS[activeIndex];
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-3 py-2.5 border border-white/8 bg-zinc-card/30 hover:bg-zinc-card/50 transition-colors duration-150 text-left"
      aria-haspopup="dialog"
    >
      <span className="text-[10px] font-bold tracking-eyebrow-md tabular-nums text-emerald-signal font-mono flex-shrink-0">
        CH {pad2(activeIndex + 1)}
      </span>
      <Icon
        size={14}
        aria-hidden="true"
        className="text-emerald-signal flex-shrink-0"
      />
      <span className="text-xs font-bold tracking-eyebrow-sm uppercase font-mono text-white-body truncate flex-1">
        {tool.label}
      </span>
      <span className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/55 font-mono whitespace-nowrap">
        Tune
      </span>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className="text-white/65 flex-shrink-0"
      />
    </button>
  );
}

function MobileChannelSheet({ open, activeId, onSelect, onClose, onHub }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Switch channel"
    >
      <style>{`
        @keyframes gamba-sheet-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes gamba-sheet-slide {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .gamba-sheet-backdrop {
          animation: gamba-sheet-fade 0.18s ease-out forwards;
        }
        .gamba-sheet-panel {
          animation: gamba-sheet-slide 0.24s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .gamba-sheet-backdrop,
          .gamba-sheet-panel { animation: none; }
        }
      `}</style>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close channel picker"
        className="gamba-sheet-backdrop absolute inset-0 bg-zinc-broadcast/85 backdrop-blur-sm"
      />

      <div className="gamba-sheet-panel relative bg-zinc-card border-t border-white/10 max-h-[85vh] overflow-y-auto">
        {/* Scanline atmosphere */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
          }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
            </span>
            <span className="text-emerald-signal">Channel guide</span>
            <span className="text-white/15">·</span>
            <span className="text-white/65">Pick a tool</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 border border-white/10 text-white/65 hover:text-white-body hover:border-white/30 transition-colors"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>

        {/* Back to hub */}
        <button
          type="button"
          onClick={onHub}
          className="relative w-full flex items-center gap-3 px-4 py-3 border-b border-white/8 text-white/65 hover:text-white-body hover:bg-white/5 transition-colors duration-150"
        >
          <LayoutGrid size={14} aria-hidden="true" />
          <span className="text-xs font-bold tracking-eyebrow-sm uppercase font-mono">
            Back to hub
          </span>
        </button>

        {/* Channel list */}
        <ul className="relative">
          {GAMBA_TOOLS.map((tool, i) => {
            const Icon = tool.icon;
            const isActive = tool.id === activeId;
            return (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => onSelect(tool.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-b-0 transition-colors duration-150 text-left ${
                    isActive
                      ? 'bg-emerald-signal/8 text-white-body'
                      : 'text-white/85 hover:bg-zinc-broadcast/40'
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold tracking-eyebrow-md tabular-nums font-mono w-10 flex-shrink-0 ${
                      isActive ? 'text-emerald-signal' : 'text-white/55'
                    }`}
                  >
                    CH {pad2(i + 1)}
                  </span>
                  <span
                    className={`flex items-center justify-center w-8 h-8 border flex-shrink-0 ${
                      isActive
                        ? 'border-emerald-signal/50 text-emerald-signal bg-emerald-signal/5'
                        : 'border-white/10 text-white/70'
                    }`}
                  >
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold tracking-eyebrow-sm uppercase font-mono truncate">
                      {tool.label}
                    </span>
                    {isActive && (
                      <span className="block text-[10px] tracking-eyebrow-md uppercase text-emerald-signal/80 font-mono mt-0.5">
                        Now tuned
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <span
                      className="text-[10px] font-bold tracking-eyebrow-md uppercase text-emerald-signal font-mono whitespace-nowrap"
                      aria-hidden="true"
                    >
                      ●
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Safe-area padding for iOS home indicator */}
        <div
          className="relative"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        />
      </div>
    </div>
  );
}

export default function GambaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTool = location.pathname.split('/')[2] || null;
  const activeIndex = Math.max(
    0,
    GAMBA_TOOLS.findIndex((t) => t.id === activeTool)
  );
  const setActiveTool = (tool) => navigate(`/gamba/${tool}`);
  const goToHub = () => navigate('/gamba');
  const stripRef = useRef(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!activeTool) return;
    const strip = stripRef.current;
    if (!strip) return;
    const activeBtn = strip.querySelector('[data-active="true"]');
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [activeTool]);

  return (
    <div className="pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto">
        {activeTool ? (
          <>
            {/* Mobile/tablet — single tuner button */}
            <div className="lg:hidden">
              <MobileChannelTrigger
                activeIndex={activeIndex}
                onOpen={() => setSheetOpen(true)}
              />
            </div>

            {/* Desktop — equal-width strip with a leading Hub control */}
            <div className="hidden lg:block">
              <div
                ref={stripRef}
                className="flex border border-white/8 bg-zinc-card/30"
                role="tablist"
                aria-label="Gamba tools"
              >
                <button
                  type="button"
                  onClick={goToHub}
                  className="flex items-center gap-2 px-4 py-3 border-r border-white/8 text-white/55 hover:text-white-body hover:bg-white/5 transition-colors duration-150"
                  aria-label="Back to gamba hub"
                >
                  <LayoutGrid size={13} aria-hidden="true" />
                  <span className="text-xs font-bold tracking-eyebrow-sm uppercase font-mono">
                    Hub
                  </span>
                </button>
                {GAMBA_TOOLS.map((tool, i) => (
                  <ChannelTab
                    key={tool.id}
                    tool={tool}
                    channelNumber={i + 1}
                    active={activeTool === tool.id}
                    onClick={() => setActiveTool(tool.id)}
                  />
                ))}
              </div>
            </div>

            {/* Tool surface */}
            <div className="mt-4">
              {activeTool === 'leaderboard' && <Leaderboard />}
              {activeTool === 'suggest' && <SuggestAdminTab />}
              {activeTool === 'bonus-hunts' && <BonusHuntsPage />}
              {activeTool === 'hunt-tracker' && (
                <Suspense fallback={<ToolLoading label="Loading hunt tracker…" />}>
                  <HuntTracker />
                </Suspense>
              )}
              {activeTool === 'wheel' && (
                <Suspense fallback={<ToolLoading label="Tuning slot signal…" />}>
                  <SlotPicker />
                </Suspense>
              )}
            </div>
          </>
        ) : (
          <GambaHub setPage={(id) => navigate(`/${id}`)} />
        )}
      </div>

      {activeTool && (
        <MobileChannelSheet
          open={sheetOpen}
          activeId={activeTool}
          onSelect={(id) => {
            setActiveTool(id);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
          onHub={goToHub}
        />
      )}
    </div>
  );
}
