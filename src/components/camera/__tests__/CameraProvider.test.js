import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import CameraProvider, { useCamera } from '../CameraProvider';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));

const ZERO = { zoom: 0, cut: 0, staticIn: 0, minHold: 0, maxHold: 0, tuneOut: 0, pull: 0, introPull: 0, fade: 0, grow: 0 };
let cam;
let nav;
function Harness() {
  cam = useCamera();
  nav = useNavigate();
  const loc = useLocation();
  return <p data-testid="where">{`${loc.pathname}|${JSON.stringify(loc.state)}`}</p>;
}
const renderCam = (timings = ZERO) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider timings={timings}>
        <Harness />
      </CameraProvider>
    </MemoryRouter>
  );
const where = () => screen.getByTestId('where').textContent;
const ZOOM = { scale: 2, x: -10, y: -20 };

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
  expect(cam.takeReturn()).toBe('tapes');
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
