import { COPY, betMoney, dayWord, lengthWords, multiplier, shortMoney, shortUntil, untilWords, whenAired } from '../couchCopy';

const AZ = 'America/Phoenix';
const NOW = Date.parse('2026-10-04T17:00:00Z'); // Sunday 10:00 AM in Arizona
const H = 3600000;

test('untilWords and shortUntil', () => {
  expect(untilWords(25 * H)).toBe('1 day 1 hour');
  expect(untilWords(3 * H + 5 * 60000)).toBe('3 hours 5 minutes');
  expect(untilWords(2 * 86400000)).toBe('2 days');
  expect(untilWords(12 * 60000)).toBe('12 minutes');
  expect(untilWords(20000)).toBe('under a minute');
  expect(shortUntil(3 * 86400000 + 4 * H)).toBe('3d 4h');
  expect(shortUntil(5 * H + 12 * 60000)).toBe('5h 12m');
});

test('lengthWords reads a stream length', () => {
  expect(lengthWords(4 * 3600 + 37 * 60 + 20)).toBe('4 hours 37');
  expect(lengthWords(2 * 3600)).toBe('2 hours');
  expect(lengthWords(52 * 60)).toBe('52 minutes');
});

test('day words follow the viewer calendar, not Arizona', () => {
  // Mon 11 AM in Arizona is Tue 12 AM in Dhaka, where "now" is still Sunday 11 PM.
  const mondayAz = Date.parse('2026-10-05T18:00:00Z');
  expect(dayWord(mondayAz, NOW, AZ)).toBe('tomorrow');
  expect(dayWord(mondayAz, NOW, 'Asia/Dhaka')).toBe('Tuesday');
  expect(dayWord(NOW, NOW, AZ)).toBe('today');
});

test('whenAired', () => {
  expect(whenAired(Date.parse('2026-10-02T03:00:00Z'), NOW, AZ)).toBe('Thursday night');
  expect(whenAired(Date.parse('2026-10-04T05:00:00Z'), NOW, AZ)).toBe('Last night');
  expect(whenAired(Date.parse('2026-10-04T15:30:00Z'), NOW, AZ)).toBe('This morning');
});

test('multiplier', () => {
  expect(multiplier(1240)).toBe('1,240x');
  expect(multiplier(48.5)).toBe('48.5x');
});

test('the sentences', () => {
  expect(COPY.tvNext({ title: 'Bonus Hunt Time!', day: 'tomorrow', clock: '11:00 AM' }).sentence).toBe(
    'Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time!'
  );
  expect(COPY.tvNext({ title: 'Slots', day: 'Monday', clock: '11:00 AM' }).teaser).toBe('Back Mon 11:00 AM');
  expect(COPY.laptopHunt({ opened: 14, total: 23, back: 412 }).sentence).toBe(
    'A hunt is running. 14 of 23 bonuses opened, $412 back so far.'
  );
  expect(COPY.laptopLastHunt({ paid: 412, start: 600, best: { multi: 1240, slot: 'Sugar Rush 1000' } }).sentence).toBe(
    'Last hunt paid $412 on $600. Best hit: 1,240x on Sugar Rush 1000.'
  );
  expect(COPY.tapes({ title: 'Win Wednesdays', when: 'Thursday night', length: '4 hours 37' }).sentence).toBe(
    'You missed Win Wednesdays. Thursday night, 4 hours 37.'
  );
  expect(COPY.guide({ title: 'Bonus Hunt Time!', day: 'Monday', clock: '11:00 AM', until: '1 day 1 hour' }).sentence).toBe(
    'Next up: Bonus Hunt Time! on Monday at 11:00 AM, in 1 day 1 hour.'
  );
  expect(COPY.noteOpen({ keyword: '!goof', prize: '$25.00 bonus buy' }).sentence).toBe(
    "Giveaway's open. Type !goof in chat for a $25.00 bonus buy."
  );
  expect(COPY.laptopOpen({ guesses: 1 }).sentence).toBe('Predictions are open. 1 guess in so far. Guess the payout before it locks.');
  expect(COPY.laptopBoard({ leader: { handle: '2A***r', wagered: 9138587.155 }, resetsIn: null }).sentence).toBe(
    '2A***r leads the BEAN board with $9,138,587 wagered.'
  );
  expect(COPY.laptopHistory({ count: 5, paidBack: 1, latest: 84 }).sentence).toBe(
    '1 of the last 5 hunts paid back their cost. The latest paid back 84%.'
  );
});

test('screen money: whole units, big figures compact, bets in cents', () => {
  expect(shortMoney(412, null)).toBe('$412');
  expect(shortMoney(2046.12, 'CAD')).toBe('CA$2,046');
  expect(shortMoney(3294392.6, 'ARS')).toMatch(/^ARS\s3\.3M$/);
  expect(betMoney(0.2, null)).toBe('$0.20');
  expect(betMoney(200, 'ARS')).toMatch(/^ARS\s200$/);
});

test('every sentence keeps the voice rules', () => {
  const samples = [
    COPY.tvWaiting(), COPY.tvLive({ viewers: 214 }), COPY.tvNext({ title: 'X', day: 'today', clock: '9:00 PM' }),
    COPY.tvDay({ title: 'X', day: 'Monday' }), COPY.tvLate({ title: 'X' }), COPY.tvNothing(),
    COPY.noteOpen({ keyword: 'goof' }), COPY.laptopHunt({ opened: 1, total: 1, back: 5 }), COPY.laptopOpen({ guesses: 0 }),
    COPY.laptopLocked(), COPY.laptopLastHunt({ paid: 5 }), COPY.laptopIdle({ resetsIn: H }), COPY.laptopIdle({ resetsIn: null }),
    COPY.laptopBoard({ leader: { handle: 'Go***r', wagered: 5 }, resetsIn: H }), COPY.laptopBoard({ leader: { handle: '', wagered: 5 } }),
    COPY.laptopHistory({ count: 5, paidBack: 0, latest: 69 }), COPY.laptopHistory({ count: 2, paidBack: 2, latest: 140 }),
    COPY.tapes({ title: 'X', when: 'Tonight' }), COPY.tapesNone(), COPY.guideDay({ title: 'X', day: 'today' }),
    COPY.guideLate({ title: 'X' }), COPY.guideLoading(), COPY.guideNone(), COPY.games({ name: 'X', hours: 0 }),
    COPY.gamesNone({ category: 'Slots' }), COPY.remote(), COPY.photo(),
  ];
  for (const { kicker, teaser, sentence } of samples) {
    for (const s of [kicker, teaser, sentence]) {
      expect(s).not.toMatch(/—/);
      expect(s).not.toMatch(/, not /i);
      expect(s).not.toMatch(/\b(leverage|harness|utilize|seamless|robust|unlock|delve|elevate|empower)\b/i);
    }
  }
});
