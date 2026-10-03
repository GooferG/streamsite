import { act, render } from '@testing-library/react';
import useDailyDrop, { clockLabel, shortLabel } from '../useDailyDrop';
import { authedFetch } from '../../utils/authedFetch';

jest.mock('../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const HOUR = 60 * 60 * 1000;
let api;
function Probe({ user }) {
  api = useDailyDrop(user);
  return null;
}

test('ready when the viewer has never claimed', () => {
  render(<Probe user={{ tickets: 0 }} />);
  expect(api.ready).toBe(true);
  expect(api.nextAt).toBeNull();
});

test('signed out is never ready', () => {
  render(<Probe user={null} />);
  expect(api.ready).toBe(false);
});

test('counts down 22 h from the last claim', () => {
  const last = Date.now() - HOUR;
  render(<Probe user={{ lastDailyClaimAt: { toMillis: () => last } }} />);
  expect(api.ready).toBe(false);
  expect(api.nextAt).toBe(last + 22 * HOUR);
  expect(shortLabel(api.remainingMs)).toMatch(/^2[01]h \d+m$/);
});

test('a claim returns the server award', async () => {
  authedFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, awarded: 10 }) });
  render(<Probe user={{}} />);
  let awarded;
  await act(async () => {
    awarded = await api.claim();
  });
  expect(awarded).toBe(10);
  expect(authedFetch).toHaveBeenCalledWith('/api/me/claim-daily', { method: 'POST' });
});

test('a cooldown answer sets the next drop and a plain error', async () => {
  const nextAt = Date.now() + 5 * HOUR;
  authedFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'COOLDOWN', nextAt }) });
  render(<Probe user={{}} />);
  await act(async () => {
    await api.claim();
  });
  expect(api.nextAt).toBe(nextAt);
  expect(api.error).toBe('Already claimed. Come back later.');
  expect(api.ready).toBe(false);
});

test('labels', () => {
  expect(clockLabel(5 * HOUR + 12 * 60000 + 3000)).toBe('05:12:03');
  expect(shortLabel(5 * HOUR + 12 * 60000)).toBe('5h 12m');
  expect(shortLabel(40 * 60000)).toBe('40m');
});
