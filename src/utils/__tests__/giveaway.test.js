import {
  REVEAL_TIMELINE,
  SURF_FRAMES,
  WINNER_CHANNEL,
  bonusPrize,
  buildSurfFrames,
  defaultTitle,
  formFromGiveaway,
  formatMoney,
  formatMulti,
  parseMoney,
  formatClock,
  keywordWarning,
  pickKey,
  revealPhase,
  rulesSummary,
  suggestKeyword,
  surfFrameIndex,
  tsMillis,
} from '../giveaway';
import { messageHasKeyword } from '../../../api/_lib/giveawayKeyword';

describe('messageHasKeyword', () => {
  it('matches the keyword as its own word anywhere in the message', () => {
    expect(messageHasKeyword('tunedin', 'tunedin')).toBe(true);
    expect(messageHasKeyword('TUNEDIN lets go', 'tunedin')).toBe(true);
    expect(messageHasKeyword('ok tunedin!', 'tunedin')).toBe(true);
  });

  it('does not match inside another word', () => {
    expect(messageHasKeyword('eggs for breakfast', 'gg')).toBe(false);
    expect(messageHasKeyword('tunedinnn', 'tunedin')).toBe(false);
    expect(messageHasKeyword('retunedin', 'tunedin')).toBe(false);
  });

  it('finds a later standalone match after an embedded one', () => {
    expect(messageHasKeyword('eggs then gg', 'gg')).toBe(true);
  });

  it('handles punctuation-led keywords and multi-word keywords', () => {
    expect(messageHasKeyword('!enter pls', '!enter')).toBe(true);
    expect(messageHasKeyword('hey!enter', '!enter')).toBe(true);
    expect(messageHasKeyword('!enterprise', '!enter')).toBe(false);
    expect(messageHasKeyword('free   key please', 'free key')).toBe(true);
  });

  it('never matches an empty keyword', () => {
    expect(messageHasKeyword('anything', '')).toBe(false);
    expect(messageHasKeyword('anything', '   ')).toBe(false);
  });
});

describe('keywordWarning', () => {
  it('flags words chat says anyway', () => {
    expect(keywordWarning('gg')).toMatch(/chat says this/i);
    expect(keywordWarning('Giveaway')).toMatch(/chat says this/i);
  });

  it('flags short keywords', () => {
    expect(keywordWarning('zqx')).toMatch(/short/i);
  });

  it('passes distinctive keywords and empty input', () => {
    expect(keywordWarning('rabbitears')).toBeNull();
    expect(keywordWarning('')).toBeNull();
  });
});

describe('suggestKeyword', () => {
  it('never suggests the keyword it was given', () => {
    for (let i = 0; i < 50; i++) {
      expect(suggestKeyword('tunedin')).not.toBe('tunedin');
    }
  });

  it('only suggests keywords that pass the warning check', () => {
    for (let i = 0; i < 50; i++) {
      expect(keywordWarning(suggestKeyword())).toBeNull();
    }
  });
});

describe('reveal timeline', () => {
  it('walks static → surf → flash → landed', () => {
    expect(revealPhase(-10)).toBe('pending');
    expect(revealPhase(0)).toBe('static');
    expect(revealPhase(REVEAL_TIMELINE.surfStart)).toBe('surf');
    expect(revealPhase(REVEAL_TIMELINE.surfEnd)).toBe('flash');
    expect(revealPhase(REVEAL_TIMELINE.landAt)).toBe('landed');
    expect(revealPhase(60000)).toBe('landed');
  });

  it('surf frames only move forward and end on the last frame', () => {
    let prev = -1;
    for (let t = REVEAL_TIMELINE.surfStart; t <= REVEAL_TIMELINE.surfEnd; t += 16) {
      const idx = surfFrameIndex(t);
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
    expect(surfFrameIndex(REVEAL_TIMELINE.surfEnd)).toBe(SURF_FRAMES - 1);
    expect(surfFrameIndex(0)).toBe(0);
  });

  it('slows down: early frames are shorter than late frames', () => {
    const firstChange = [];
    for (let t = REVEAL_TIMELINE.surfStart; t <= REVEAL_TIMELINE.surfEnd; t++) {
      const idx = surfFrameIndex(t);
      if (firstChange[idx] === undefined) firstChange[idx] = t;
    }
    const early = firstChange[2] - firstChange[1];
    const late = firstChange[SURF_FRAMES - 1] - firstChange[SURF_FRAMES - 2];
    expect(late).toBeGreaterThan(early * 3);
  });
});

describe('buildSurfFrames', () => {
  const pool = [
    { id: 'a', twitchId: 'a' },
    { id: 'b', twitchId: 'b' },
    { id: 'w', twitchId: 'w' },
  ];
  const winner = { twitchId: 'w', displayName: 'Winner' };

  it('ends on the winner on the giveaway channel', () => {
    const frames = buildSurfFrames({ winner, pool, seedKey: 'w:1' });
    expect(frames).toHaveLength(SURF_FRAMES);
    const last = frames[frames.length - 1];
    expect(last.isWinner).toBe(true);
    expect(last.entry).toBe(winner);
    expect(last.channel).toBe(WINNER_CHANNEL);
  });

  it('keeps the winner and the winner channel out of the surf', () => {
    const frames = buildSurfFrames({ winner, pool, seedKey: 'w:1' });
    frames.slice(0, -1).forEach((f, i) => {
      expect(f.entry.twitchId).not.toBe('w');
      expect(f.channel).not.toBe(WINNER_CHANNEL);
      if (i > 0) expect(f.channel).not.toBe(frames[i - 1].channel);
    });
  });

  it('is deterministic for the same pick', () => {
    const a = buildSurfFrames({ winner, pool, seedKey: 'w:123' });
    const b = buildSurfFrames({ winner, pool, seedKey: 'w:123' });
    expect(a).toEqual(b);
  });

  it('uses empty channels when the winner is the only entrant', () => {
    const frames = buildSurfFrames({ winner, pool: [pool[2]], seedKey: 'x' });
    expect(frames.slice(0, -1).every((f) => f.entry === null)).toBe(true);
  });
});

describe('small helpers', () => {
  it('tsMillis reads Firestore timestamps, dates and numbers', () => {
    expect(tsMillis({ toMillis: () => 42 })).toBe(42);
    expect(tsMillis(new Date(1000))).toBe(1000);
    expect(tsMillis(5)).toBe(5);
    expect(tsMillis({ seconds: 2, nanoseconds: 5e6 })).toBe(2005);
    expect(tsMillis(null)).toBeNull();
  });

  it('pickKey needs both a winner and a roll time', () => {
    expect(pickKey({ winnerTwitchId: 'w', rolledAt: 10 })).toBe('w:10');
    expect(pickKey({ winnerTwitchId: 'w', rolledAt: null })).toBeNull();
    expect(pickKey({ winnerTwitchId: null, rolledAt: 10 })).toBeNull();
  });

  it('formatClock pads minutes and seconds', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(75.9)).toBe('01:15');
    expect(formatClock(-3)).toBe('00:00');
  });

  it('defaultTitle names the day', () => {
    expect(defaultTitle(new Date(2026, 8, 24))).toBe('Giveaway · Sep 24');
  });
});

describe('formFromGiveaway', () => {
  const past = {
    title: 'Friday',
    prize: 'Hades II key',
    keyword: 'rabbitears',
    weights: { base: 1, registered: 0, discord: 1, sub: 1, vip: 0 },
    requireFollow: false,
    announceStart: false,
    durationSec: 300,
    autoRoll: true,
    targetWinners: 3,
  };

  it('carries rules over but leaves the prize blank for a new giveaway', () => {
    const form = formFromGiveaway(past);
    expect(form.prize).toBe('');
    expect(form.title).toBe('');
    expect(form.keyword).not.toBe('rabbitears');
    expect(form.requireFollow).toBe(false);
    expect(form.weights.registered).toBe(0);
    expect(form.durationSec).toBe(300);
    expect(form.targetWinners).toBe(1);
  });

  it('copies everything for Run it again', () => {
    const form = formFromGiveaway(past, { copyPrize: true });
    expect(form.prize).toBe('Hades II key');
    expect(form.keyword).toBe('rabbitears');
    expect(form.targetWinners).toBe(3);
    expect(form.autoRoll).toBe(true);
  });

  it('summarizes rules on one line', () => {
    expect(rulesSummary(formFromGiveaway(past))).toBe(
      'Anyone in chat · sub/Discord +1 each · chat: last call, winner'
    );
  });
});

describe('money', () => {
  it('formats whole amounts without cents and keeps real cents', () => {
    expect(formatMoney(100)).toBe('$100');
    expect(formatMoney(43.2)).toBe('$43.20');
    expect(formatMoney(1250)).toBe('$1,250');
    expect(formatMoney(0)).toBe('$0');
  });

  it('parses typed amounts, ignoring $ and commas', () => {
    expect(parseMoney('43.2')).toBe(43.2);
    expect(parseMoney('$1,250.555')).toBe(1250.56);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });

  it('shows the payout as a multiple of the buy', () => {
    expect(formatMulti(43.2, 100)).toBe('0.43x');
    expect(formatMulti(1250, 100)).toBe('12.5x');
    expect(formatMulti(25000, 100)).toBe('250x');
    expect(formatMulti(0, 100)).toBe('0.00x');
    expect(formatMulti(10, 0)).toBeNull();
  });

  it('names a bonus-buy prize from its value', () => {
    expect(bonusPrize(100)).toBe('$100 bonus buy');
  });
});

describe('formFromGiveaway prize types', () => {
  it('defaults a first-ever giveaway to a bonus buy', () => {
    expect(formFromGiveaway(null).kind).toBe('bonus');
  });

  it('treats giveaways from before prize types as plain prizes', () => {
    expect(formFromGiveaway({ prize: 'Steam key' }).kind).toBe('item');
  });

  it('Run it again copies the buy value, not the derived prize text', () => {
    const form = formFromGiveaway(
      { kind: 'bonus', buyAmount: 100, prize: '$100 bonus buy' },
      { copyPrize: true }
    );
    expect(form.kind).toBe('bonus');
    expect(form.buyAmount).toBe('100');
    expect(form.prize).toBe('');
  });

  it('mentions the payout message only for bonus buys', () => {
    const bonus = formFromGiveaway({ kind: 'bonus' });
    expect(rulesSummary(bonus)).toMatch(/payout/);
    expect(rulesSummary({ ...bonus, kind: 'item' })).not.toMatch(/payout/);
  });
});
