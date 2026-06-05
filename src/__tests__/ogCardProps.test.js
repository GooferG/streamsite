// Tests for the pure OG card-prop mappers. Lives under src/__tests__ (CRA Jest
// only scans src/) and imports the firebase-free api module.
import { liveCardProps, suggestCardProps } from '../../api/og/cardProps.js';

describe('liveCardProps', () => {
  test('maps mirror name/startBalance/bonuses to the live card shape', () => {
    const p = liveCardProps({ name: 'Friday Disc Hunt', startBalance: 800, bonuses: [{}, {}, {}] });
    expect(p.variant).toBe('live');
    expect(p.huntName).toBe('Friday Disc Hunt');
    expect(p.pill).toEqual({ text: 'LIVE', tone: 'live' });
    expect(p.statA).toEqual({ label: 'START', value: '$800' });
    expect(p.statB).toEqual({ label: 'BONUSES SO FAR', value: '3' });
    expect(p.cta).toBe('goofer.tv/live →');
    expect(p.kicker).toBe('BONUS HUNT · LIVE NOW');
  });

  test('handles missing/zero fields with a generic fallback', () => {
    const p = liveCardProps(null);
    expect(p.huntName).toBe('Bonus Hunt');
    expect(p.statA.value).toBe('$0');
    expect(p.statB.value).toBe('0');
  });

  test('formats large start balances with commas, no decimals', () => {
    expect(liveCardProps({ startBalance: 12500 }).statA.value).toBe('$12,500');
  });
});

describe('suggestCardProps', () => {
  const intake = { huntName: 'Friday Disc Hunt' };
  const hunt = {
    suggestions: [
      { person: 'Ana', slots: [{ name: 'A' }, { name: 'B' }] },
      { person: 'Bo', slots: [{ name: 'C' }] },
    ],
  };

  test('maps intake name + hunt suggestions to picks-in / callers', () => {
    const p = suggestCardProps(intake, hunt);
    expect(p.variant).toBe('suggest');
    expect(p.huntName).toBe('Friday Disc Hunt');
    expect(p.pill).toEqual({ text: 'OPEN', tone: 'open' });
    expect(p.statA).toEqual({ label: 'PICKS IN', value: '3' }); // 2 + 1 slots
    expect(p.statB).toEqual({ label: 'CALLERS', value: '2' });  // 2 people
    expect(p.cta).toBe('goofer.tv · drop yours →');
    expect(p.kicker).toBe('SUGGEST SLOTS · OPEN');
  });

  test('falls back when there is no active hunt', () => {
    const p = suggestCardProps({ huntName: 'X' }, null);
    expect(p.huntName).toBe('X');
    expect(p.statA.value).toBe('0');
    expect(p.statB.value).toBe('0');
  });

  test('uses a generic name when intake lacks one', () => {
    expect(suggestCardProps(null, null).huntName).toBe('Bonus Hunt');
  });
});
