import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import CameraProvider from '../../camera/CameraProvider';
import Couch from '../Couch';
import { COUCH_FIXTURES as F } from '../couchFixtures';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
const ZERO = { zoom: 0, cut: 0, staticIn: 0, minHold: 0, maxHold: 0, tuneOut: 0, pull: 0, introPull: 0, fade: 0, grow: 0 };
let nav;

function Site({ input }) {
  const loc = useLocation();
  nav = useNavigate();
  return loc.pathname === '/' ? <Couch input={input} /> : <p data-testid="page">{loc.pathname}</p>;
}
const renderSite = (input = F.offair.input, room = true, timings = ZERO) => {
  // Only the room query follows `room`; reduced motion stays off so the camera moves.
  window.matchMedia = jest.fn((query) => ({
    matches: query.includes('reduced-motion') ? false : room,
    addEventListener() {},
    removeEventListener() {},
  }));
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider timings={timings}>
        <Site input={input} />
      </CameraProvider>
    </MemoryRouter>
  );
};

beforeEach(() => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});
afterEach(() => {
  delete window.matchMedia;
  delete Element.prototype.animate;
});

test('a door takes you to its page', async () => {
  renderSite();
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Tapes:/ }), { button: 0 });
  });
  await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('/vods'));
});

test('two quick clicks still make one trip', async () => {
  renderSite();
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Tapes:/ }), { button: 0 });
    fireEvent.click(screen.getByRole('link', { name: /^TV guide:/ }), { button: 0 });
  });
  await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('/vods'));
});

test('the remote flips the TV to GSN, then lands on the Store', async () => {
  renderSite();
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Remote:/ }), { button: 0 });
  });
  expect(screen.getByTestId('tv-flip')).toBeTruthy();
  await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('/store'));
});

test('live: the TV opens the stream inside the TV, and Back to the couch closes it', async () => {
  renderSite(F.live.input);
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^TV:/ }), { button: 0 });
  });
  expect(await screen.findByTitle("Goofer's live stream")).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Back to the couch' }));
  });
  expect(screen.queryByTitle("Goofer's live stream")).toBeNull();
});

test('the stream ending while you watch closes the frame', async () => {
  const { rerender } = renderSite(F.live.input);
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^TV:/ }), { button: 0 });
  });
  expect(await screen.findByTitle("Goofer's live stream")).toBeTruthy();
  rerender(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider timings={ZERO}>
        <Site input={F.offair.input} />
      </CameraProvider>
    </MemoryRouter>
  );
  expect(screen.queryByTitle("Goofer's live stream")).toBeNull();
  expect(screen.getByRole('link', { name: /^Tapes:/ })).toBeTruthy();
});

test('Back from a door pulls the camera back once; the nav does not', async () => {
  Element.prototype.animate = jest.fn(() => ({ finished: Promise.resolve(), cancel() {} }));
  renderSite(F.offair.input, true, { ...ZERO, pull: 1 });
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Tapes:/ }), { button: 0 });
  });
  await waitFor(() => expect(screen.getByTestId('page')).toBeTruthy());
  // Let the camera finish tuning in; a pull-back during a move is skipped.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  await act(async () => nav(-1));
  await waitFor(() => expect(Element.prototype.animate).toHaveBeenCalled());
  const [keyframes] = Element.prototype.animate.mock.calls[0];
  expect(keyframes[1].transform).toBe('translate(0px, 0px) scale(1)');
  Element.prototype.animate.mockClear();
  await act(async () => nav('/vods'));
  await act(async () => nav('/'));
  expect(Element.prototype.animate).not.toHaveBeenCalled();
});

test('phones: a tile grows into its page', async () => {
  renderSite(F.offair.input, false);
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^TV guide:/ }), { button: 0 });
  });
  await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('/schedule'));
});
