// components.jsx — shared UI for the Hunt Tracker. Exports to window.
const { useState, useRef, useEffect } = React;

// ---- Icons: simple stroke set (functional UI affordances) -------------------
const ICONS = {
  grid:   "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  radio:  "M4.93 19.07a10 10 0 0 1 0-14.14M7.76 16.24a6 6 0 0 1 0-8.48M16.24 7.76a6 6 0 0 1 0 8.48M19.07 4.93a10 10 0 0 1 0 14.14M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2",
  stack:  "M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5",
  swords: "M14.5 4 19 4 19 8.5M14.5 4 8 10.5 3 5.5 5.5 3 10.5 8M19 4 12.5 10.5M3 18l3.5 3.5M6 15l3 3",
  dice:   "M3 8.5 12 3l9 5.5v7L12 21l-9-5.5zM3 8.5 12 14l9-5.5M12 14v7",
  edit:   "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z",
  play:   "M6 4l14 8-14 8z",
  download:"M12 3v12M7 10l5 5 5-5M4 19h16",
  check:  "M20 6 9 17l-5-5",
  dots:   "M5 12h.01M12 12h.01M19 12h.01",
  link:   "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5",
  copy:   "M9 9h10v10H9zM5 15H4V4h11v1",
  stop:   "M6 6h12v12H6z",
  users:  "M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11",
  plus:   "M12 5v14M5 12h14",
  x:      "M18 6 6 18M6 6l12 12",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.35-4.35",
  ban:    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M5.6 5.6l12.8 12.8",
  sheet:  "M4 3h16v18H4zM4 9h16M4 15h16M10 3v18",
  flame:  "M12 3c2 3 4 4.5 4 8a4 4 0 1 1-8 0c0-1.5.5-2.5 1-3.5.8 1 1.5 1.5 3-4.5z",
  bolt:   "M13 2 4 14h7l-1 8 9-12h-7z",
  trophy: "M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 17h6M8 21h8M12 13v4",
  eye:    "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  chevron:"M6 9l6 6 6-6",
  sparkle:"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z",
  arrowL: "M19 12H5M12 19l-7-7 7-7",
};

function Icon({ name, size = 16, stroke = 2, fill = false, style }) {
  const d = ICONS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"} strokeWidth={stroke} strokeLinecap="round"
      strokeLinejoin="round" style={{ flexShrink: 0, ...style }} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// ---- Money / number formatting ---------------------------------------------
const fmt$ = (n) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtX = (n) => (n || 0).toFixed(2) + "x";

// ---- Stat cards -------------------------------------------------------------
function HeroStat({ profit, startCost, winnings, pace }) {
  const positive = profit >= 0;
  return (
    <div className={"hero-stat " + (positive ? "is-pos" : "is-neg")}>
      <div className="hero-glow" />
      <div className="hero-label">
        <span className="mono">PROFIT / LOSS</span>
        <span className={"pace-chip " + (pace.behind ? "behind" : "ahead")}>
          {pace.behind ? "BEHIND" : "AHEAD"} · need {fmtX(pace.reqX)} avg
        </span>
      </div>
      <div className="hero-value">{fmt$(profit)}</div>
      <div className="hero-sub mono">
        {fmt$(winnings)} won · {fmt$(startCost)} start · {fmtX(winnings / startCost || 0)} recovered
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  return (
    <div className={"stat-card" + (tone ? " tone-" + tone : "")}>
      <div className="stat-label mono">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub mono">{sub}</div>}
    </div>
  );
}

// ---- Generic bits -----------------------------------------------------------
function Btn({ children, kind = "ghost", icon, sm, onClick, title, style }) {
  return (
    <button className={`btn btn-${kind}${sm ? " btn-sm" : ""}`} onClick={onClick} title={title} style={style}>
      {icon && <Icon name={icon} size={sm ? 13 : 15} />}
      {children && <span>{children}</span>}
    </button>
  );
}

function TypeBadge({ type }) {
  const map = {
    regular:  { label: "REG",      cls: "reg" },
    super:    { label: "SUPER",    cls: "super" },
    "5scatter": { label: "5-SCAT", cls: "scat" },
  };
  const t = map[type] || map.regular;
  return <span className={"type-badge " + t.cls + " mono"}>{t.label}</span>;
}

function MultiTag({ x }) {
  if (x == null) return <span className="multi-pending mono">—</span>;
  let cls = "low";
  if (x >= 100) cls = "huge";
  else if (x >= 50) cls = "big";
  else if (x >= 20) cls = "mid";
  else if (x === 0) cls = "zero";
  return <span className={"multi-tag " + cls + " mono"}>{x === 0 ? "0x" : fmtX(x)}</span>;
}

Object.assign(window, {
  Icon, ICONS, fmt$, fmtX, HeroStat, StatCard, Btn, TypeBadge, MultiTag,
});
