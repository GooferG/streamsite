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
    holder = req;
    Promise.resolve(req.cb()).then(() => {
      if (holder === req) {
        holder = null;
        req.resolve();
        next();
      }
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
  const { result } = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc() }));
  await flush();
  expect(result.current.isDriver).toBe(true);
  expect(locks.held).toBe(true);
});

test('a hidden second tab waits, then takes over when the first goes away', async () => {
  const locks = createFakeLocks();
  const view = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc('visible') }));
  await flush();
  const utils = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc('hidden') }));
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
  const { unmount } = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc() }));
  unmount();
  await flush();
  expect(locks.held).toBe(false);
  const view = renderHook(() => useDriverLock(true, { locks, doc: fakeDoc() }));
  await flush();
  expect(view.result.current.isDriver).toBe(true);
});
