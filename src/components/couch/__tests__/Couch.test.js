import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { logCovers } from '../../../test/coverLog';
import CameraProvider from '../../camera/CameraProvider';
import Couch from '../Couch';
import { AD_MS } from '../commercials';
import { WINDOW_MS } from '../LaptopScreen';
import { COUCH_FIXTURES as F } from '../couchFixtures';
import { SEGMENT_MS, STATIC_MS } from '../reel';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
const ZERO = { zoom: 0, cut: 0, staticIn: 0, iris: 0, minHold: 0, maxHold: 0, tuneOut: 0, pull: 0, introPull: 0, fade: 0, grow: 0 };
let nav;

function Site({ input }) {
  const loc = useLocation();
  nav = useNavigate();
  return loc.pathname === '/' ? <Couch input={input} /> : <p data-testid="page">{loc.pathname}</p>;
}
const renderSite = (input = F.offair.input, room = true, timings = ZERO, reduced = false) => {
  // Only the room query follows `room`; reduced motion stays off so the camera moves.
  window.matchMedia = jest.fn((query) => ({
    matches: query.includes('reduced-motion') ? reduced : room,
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

test('with reduced motion the remote skips the flip and still lands on the Store', async () => {
  renderSite(F.offair.input, true, ZERO, true);
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Remote:/ }), { button: 0 });
  });
  expect(screen.queryByTestId('tv-flip')).toBeNull();
  await waitFor(() => expect(screen.getByTestId('page').textContent).toBe('/store'));
});

test('leaving during the remote flip does not throw', async () => {
  const errors = [];
  const onRejection = (e) => errors.push(e);
  process.on('unhandledRejection', onRejection);
  renderSite();
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Remote:/ }), { button: 0 });
  });
  await act(async () => nav('/vods'));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  process.off('unhandledRejection', onRejection);
  expect(errors).toEqual([]);
  expect(screen.getByTestId('page').textContent).toBe('/vods');
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
  await waitFor(() => expect(screen.getByTestId('couch-stage').style.transform).toBe(''));
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
  await waitFor(() => expect(screen.getByTestId('couch-stage').style.transform).toBe(''));
  // The watch flag is gone from history too, so a reconnect does not reopen the frame.
  rerender(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider timings={ZERO}>
        <Site input={F.live.input} />
      </CameraProvider>
    </MemoryRouter>
  );
  expect(screen.queryByTitle("Goofer's live stream")).toBeNull();
});

test('Back from a door pulls the camera back once; the nav does not', async () => {
  Element.prototype.animate = jest.fn(() => ({ finished: Promise.resolve(), cancel() {} }));
  renderSite(F.offair.input, true, { ...ZERO, pull: 1 });
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^Tapes:/ }), { button: 0 });
  });
  await waitFor(() => expect(screen.getByTestId('page')).toBeTruthy());
  await waitFor(() => expect(screen.queryByTestId('camera-static')).toBeNull());
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

const page = () => screen.getByTestId('page').textContent;

// Clicks a door and waits until its cover is gone; returns the covers it used.
async function goThroughDoor(name) {
  const covers = logCovers();
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name }), { button: 0 });
  });
  await screen.findByTestId('page');
  await waitFor(() => expect(screen.queryByTestId('camera-iris') || screen.queryByTestId('camera-static')).toBeNull());
  covers.stop();
  return covers;
}

test('the photo closes an iris on itself, never static', async () => {
  renderSite();
  const covers = await goThroughDoor(/^Photo:/);
  expect(page()).toBe('/about');
  expect(covers.cuts()).toEqual(['camera-iris']);
});

test('the TV guide closes an iris on itself, never static', async () => {
  renderSite();
  const covers = await goThroughDoor(/^TV guide:/);
  expect(page()).toBe('/schedule');
  expect(covers.cuts()).toEqual(['camera-iris']);
});

test('the laptop is a screen: it cuts to static', async () => {
  renderSite();
  const covers = await goThroughDoor(/^Laptop:/);
  expect(page()).toMatch(/^\/gamba/);
  expect(covers.cuts()).toEqual(['camera-static']);
});

test('Back through the photo opens the iris on the room and pulls back', async () => {
  renderSite(F.offair.input, true, { ...ZERO, tuneOut: 20 });
  await goThroughDoor(/^Photo:/);
  const covers = logCovers();
  await act(async () => nav(-1));
  await waitFor(() => expect(screen.queryByTestId('camera-iris')).toBeNull());
  covers.stop();
  expect(covers.log).toContain('camera-iris:open');
  expect(covers.cuts()).toEqual(['camera-iris']);
  expect(screen.getByTestId('couch-stage').style.transform).toBe('');
});

test('phones: the photo tile closes an iris too', async () => {
  renderSite(F.offair.input, false);
  const covers = await goThroughDoor(/^Photo:/);
  expect(page()).toBe('/about');
  expect(covers.cuts()).toEqual(['camera-iris']);
});

describe('the TV door follows a commercial', () => {
  const tv = () => screen.getByRole('link', { name: /^TV:/ });
  const step = (ms) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  // The offair fixture's reel: the newest tape, a card and a clip, then GSN.
  const toGsn = () => {
    for (let i = 0; i < 3; i += 1) {
      step(SEGMENT_MS);
      step(STATIC_MS);
    }
  };
  const OFF_AIR_LABEL = 'TV: Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time! Opens Vods.';
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('while the GSN commercial plays the TV goes to the store, then back to the tapes', () => {
    renderSite();
    expect(tv().getAttribute('href')).toBe('/vods');
    toGsn();
    expect(screen.getByTestId('tv-ad').getAttribute('data-ad')).toBe('gsn');
    expect(tv().getAttribute('href')).toBe('/store');
    expect(tv().getAttribute('aria-label')).toBe('TV: A Goofer Shopping Network commercial. Opens Store.');
    expect(tv().querySelector('[data-label="tv"]').textContent).toContain('GSN commercial');
    step(AD_MS);
    step(STATIC_MS);
    expect(screen.queryByTestId('tv-ad')).toBeNull();
    expect(tv().getAttribute('href')).toBe('/vods');
    expect(tv().getAttribute('aria-label')).toBe(OFF_AIR_LABEL);
    expect(tv().querySelector('[data-label="tv"]').textContent).toContain('Back tomorrow 11:00 AM');
  });

  test('a click during the commercial goes to its page, even if the commercial ends mid-move', async () => {
    renderSite(F.offair.input, true, { ...ZERO, cut: AD_MS * 2 });
    toGsn();
    await act(async () => {
      fireEvent.click(tv(), { button: 0 });
    });
    step(AD_MS);
    step(STATIC_MS);
    // The commercial is over and the door is back on the tapes; the trip is not.
    expect(tv().getAttribute('href')).toBe('/vods');
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(AD_MS);
      });
    }
    expect(screen.getByTestId('page').textContent).toBe('/store');
  });

  test('Save-Data: the commercial is one still frame, and the door still follows it', () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    try {
      renderSite();
      toGsn();
      const ad = screen.getByTestId('tv-ad');
      expect(ad.getAttribute('data-still')).toBe('true');
      expect(ad.querySelectorAll('img')).toHaveLength(1);
      expect(tv().getAttribute('href')).toBe('/store');
    } finally {
      delete navigator.connection;
    }
  });

  test('phones: the TV crop follows the commercial too', () => {
    renderSite(F.offair.input, false);
    toGsn();
    expect(tv().getAttribute('data-door')).toBe('tv');
    expect(tv().getAttribute('href')).toBe('/store');
    expect(tv().getAttribute('aria-label')).toBe('TV: A Goofer Shopping Network commercial. Opens Store.');
    step(AD_MS);
    step(STATIC_MS);
    expect(tv().getAttribute('href')).toBe('/vods');
  });
});

describe('the laptop door follows the window on screen', () => {
  const laptop = () => screen.getByRole('link', { name: /^Laptop:/ });
  const chip = () => laptop().querySelector('[data-label="laptop"]').textContent;
  const step = (ms) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('the board sends you to the leaderboard, then the recap to Hunts, and so on round', () => {
    renderSite();
    expect(laptop().getAttribute('href')).toBe('/gamba/leaderboard');
    expect(laptop().getAttribute('aria-label')).toMatch(/^Laptop: Go\*\*\*r leads the BEAN board .* Opens Leaderboard\.$/);
    expect(chip()).toContain('BEAN board');
    step(WINDOW_MS);
    expect(laptop().getAttribute('href')).toBe('/gamba/hunts');
    expect(laptop().getAttribute('aria-label')).toBe('Laptop: Last hunt paid $412 on $600. Best hit: 1,240x on Sugar Rush 1000. Opens Hunts.');
    expect(chip()).toContain('Best hit 1,240x');
    step(WINDOW_MS);
    expect(laptop().getAttribute('aria-label')).toMatch(/Opens Hunts\.$/);
    expect(chip()).toContain('Last 5 hunts');
    step(WINDOW_MS);
    expect(laptop().getAttribute('href')).toBe('/gamba');
    expect(laptop().getAttribute('aria-label')).toMatch(/Opens Gamba\.$/);
    step(WINDOW_MS);
    expect(laptop().getAttribute('href')).toBe('/gamba/leaderboard');
  });

  test('a click on the board window goes to the leaderboard, even if the window changes mid-move', async () => {
    renderSite(F.offair.input, true, { ...ZERO, cut: WINDOW_MS * 2 });
    await act(async () => {
      fireEvent.click(laptop(), { button: 0 });
    });
    step(WINDOW_MS);
    expect(laptop().getAttribute('href')).toBe('/gamba/hunts');
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(WINDOW_MS);
      });
    }
    expect(screen.getByTestId('page').textContent).toBe('/gamba/leaderboard');
  });

  test('a live hunt keeps the laptop on Hunts', () => {
    renderSite(F.hunt.input);
    expect(laptop().getAttribute('href')).toBe('/gamba/hunts');
    step(WINDOW_MS * 2);
    expect(laptop().getAttribute('aria-label')).toBe('Laptop: A hunt is running. 14 of 23 bonuses opened, $412 back so far. Opens Gamba.');
  });

  test('phones have no laptop screen, so the tile keeps its own door', () => {
    renderSite(F.offair.input, false);
    expect(laptop().getAttribute('href')).toBe('/gamba');
    step(WINDOW_MS);
    expect(laptop().getAttribute('href')).toBe('/gamba');
  });
});
