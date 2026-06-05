// og-cards.jsx — three share-card directions, exact 1200×630.
const { useState: useStateC } = React;

const fmtMoney = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Shared bits ---------------------------------------------------------------
function LiveDot({ size = 13 }) {
  return <span className="og-dot" style={{ width: size, height: size }} />;
}
function GAvatar({ size = 84, initials = "GG" }) {
  return <div className="og-avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>{initials}</div>;
}

// A — Broadcast chyron ------------------------------------------------------
function CardBroadcast() {
  return (
    <div className="og og-broadcast">
      <div className="og-grain" />
      <div className="og-top">
        <div className="og-ch">
          <span className="og-ch-no">CH 02</span>
          <span className="og-ch-name">GOOFERG&nbsp;LIVE</span>
        </div>
        <div className="og-livepill"><LiveDot /> LIVE NOW</div>
      </div>

      <div className="og-mid">
        <div className="og-kicker">BONUS HUNT IN PROGRESS</div>
        <div className="og-title">Friday Disc Hunt</div>
        <div className="og-needline">
          <span className="og-need-x">9.30×</span>
          <span className="og-need-label">avg needed to break even · 5 of 12 left to open</span>
        </div>
      </div>

      <div className="og-chyron">
        <div className="og-stat"><span className="og-s-k">START</span><span className="og-s-v">$800</span></div>
        <div className="og-stat"><span className="og-s-k">BONUSES</span><span className="og-s-v">12</span></div>
        <div className="og-stat"><span className="og-s-k">TOP MULTI</span><span className="og-s-v pos">512×</span></div>
        <div className="og-stat grow"><span className="og-s-k">PROFIT / LOSS</span><span className="og-s-v neg">-$7.50</span></div>
        <div className="og-watch">WATCH&nbsp;→&nbsp;<span className="mono">goofer.tv/live</span></div>
      </div>
    </div>
  );
}

// B — Scoreboard ------------------------------------------------------------
function CardScoreboard() {
  return (
    <div className="og og-score">
      <div className="og-score-head">
        <div className="og-ch">
          <span className="og-ch-no">CH 02</span>
          <span className="og-ch-name">HUNT TRACKER</span>
        </div>
        <div className="og-livepill"><LiveDot /> LIVE</div>
      </div>

      <div className="og-score-hero">
        <div className="og-score-label">PROFIT / LOSS · LIVE</div>
        <div className="og-score-num neg">-$7.50</div>
        <div className="og-score-sub">
          <span className="og-chip neg">BEHIND</span>
          Friday Disc Hunt · $800 start · 0.99× recovered
        </div>
      </div>

      <div className="og-score-grid">
        <div className="og-sc"><span className="og-sc-k">BONUSES</span><span className="og-sc-v">12</span><span className="og-sc-s">5 to open</span></div>
        <div className="og-sc"><span className="og-sc-k">WINNINGS</span><span className="og-sc-v pos">$792</span></div>
        <div className="og-sc"><span className="og-sc-k">TOP MULTI</span><span className="og-sc-v pos">512×</span></div>
        <div className="og-sc"><span className="og-sc-k">REQ AVG</span><span className="og-sc-v">9.30×</span></div>
      </div>

      <div className="og-score-foot">
        <GAvatar size={40} />
        <span className="og-foot-name">GooferG</span>
        <span className="og-foot-watch mono">goofer.tv/live →</span>
      </div>
    </div>
  );
}

// C — Minimal hype (data-driven) -------------------------------------------
function CardMinimal({ huntName = "Friday Disc Hunt", start = 800, bonusCount = 12 }) {
  return (
    <div className="og og-min">
      <div className="og-min-top">
        <div className="og-livepill big"><LiveDot size={16} /> LIVE</div>
        <span className="og-min-ch mono">GOOFERG · CH 02</span>
      </div>
      <div className="og-min-center">
        <div className="og-min-kicker">BONUS HUNT · LIVE NOW</div>
        <div className="og-min-title">{huntName}</div>
      </div>
      <div className="og-min-foot">
        <div className="og-min-stats">
          <div className="og-min-stat">
            <span className="og-min-k mono">START</span>
            <span className="og-min-v">{fmtMoney(start)}</span>
          </div>
          <div className="og-min-div" />
          <div className="og-min-stat">
            <span className="og-min-k mono">BONUSES SO FAR</span>
            <span className="og-min-v">{bonusCount}</span>
          </div>
        </div>
        <div className="og-min-cta">goofer.tv/live →</div>
      </div>
    </div>
  );
}

window.OG = { CardBroadcast, CardScoreboard, CardMinimal };
