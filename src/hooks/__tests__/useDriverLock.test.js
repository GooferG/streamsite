import { renderHook, act } from '@testing-library/react';
import { useDriverLock } from '../useDriverLock';

// Minimal Web Locks: one exclusive holder, a FIFO queue, AbortSignal and steal.
function createFakeLocks() {
  let holder = null;
  const queue = [];
  const abortError = (msg) => Object.assign(new Error(msg), { name: 'AbortError' });
  const next = () => {
    if (!holder && queue.length) grant(queue.shift());
  };
  function grant(req) {
    // A real lock manager grants asynchronously: mark the holder immediately
    // (so `held`/`queued` reflect it right away) but invoke the callback on
    // a later microtask, so a request can still be disposed of before its
    // callback ever runs.
    holder = req;
    queueMicrotask(() => {
      Promise.resolve(req.cb()).then(() => {
        if (holder === req) {
          holder = null;
          req.resolve();
          next();
        }
      });
    });
  }
  return {
    request(_name, opts, cb) {
      return new Promise((resolve, reject) => {
        const req = { cb, resolve, reject };
        if (opts.steal) {
          if (holder) {
            const old = holder;
            holder = null;
            old.reject(abortError('stolen'));
          }
          grant(req);
          return;
        }
        if (opts.signal) {
          opts.signal.addEventListener('abort', () => {
            const i = queue.indexOf(req);
            if (i !== -1) {
              queue.splice(i, 1);
              reject(abortError('aborted'));
            }
          });
        }
        if (holder) queue.push(req);
        else grant(req);
      });
    },
    get held() {
      return !!holder;
    },
    get queued() {
      return queue.length;
    },
  };
}

function fakeDoc(state = 'visible') {
  const listeners = new Set();
  return {
    visibilityState: state,
    addEventListener: (type, fn) => type === 'visibilitychange' && listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
    set(next) {
      this.visibilityState = next;
      listeners.forEach((fn) => fn());
    },
  };
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

test('the only tab drives', async () => {
  const locks = createFakeLocks();
  const doc = fakeDoc();
  const { result } = renderHook(() => useDriverLock(true, { locks, doc }));
  await flush();
  expect(result.current.isDriver).toBe(true);
  expect(locks.held).toBe(true);
});

test('a hidden second tab waits, then takes over when the first goes away', async () => {
  const locks = createFakeLocks();
  const docA = fakeDoc('visible');
  const docB = fakeDoc('hidden');
  const view = renderHook(() => useDriverLock(true, { locks, doc: docA }));
  await flush();
  const utils = renderHook(() => useDriverLock(true, { locks, doc: docB }));
  await flush();
  expect(view.result.current.isDriver).toBe(true);
  expect(utils.result.current.isDriver).toBe(false);
  view.unmount();
  await flush();
  expect(utils.result.current.isDriver).toBe(true);
});

test('a tab that becomes visible takes the lock from a hidden driver', async () => {
  const locks = createFakeLocks();
  const docA = fakeDoc('visible');
  const docB = fakeDoc('hidden');
  const view = renderHook(() => useDriverLock(true, { locks, doc: docA }));
  await flush();
  const utils = renderHook(() => useDriverLock(true, { locks, doc: docB }));
  await flush();
  act(() => docA.set('hidden'));
  act(() => docB.set('visible'));
  await flush();
  expect(utils.result.current.isDriver).toBe(true);
  expect(view.result.current.isDriver).toBe(false);
  expect(locks.queued).toBe(1); // A queued again behind B
});

test('without Web Locks every tab drives', () => {
  const { result } = renderHook(() => useDriverLock(true, { locks: null, doc: fakeDoc() }));
  expect(result.current.isDriver).toBe(true);
  expect(result.current.supported).toBe(false);
});

test('disabled never drives and holds nothing', async () => {
  const locks = createFakeLocks();
  const { result } = renderHook(() => useDriverLock(false, { locks, doc: fakeDoc() }));
  await flush();
  expect(result.current.isDriver).toBe(false);
  expect(locks.held).toBe(false);
});

// Review Focus 3: StrictMode mounts, unmounts and remounts effects in dev.
// A grant that lands for a disposed effect must be handed straight back.
test('unmounting releases the lock at once, even right after mounting', async () => {
  const locks = createFakeLocks();
  const docA = fakeDoc();
  const { unmount } = renderHook(() => useDriverLock(true, { locks, doc: docA }));
  unmount();
  await flush();
  expect(locks.held).toBe(false);
  const docB = fakeDoc();
  const view = renderHook(() => useDriverLock(true, { locks, doc: docB }));
  await flush();
  expect(view.result.current.isDriver).toBe(true);
});

// Review Focus 3 (queued case): the fake grants asynchronously, like a real
// lock manager, so a tab can be disposed of before its grant callback ever
// runs even while another tab is already queued behind it. That stale grant
// must be handed straight back (useDriverLock.js's
// `if (disposed || mine !== gen) return undefined`) so the queued tab is
// freed to take over, instead of the lock getting stuck on a dead requester.
test('a tab that unmounts before its grant callback runs hands off to a tab queued behind it', async () => {
  const locks = createFakeLocks();
  const docA = fakeDoc('visible');
  const docB = fakeDoc('hidden');
  const view = renderHook(() => useDriverLock(true, { locks, doc: docA }));
  const utils = renderHook(() => useDriverLock(true, { locks, doc: docB }));
  // Neither grant callback has run yet -- both are deferred microtasks --
  // but the fake already reflects who holds the slot and who is queued.
  expect(locks.held).toBe(true);
  expect(locks.queued).toBe(1);
  view.unmount();
  await flush();
  expect(utils.result.current.isDriver).toBe(true);
  expect(view.result.current.isDriver).toBe(false);
});

test('a persistent Web Locks failure falls back to every tab driving, without looping', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const request = jest.fn(() =>
    Promise.reject(Object.assign(new Error('opaque origin'), { name: 'SecurityError' })),
  );
  const locks = { request };
  const doc = fakeDoc();
  const { result } = renderHook(() => useDriverLock(true, { locks, doc }));
  await flush();
  expect(result.current.isDriver).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});
