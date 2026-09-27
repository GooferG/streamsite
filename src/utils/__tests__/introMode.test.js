import {
  introModeFor,
  readIntroFlags,
  markPowered,
  markSessionPlayed,
} from '../introMode';

const base = {
  pathname: '/',
  isBrandRoute: true,
  powered: false,
  sessionPlayed: false,
  reducedMotion: false,
};

describe('introModeFor', () => {
  test('first visit landing on home gets the power-on gate', () => {
    expect(introModeFor(base)).toBe('gate');
  });

  test('first visit deep-linking a brand page gets the flip, not the gate', () => {
    expect(introModeFor({ ...base, pathname: '/schedule' })).toBe('flip');
  });

  test('returning visitor on home gets the flip', () => {
    expect(introModeFor({ ...base, powered: true })).toBe('flip');
  });

  test('product routes never get an intro', () => {
    expect(introModeFor({ ...base, pathname: '/gamba/leaderboard', isBrandRoute: false })).toBe('none');
  });

  test('flip plays once per session', () => {
    expect(introModeFor({ ...base, powered: true, sessionPlayed: true })).toBe('none');
  });

  test('gate still shows if a flip already played this session but the tv was never powered on', () => {
    expect(introModeFor({ ...base, sessionPlayed: true })).toBe('gate');
  });

  test('reduced motion skips the flip', () => {
    expect(introModeFor({ ...base, powered: true, reducedMotion: true })).toBe('none');
  });

  test('reduced motion keeps the gate (it is a click, not motion)', () => {
    expect(introModeFor({ ...base, reducedMotion: true })).toBe('gate');
  });
});

describe('intro storage flags', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fresh browser is not powered and has not played this session', () => {
    expect(readIntroFlags()).toEqual({ powered: false, sessionPlayed: false });
  });

  test('markPowered and markSessionPlayed persist', () => {
    markPowered();
    markSessionPlayed();
    expect(readIntroFlags()).toEqual({ powered: true, sessionPlayed: true });
  });

  test('viewers who already dismissed the welcome card count as powered on', () => {
    window.localStorage.setItem('gg_welcome_seen', '1');
    expect(readIntroFlags().powered).toBe(true);
  });

  test('unavailable storage counts as powered so the gate never traps anyone', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readIntroFlags()).toEqual({ powered: true, sessionPlayed: true });
  });

  test('mark functions swallow storage errors', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => {
      markPowered();
      markSessionPlayed();
    }).not.toThrow();
  });
});
