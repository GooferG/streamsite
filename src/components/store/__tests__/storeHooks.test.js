import { act, render } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import useStoreItems from '../useStoreItems';
import useMyOrders from '../useMyOrders';
import useStoreFeed from '../useStoreFeed';

jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: () => ({}),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: jest.fn(),
}));

function Probe({ hook, onValue }) {
  onValue(hook());
  return null;
}

beforeEach(() => {
  onSnapshot.mockImplementation(() => () => {});
});

test('useStoreItems is undefined while loading, then the active items', () => {
  let push;
  onSnapshot.mockImplementation((q, next) => {
    push = next;
    return () => {};
  });
  let value;
  render(<Probe hook={useStoreItems} onValue={(v) => { value = v; }} />);
  expect(value.items).toBeUndefined();
  act(() => push({ docs: [{ id: 'blunt', data: () => ({ name: 'Roll a blunt' }) }] }));
  expect(value).toEqual({ items: [{ id: 'blunt', name: 'Roll a blunt' }], error: null });
});

test('useStoreItems turns a load error into an empty list with the error', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const err = new Error('permission-denied');
  onSnapshot.mockImplementation((q, next, fail) => {
    fail(err);
    return () => {};
  });
  let value;
  render(<Probe hook={useStoreItems} onValue={(v) => { value = v; }} />);
  expect(value).toEqual({ items: [], error: err });
  console.error.mockRestore();
});

test('useMyOrders stays empty and never listens without a viewer', () => {
  let value;
  render(<Probe hook={() => useMyOrders(null)} onValue={(v) => { value = v; }} />);
  expect(value).toEqual([]);
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('useMyOrders listens for the viewer and unsubscribes when they change', () => {
  const unsub = jest.fn();
  onSnapshot.mockImplementation((q, next) => {
    next({ docs: [{ id: 'r1', data: () => ({ itemName: 'Roll a blunt', status: 'pending' }) }] });
    return unsub;
  });
  let value;
  const { rerender } = render(<Probe hook={() => useMyOrders('v1')} onValue={(v) => { value = v; }} />);
  expect(value).toEqual([{ id: 'r1', itemName: 'Roll a blunt', status: 'pending' }]);
  rerender(<Probe hook={() => useMyOrders('v2')} onValue={(v) => { value = v; }} />);
  expect(unsub).toHaveBeenCalledTimes(1);
});

test('useStoreFeed reads the orders array, or nothing when the doc is missing', () => {
  let push;
  onSnapshot.mockImplementation((ref, next) => {
    push = next;
    return () => {};
  });
  let value;
  render(<Probe hook={useStoreFeed} onValue={(v) => { value = v; }} />);
  act(() => push({ exists: () => false, data: () => undefined }));
  expect(value).toEqual([]);
  act(() => push({ exists: () => true, data: () => ({ orders: [{ id: 'a', name: 'x', itemName: 'y', at: 1 }] }) }));
  expect(value).toEqual([{ id: 'a', name: 'x', itemName: 'y', at: 1 }]);
});
