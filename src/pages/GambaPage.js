import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Target,
  Gamepad2,
  MessageSquarePlus,
  Layers,
  Radio,
  ChevronDown,
  X,
} from 'lucide-react';
import BonusHuntsPage from './BonusHunts';
import HuntTracker from '../components/HuntTracker';
import SlotPicker from '../components/SlotPicker';
import SuggestAdminTab from '../components/SuggestAdminTab';
import Leaderboard from '../components/Leaderboard';

const TOOLS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: Radio },
  { id: 'hunt-tracker', label: 'Hunt Tracker', icon: Target },
  { id: 'bonus-hunts', label: 'Bonus Hunts', icon: Layers },
  { id: 'wheel', label: 'Slot Picker', icon: Gamepad2 },
  { id: 'suggest', label: 'Suggestions', icon: MessageSquarePlus },
];

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
  const tool = TOOLS[activeIndex];
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

function MobileChannelSheet({ open, activeId, onSelect, onClose }) {
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

        {/* Channel list */}
        <ul className="relative">
          {TOOLS.map((tool, i) => {
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
  const activeTool = location.pathname.split('/')[2] || 'leaderboard';
  const activeIndex = Math.max(
    0,
    TOOLS.findIndex((t) => t.id === activeTool)
  );
  const setActiveTool = (tool) => navigate(`/gamba/${tool}`);
  const stripRef = useRef(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const activeBtn = strip.querySelector('[data-active="true"]');
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [activeTool]);

  return (
    <div className="pt-20 pb-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Mobile/tablet — single tuner button */}
        <div className="lg:hidden">
          <MobileChannelTrigger
            activeIndex={activeIndex}
            onOpen={() => setSheetOpen(true)}
          />
        </div>

        {/* Desktop — equal-width strip */}
        <div className="hidden lg:block">
          <div
            ref={stripRef}
            className="flex border border-white/8 bg-zinc-card/30"
            role="tablist"
            aria-label="Gamba tools"
          >
            {TOOLS.map((tool, i) => (
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
          {activeTool === 'hunt-tracker' && <HuntTracker />}
          {activeTool === 'wheel' && <SlotPicker />}
        </div>
      </div>

      <MobileChannelSheet
        open={sheetOpen}
        activeId={activeTool}
        onSelect={(id) => {
          setActiveTool(id);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
