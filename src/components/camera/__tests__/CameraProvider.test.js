import { useEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { logCovers } from '../../../test/coverLog';
import CameraProvider, { useCamera } from '../CameraProvider';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));

const ZERO = { zoom: 0, cut: 0, staticIn: 0, iris: 0, minHold: 0, maxHold: 0, tuneOut: 0, pull: 0, introPull: 0, fade: 0, grow: 0 };
let cam;
let nav;
let trail;
function Harness() {
  cam = useCamera();
  nav = useNavigate();
  const loc = useLocation();
  // Every location the router lands on, to count navigations.
  useEffect(() => {
    trail.push(loc.pathname);
  }, [loc]);
  return <p data-testid="where">{`${loc.pathname}|${JSON.stringify(loc.state)}`}</p>;
}
const renderCam = (timings = ZERO) => {
  trail = [];
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider timings={timings}>
        <Harness />
      </CameraProvider>
    </MemoryRouter>
  );
};
const where = () => screen.getByTestId('where').textContent;
const ZOOM = { scale: 2, x: -10, y: -20 };

// Plays a move outside act, so each of its steps reaches the DOM (act would
// hold every render until the move ended), and waits for it to finish.
async function play(start) {
  let moving;
  act(() => {
    moving = start();
  });
  await waitFor(() => expect(cam.busy).toBe(false));
  await act(() => moving);
}

afterEach(() => {
  delete window.matchMedia;
  delete Element.prototype.animate;
});

test('goThrough leaves the stage at the zoom, navigates and clears the static', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() => cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }));
  expect(where()).toBe('/vods|null');
  expect(stage.style.transform).toBe('translate(-10px, -20px) scale(2)');
  expect(screen.queryByTestId('camera-static')).toBeNull();
});

test('a second door while the camera is moving is ignored', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() =>
    Promise.all([
      cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }),
      cam.goThrough({ stage, zoom: ZOOM, href: '/store', doorId: 'remote' }),
    ])
  );
  expect(where()).toBe('/vods|null');
});

test('reduced motion fades instead of zooming', async () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  Element.prototype.animate = jest.fn(() => ({ finished: Promise.resolve(), cancel() {} }));
  renderCam({ ...ZERO, fade: 1 });
  const stage = document.createElement('div');
  await act(() => cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }));
  expect(where()).toBe('/vods|null');
  const keyframes = Element.prototype.animate.mock.calls.map(([kf]) => kf[0]);
  expect(keyframes.some((k) => 'transform' in k)).toBe(false);
  expect(stage.style.transform).toBe('');
});

test('Back from the door it went through hands that door back once', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() => cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }));
  act(() => nav(-1));
  expect(where()).toBe('/|null');
  expect(cam.takeReturn()).toEqual({ doorId: 'tapes', cut: 'static' });
  expect(cam.takeReturn()).toBeNull();
});

test('arriving home by a push is not a return', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() => cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }));
  act(() => nav('/'));
  expect(cam.takeReturn()).toBeNull();
});

test('pullBack ends at rest without static', async () => {
  renderCam();
  const stage = document.createElement('div');
  cam.hold({ stage, zoom: ZOOM });
  expect(stage.style.transform).toBe('translate(-10px, -20px) scale(2)');
  await act(() => cam.pullBack({ stage, zoom: ZOOM }));
  expect(stage.style.transform).toBe('');
  expect(screen.queryByTestId('camera-static')).toBeNull();
});

test('enterInPlace keeps the path and sets the state', async () => {
  renderCam();
  const stage = document.createElement('div');
  await act(() => cam.enterInPlace({ stage, zoom: ZOOM, state: { watch: true } }));
  expect(where()).toBe('/|{"watch":true}');
});

test('growFrom grows a ghost, navigates and removes it', async () => {
  renderCam();
  await act(() =>
    cam.growFrom({ rect: { x: 10, y: 400, width: 120, height: 80 }, src: '/couch/cut-tapes.webp', href: '/vods', doorId: 'tapes', view: { x: 0, y: 57, width: 390, height: 787 } })
  );
  expect(where()).toBe('/vods|null');
  expect(screen.queryByTestId('camera-ghost')).toBeNull();
});

test('a move never overrides a navigation made during it', async () => {
  renderCam({ ...ZERO, zoom: 30, cut: 20 });
  const stage = document.createElement('div');
  let move;
  act(() => {
    move = cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' });
  });
  await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
  act(() => nav('/schedule'));
  await act(() => move);
  expect(where()).toBe('/schedule|null');
  expect(cam.takeReturn()).toBeNull();
  expect(cam.busy).toBe(false);
  expect(screen.queryByTestId('camera-static')).toBeNull();
});

test('static stays the default cut: the static covers the swap and no iris mounts', async () => {
  renderCam();
  const covers = logCovers();
  const stage = document.createElement('div');
  await play(() => cam.goThrough({ stage, zoom: ZOOM, href: '/vods', doorId: 'tapes' }));
  covers.stop();
  expect(covers.cuts()).toEqual(['camera-static']);
  expect(trail).toEqual(['/', '/vods']);
});

test('the iris cut closes a black iris, never static, navigates once and clears it', async () => {
  renderCam({ ...ZERO, iris: 20, minHold: 20, tuneOut: 20 });
  const covers = logCovers();
  const stage = document.createElement('div');
  await play(() => cam.goThrough({ stage, zoom: ZOOM, href: '/about', doorId: 'photo', cut: 'iris' }));
  covers.stop();
  expect(covers.log).toEqual(expect.arrayContaining(['camera-iris:in', 'camera-iris:hold', 'camera-iris:out']));
  expect(covers.cuts()).toEqual(['camera-iris']);
  expect(trail).toEqual(['/', '/about']);
  expect(where()).toBe('/about|null');
  expect(stage.style.transform).toBe('translate(-10px, -20px) scale(2)');
  expect(screen.queryByTestId('camera-iris')).toBeNull();
});

test('the iris is decorative and takes no pointer', async () => {
  renderCam({ ...ZERO, minHold: 200 });
  const stage = document.createElement('div');
  let moving;
  act(() => {
    moving = cam.goThrough({ stage, zoom: ZOOM, href: '/about', doorId: 'photo', cut: 'iris' });
  });
  const iris = await screen.findByTestId('camera-iris');
  expect(iris.getAttribute('aria-hidden')).toBe('true');
  expect(iris.className).toMatch(/\bpointer-events-none\b/);
  expect(iris.className).toMatch(/\bfixed\b/);
  await waitFor(() => expect(cam.busy).toBe(false));
  await act(() => moving);
});

test('the iris moves by transform only, closing and opening', async () => {
  Element.prototype.animate = jest.fn(() => ({ finished: Promise.resolve(), cancel() {} }));
  renderCam({ ...ZERO, iris: 20, tuneOut: 20 });
  const stage = document.createElement('div');
  await play(() => cam.goThrough({ stage, zoom: ZOOM, href: '/about', doorId: 'photo', cut: 'iris' }));
  const closing = Element.prototype.animate.mock.calls.length;
  expect(closing).toBeGreaterThan(0);
  act(() => nav(-1));
  const back = cam.takeReturn();
  await play(() => cam.pullBack({ stage, zoom: ZOOM, cut: back.cut }));
  // Nothing else here animates (no zoom, no pull, no #main), so every call is the iris.
  const calls = Element.prototype.animate.mock.calls;
  expect(calls.length).toBeGreaterThan(closing);
  for (const [keyframes] of calls) {
    for (const frame of keyframes) expect(Object.keys(frame)).toEqual(['transform']);
  }
});

test('the iris path keeps the guard: a navigation made during the move wins', async () => {
  renderCam({ ...ZERO, zoom: 30, cut: 20 });
  const stage = document.createElement('div');
  let moving;
  act(() => {
    moving = cam.goThrough({ stage, zoom: ZOOM, href: '/about', doorId: 'photo', cut: 'iris' });
  });
  await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
  act(() => nav('/schedule'));
  await act(() => moving);
  expect(where()).toBe('/schedule|null');
  expect(trail).toEqual(['/', '/schedule']);
  expect(cam.takeReturn()).toBeNull();
  expect(cam.busy).toBe(false);
  expect(screen.queryByTestId('camera-iris')).toBeNull();
});

test('Back through an iris door hands back its cut, and the pull-back opens the iris instead of static', async () => {
  renderCam({ ...ZERO, tuneOut: 20 });
  const stage = document.createElement('div');
  await act(() => cam.goThrough({ stage, zoom: ZOOM, href: '/about', doorId: 'photo', cut: 'iris' }));
  act(() => nav(-1));
  const back = cam.takeReturn();
  expect(back).toEqual({ doorId: 'photo', cut: 'iris' });
  const covers = logCovers();
  await play(() => cam.pullBack({ stage, zoom: ZOOM, cut: back.cut }));
  covers.stop();
  expect(covers.log).toEqual(expect.arrayContaining(['camera-iris:hold', 'camera-iris:open']));
  expect(covers.cuts()).toEqual(['camera-iris']);
  expect(stage.style.transform).toBe('');
  expect(screen.queryByTestId('camera-iris')).toBeNull();
});

test('reduced motion cross-fades for the iris cut too: no iris, no zoom', async () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  Element.prototype.animate = jest.fn(() => ({ finished: Promise.resolve(), cancel() {} }));
  renderCam({ ...ZERO, fade: 1 });
  const covers = logCovers();
  const stage = document.createElement('div');
  await play(() => cam.goThrough({ stage, zoom: ZOOM, href: '/about', doorId: 'photo', cut: 'iris' }));
  expect(where()).toBe('/about|null');
  act(() => nav(-1));
  const back = cam.takeReturn();
  await play(() => cam.pullBack({ stage, zoom: ZOOM, cut: back.cut }));
  covers.stop();
  expect(covers.log).toEqual([]);
  const keyframes = Element.prototype.animate.mock.calls.map(([kf]) => kf[0]);
  expect(keyframes.some((k) => 'transform' in k)).toBe(false);
  expect(stage.style.transform).toBe('');
});

test('phones: an iris tile grows its ghost under the iris and shrinks back into it', async () => {
  renderCam({ ...ZERO, tuneOut: 20 });
  const tile = { rect: { x: 10, y: 400, width: 120, height: 80 }, src: '/couch/cut-photo.webp', view: { x: 0, y: 0, width: 390, height: 844 } };
  const covers = logCovers();
  await play(() => cam.growFrom({ ...tile, href: '/about', doorId: 'photo', cut: 'iris' }));
  expect(where()).toBe('/about|null');
  act(() => nav(-1));
  const back = cam.takeReturn();
  expect(back).toEqual({ doorId: 'photo', cut: 'iris' });
  await play(() => cam.shrinkInto({ rect: tile.rect, src: tile.src, view: tile.view, cut: back.cut }));
  covers.stop();
  expect(covers.cuts()).toEqual(['camera-iris']);
  expect(covers.log).toContain('camera-iris:open');
  expect(screen.queryByTestId('camera-ghost')).toBeNull();
  expect(screen.queryByTestId('camera-iris')).toBeNull();
});
