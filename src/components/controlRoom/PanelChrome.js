import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, MoreHorizontal, PanelRight, PanelRightClose, X } from 'lucide-react';

const TABS = [
  ['giveaway', 'Giveaway'],
  ['predict', 'Predict'],
];

function Tally({ on, tone, children }) {
  return <span className={`cr-tally tone-${tone} ${on ? 'is-on' : ''}`}>{children}</span>;
}

// Top strip (tally lights, Stage switch, menu, window buttons) and the
// hardware-style tabs. The strip is the drag handle.
export default function PanelChrome({
  tallies,
  dataLost,
  leds,
  tab,
  onTab,
  stage,
  onStage,
  hideLiveBadge,
  onHideLiveBadge,
  docked,
  narrow,
  onDock,
  onMinimize,
  onClose,
  onResetPosition,
  dragHandlers,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const adminHref = tab === 'predict' ? '/admin/hunts' : '/admin/giveaways';

  const onTabKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.findIndex(([id]) => id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
    onTab(next);
    document.getElementById(`cr-tab-${next}`)?.focus();
  };

  return (
    <>
      <div className="cr-top" {...dragHandlers}>
        <span id="cr-title" className="sr-only">
          Control room
        </span>
        <Tally on={tallies.live} tone="red">LIVE</Tally>
        <Tally on={tallies.gvw} tone="orange">GVW</Tally>
        <Tally on={tallies.prd} tone="amber">PRD</Tally>
        {dataLost && <Tally on tone="red">DATA</Tally>}
        {!narrow && !docked && (
          <span className="cr-grip" aria-hidden="true">
            ⠿
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-pressed={stage}
            onClick={() => onStage(!stage)}
            title="Play reveals full screen on this browser"
            className={`cr-switch ${stage ? 'is-on' : ''}`}
          >
            Stage
          </button>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Panel options"
              onClick={() => setMenuOpen((o) => !o)}
              className="cr-icon"
            >
              <MoreHorizontal size={13} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="cr-menu"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setMenuOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={hideLiveBadge}
                  onClick={() => {
                    onHideLiveBadge(!hideLiveBadge);
                    setMenuOpen(false);
                  }}
                >
                  Hide LIVE badge
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onResetPosition();
                    setMenuOpen(false);
                  }}
                >
                  Reset position
                </button>
                <Link role="menuitem" to={adminHref}>
                  Open admin ↗
                </Link>
              </div>
            )}
          </div>
          {!narrow && (
            <button
              type="button"
              onClick={onDock}
              aria-label={docked ? 'Float the panel' : 'Dock to the right'}
              className="cr-icon"
            >
              {docked ? <PanelRightClose size={13} aria-hidden="true" /> : <PanelRight size={13} aria-hidden="true" />}
            </button>
          )}
          <button type="button" onClick={onMinimize} aria-label="Minimize" className="cr-icon">
            <Minus size={13} aria-hidden="true" />
          </button>
          <button type="button" onClick={onClose} aria-label="Close control room" className="cr-icon">
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div role="tablist" aria-label="Tools" className="cr-tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`cr-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="cr-body"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => onTab(id)}
            onKeyDown={onTabKey}
            className={`cr-tab ${tab === id ? 'is-active' : ''}`}
          >
            <span className={`cr-tab-led cr-led-${leds[id]}`} aria-hidden="true" />
            {label.toUpperCase()}
          </button>
        ))}
      </div>
    </>
  );
}
