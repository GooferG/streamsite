// data.js — seed data + live stat math for the Hunt Tracker prototype.
// Plain script, attaches to window. No JSX here.

(function () {
  // Invented-but-plausible slot names so nothing is real-brand. Streaming-genre flavor.
  const SEED_BONUSES = [
    { id: "b1", game: "Gates of Goofus",      provider: "Practical Play", bet: 5.00,  type: "regular", caller: "Rolltau",       payout: 142.50, opened: true },
    { id: "b2", game: "Sweet Avalanche",      provider: "Practical Play", bet: 4.00,  type: "super",   caller: "chat",          payout: 0.00,   opened: true },
    { id: "b3", game: "Le Bandito",           provider: "Hassleslot",     bet: 10.00, type: "regular", caller: "Goofer",        payout: 88.00,  opened: true },
    { id: "b4", game: "Big Bass Splash-Out",  provider: "Reel Kingdom",   bet: 6.00,  type: "regular", caller: "RandyCabbage",  payout: 31.20,  opened: true },
    { id: "b5", game: "Wanted Dead or Payout",provider: "Hassleslot",     bet: 8.00,  type: "5scatter",caller: "Rolltau",       payout: 512.00, opened: true },
    { id: "b6", game: "Money Cart Express",   provider: "Relic Studios",  bet: 4.00,  type: "regular", caller: "chat",          payout: 18.80,  opened: true },
    { id: "b7", game: "San Quentin XXX",      provider: "Relic Studios",  bet: 10.00, type: "regular", caller: "Goofer",        payout: 0.00,   opened: true },
    { id: "b8", game: "Fruit Party Hardy",    provider: "Practical Play", bet: 4.00,  type: "super",   caller: "RandyCabbage",  payout: null,   opened: false },
    { id: "b9", game: "The Dog House Mega",   provider: "Practical Play", bet: 5.00,  type: "regular", caller: "chat",          payout: null,   opened: false },
    { id: "b10",game: "Dork Unit",            provider: "Hassleslot",     bet: 6.00,  type: "regular", caller: "Rolltau",       payout: null,   opened: false },
    { id: "b11",game: "Mental 2 the Sequel",  provider: "Relic Studios",  bet: 20.00, type: "5scatter",caller: "Goofer",        payout: null,   opened: false },
    { id: "b12",game: "Starlight Princess Pt",provider: "Practical Play", bet: 4.00,  type: "regular", caller: "chat",          payout: null,   opened: false },
  ];

  const SEED_SQUAD = [
    { id: "s1", name: "Goofer",       in: 200 },
    { id: "s2", name: "Rolltau",      in: 400 },
    { id: "s3", name: "RandyCabbage", in: 200 },
  ];

  const SEED_CALLS = [
    { id: "c1", caller: "luckyloony",   game: "Mental 2 the Sequel", ts: "9:48 PM" },
    { id: "c2", caller: "luckyloony",   game: "Starlight Princess Pt",ts: "9:49 PM" },
    { id: "c3", caller: "luckyloony",   game: "Gates of Goofus",     ts: "9:50 PM" },
    { id: "c4", caller: "BigWilly_92",  game: "Dork Unit",           ts: "9:42 PM" },
    { id: "c5", caller: "BigWilly_92",  game: "Le Bandito",          ts: "9:55 PM" },
    { id: "c6", caller: "spinster_kev", game: "San Quentin XXX",     ts: "9:51 PM" },
    { id: "c7", caller: "tiltedteapot", game: "Fruit Party Hardy",   ts: "10:03 PM" },
  ];

  const PROVIDERS = ["Practical Play", "Hassleslot", "Reel Kingdom", "Relic Studios", "Nodlim", "Push Gaming"];

  // ---- Live math -----------------------------------------------------------
  function computeStats(bonuses, startCost) {
    const count = bonuses.length;
    const opened = bonuses.filter((b) => b.opened);
    const openedCount = opened.length;
    const totalBets = bonuses.reduce((s, b) => s + (b.bet || 0), 0);
    const winnings = opened.reduce((s, b) => s + (b.payout || 0), 0);
    const profit = winnings - startCost;

    const avgReq = count ? startCost / count : 0;             // avg payout/bonus to break even
    const curAvg = openedCount ? winnings / openedCount : 0;  // current avg payout/opened
    const totalX = startCost ? winnings / startCost : 0;      // share of start recovered
    const reqX = totalBets ? startCost / totalBets : 0;       // req avg multiplier on bet
    const curAvgX = openedCount
      ? opened.reduce((s, b) => s + (b.bet ? (b.payout || 0) / b.bet : 0), 0) / openedCount
      : 0;

    const best = opened.reduce(
      (m, b) => {
        const x = b.bet ? (b.payout || 0) / b.bet : 0;
        return x > m.x ? { x, b } : m;
      },
      { x: 0, b: null }
    );

    const remaining = count - openedCount;
    // What each remaining bonus must average (payout) to break even from here.
    const needPerRemaining = remaining > 0 ? Math.max(0, startCost - winnings) / remaining : 0;

    return {
      count, openedCount, remaining, totalBets, winnings, profit,
      avgReq, curAvg, totalX, reqX, curAvgX,
      best, needPerRemaining,
    };
  }

  function multi(b) {
    if (!b.opened || b.payout == null || !b.bet) return null;
    return b.payout / b.bet;
  }

  function squadWithSplit(squad, basis) {
    const pot = squad.reduce((s, m) => s + (m.in || 0), 0);
    return {
      pot,
      rows: squad.map((m) => {
        const pct = pot ? (m.in / pot) : 0;
        return { ...m, pct, payout: pct * basis };
      }),
    };
  }

  const PAST_HUNTS = [
    { id: "h1", name: "Wednesday Warmup", date: "06 / 03 / 2026", startCost: 500, profit: 213.40, bonuses: [
      { game: "Gates of Goofus",   bet: 4, payout: 96.00,  type: "regular", caller: "Rolltau" },
      { game: "Le Bandito",        bet: 5, payout: 0.00,   type: "regular", caller: "Goofer" },
      { game: "Sugar Rush Hour",   bet: 4, payout: 412.00, type: "super",   caller: "luckyloony" },
      { game: "Dork Unit",         bet: 6, payout: 31.20,  type: "regular", caller: "chat" },
      { game: "Mental 2 the Sequel",bet: 10,payout: 174.20,type: "5scatter",caller: "Rolltau" },
    ]},
    { id: "h2", name: "Sunday Sendoff", date: "06 / 01 / 2026", startCost: 1000, profit: -342.10, bonuses: [
      { game: "Big Bass Splash-Out",bet: 6, payout: 18.00, type: "regular", caller: "RandyCabbage" },
      { game: "San Quentin XXX",    bet: 10,payout: 0.00,  type: "regular", caller: "Goofer" },
      { game: "Fruit Party Hardy",  bet: 4, payout: 220.00,type: "super",   caller: "chat" },
      { game: "Money Cart Express", bet: 4, payout: 9.60,  type: "regular", caller: "spinster_kev" },
      { game: "Wanted Dead or Payout",bet: 8,payout: 410.30,type: "5scatter",caller: "Goofer" },
    ]},
  ];

  // ---- Caller reputation -----------------------------------------------------
  // Prior-hunt history per caller. X values are win/stake of their PLAYED calls.
  const SEED_CALLER_LEDGER = [
    { name: "Rolltau",      gotInPrev: 12, missedPrev: 2,  prevX: [18, 9, 41, 22] },
    { name: "Goofer",       gotInPrev: 9,  missedPrev: 4,  prevX: [12, 0, 6, 0] },
    { name: "RandyCabbage", gotInPrev: 5,  missedPrev: 1,  prevX: [15, 7] },
    { name: "chat",         gotInPrev: 16, missedPrev: 11, prevX: [3, 0, 28, 1, 0] },
    { name: "luckyloony",   gotInPrev: 2,  missedPrev: 1,  prevX: [110] },
    { name: "BigWilly_92",  gotInPrev: 0,  missedPrev: 3,  prevX: [] },
    { name: "spinster_kev", gotInPrev: 1,  missedPrev: 2,  prevX: [6] },
    { name: "tiltedteapot", gotInPrev: 0,  missedPrev: 2,  prevX: [] },
  ];

  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const formTag = (x) => (x >= 20 ? "win" : x < 1 ? "brick" : "ok");

  // bonuses: live hunt bonuses (with caller). ledger: prior history (state).
  function computeCallerStats(bonuses, ledger) {
    const map = new Map();
    const ensure = (name) => {
      if (!map.has(name)) map.set(name, { name, gotIn: 0, missed: 0, x: [] });
      return map.get(name);
    };
    // Seed from prior history.
    ledger.forEach((l) => {
      const e = ensure(l.name);
      e.gotIn += l.gotInPrev; e.missed += l.missedPrev; e.x.push(...l.prevX);
    });
    // Layer this hunt: each called bonus got in; played ones add an X.
    const bestW = { x: -1 }, worstW = { x: Infinity };
    bonuses.forEach((b) => {
      const name = (b.caller || "").trim();
      if (!name || name === "—") return;
      const e = ensure(name);
      e.gotIn += 1;
      const played = b.opened && b.bet > 0 && b.payout != null;
      if (played) {
        const x = b.payout / b.bet;
        e.x.push(x);
        if (x > bestW.x) { bestW.x = x; bestW.slot = b.game; bestW.caller = name; }
        if (x < worstW.x) { worstW.x = x; worstW.slot = b.game; worstW.caller = name; }
      }
    });

    const rows = [...map.values()].map((e) => {
      const calls = e.gotIn + e.missed;
      const avgX = mean(e.x);
      const acceptRate = calls ? e.gotIn / calls : 0;
      const form = e.x.slice(-5).map(formTag);
      // trailing streaks
      let hot = 0, cold = 0;
      for (let i = e.x.length - 1; i >= 0; i--) { if (e.x[i] >= 20) hot++; else break; }
      for (let i = e.x.length - 1; i >= 0; i--) { if (e.x[i] < 1) cold++; else break; }
      let status = "steady";
      if (hot >= 2 || (avgX != null && avgX >= 25 && acceptRate >= 0.6)) status = "hot";
      else if (cold >= 2 || (acceptRate < 0.35 && calls >= 3)) status = "cold";
      return {
        name: e.name, calls, gotIn: e.gotIn, missed: e.missed, acceptRate,
        avgX, best: e.x.length ? Math.max(...e.x) : null, plays: e.x.length,
        form, status, hotStreak: hot, coldStreak: cold,
      };
    });

    const leaderboard = rows.sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));
    const hotCaller = rows.filter((r) => r.status === "hot").sort((a, b) => (b.avgX || 0) - (a.avgX || 0))[0] || null;
    const coldCaller = rows.filter((r) => r.status === "cold").sort((a, b) => a.acceptRate - b.acceptRate)[0] || null;
    const mostConsistent = rows.filter((r) => r.plays >= 2).sort((a, b) => (b.avgX || 0) - (a.avgX || 0))[0] || null;

    return {
      leaderboard,
      bestCall: bestW.x >= 0 ? bestW : null,
      worstCall: worstW.x < Infinity ? worstW : null,
      mostConsistent, hotCaller, coldCaller,
    };
  }

  window.HUNT = {
    SEED_BONUSES, SEED_SQUAD, SEED_CALLS, PROVIDERS, SEED_CALLER_LEDGER, PAST_HUNTS,
    START_COST: 800,
    HUNT_NAME: "Friday Disc Hunt",
    computeStats, multi, squadWithSplit, computeCallerStats,
  };
})();
