/**
 * @jest-environment node
 */
import { dropOrder, FEED_SIZE, forgetOrder, pushOrder, recordOrder } from '../../api/_lib/storeFeed.js';

test('pushOrder puts the newest first, drops duplicates and caps the feed', () => {
  const full = Array.from({ length: FEED_SIZE }, (_, i) => ({ id: `o${i}` }));
  const out = pushOrder(full, { id: 'new' });
  expect(out).toHaveLength(FEED_SIZE);
  expect(out[0].id).toBe('new');
  expect(out.map((o) => o.id)).not.toContain(`o${FEED_SIZE - 1}`);
  expect(pushOrder([{ id: 'a' }, { id: 'b' }], { id: 'b' }).map((o) => o.id)).toEqual(['b', 'a']);
  expect(pushOrder(undefined, { id: 'a' })).toEqual([{ id: 'a' }]);
});

test('dropOrder removes by id', () => {
  expect(dropOrder([{ id: 'a' }, { id: 'b' }], 'a')).toEqual([{ id: 'b' }]);
  expect(dropOrder(undefined, 'a')).toEqual([]);
});

test('feed writes are best effort: failures are logged, never thrown', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const db = { collection: () => ({ doc: () => ({}) }), runTransaction: () => Promise.reject(new Error('boom')) };
  await expect(recordOrder(db, { id: 'a' })).resolves.toBeUndefined();
  await expect(forgetOrder(db, 'a')).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledTimes(2);
  log.mockRestore();
});
