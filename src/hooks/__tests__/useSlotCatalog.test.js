import { render, waitFor } from '@testing-library/react';
import useSlotCatalog, { __resetSlotCatalogForTests } from '../useSlotCatalog';

const ROWS = [
  { name: 'Gates of Olympus', provider: 'pragmatic-play', rainbetSlug: 'pp-gates', thumb: 'https://cdn.rainbet.com/slots/gates.png', volatility: 'very-high' },
  { name: 'Sugar Mix', provider: 'bgaming', rainbetSlug: 'bg-sugar', thumb: null, volatility: 'low' },
];
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = () => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) });

function Probe({ onState }) {
  onState(useSlotCatalog());
  return null;
}

beforeEach(() => {
  __resetSlotCatalogForTests();
});

test('two consumers share one fetch and get normalized slots', async () => {
  global.fetch = jest.fn(() => ok({ slots: ROWS }));
  let a;
  let b;
  render(
    <>
      <Probe onState={(s) => { a = s; }} />
      <Probe onState={(s) => { b = s; }} />
    </>
  );
  expect(a.loading).toBe(true);
  await waitFor(() => expect(a.loading).toBe(false));
  await waitFor(() => expect(b.loading).toBe(false));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith('/api/slots');
  expect(a.slots[0]).toMatchObject({ name: 'Gates of Olympus', provider: 'Pragmatic Play', volatility: 'high' });
  expect(b.slots).toHaveLength(2);
});

test('a later mount reuses the loaded catalogue without refetching', async () => {
  global.fetch = jest.fn(() => ok({ slots: ROWS }));
  let first;
  const { unmount } = render(<Probe onState={(s) => { first = s; }} />);
  await waitFor(() => expect(first.loading).toBe(false));
  unmount();
  let second;
  render(<Probe onState={(s) => { second = s; }} />);
  expect(second.loading).toBe(false);
  expect(second.slots).toHaveLength(2);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

// Review fix: an empty catalogue is an outage, not "no slots match".
test('an empty catalogue is treated as an error and retried on remount', async () => {
  global.fetch = jest.fn().mockReturnValueOnce(ok({ slots: [] })).mockReturnValueOnce(ok({ slots: ROWS }));
  let first;
  const { unmount } = render(<Probe onState={(s) => { first = s; }} />);
  await waitFor(() => expect(first.error).toBeTruthy());
  unmount();
  let second;
  render(<Probe onState={(s) => { second = s; }} />);
  await waitFor(() => expect(second.slots).toHaveLength(2));
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

// Review Focus 3: a failed load reports an error and the next mount retries.
test('a failed load sets error, and a remount retries', async () => {
  global.fetch = jest.fn().mockReturnValueOnce(fail()).mockReturnValueOnce(ok({ slots: ROWS }));
  let first;
  const { unmount } = render(<Probe onState={(s) => { first = s; }} />);
  await waitFor(() => expect(first.error).toBeTruthy());
  expect(first.slots).toEqual([]);
  unmount();
  let second;
  render(<Probe onState={(s) => { second = s; }} />);
  await waitFor(() => expect(second.loading).toBe(false));
  expect(second.error).toBeNull();
  expect(second.slots).toHaveLength(2);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
