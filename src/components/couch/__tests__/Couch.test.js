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
// During a commercial the TV door goes where the commercial points; its name keeps the TV's own news.
const GSN_LABEL = 'TV: A Goofer Shopping Network commercial. Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time! Opens Store.';

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

describe('focus after the camera', () => {
  const door = (name) => screen.getByRole('link', { name });

  test('Back lands on the door you left through', async () => {
    renderSite(F.offair.input, true, { ...ZERO, pull: 1 });
    await goThroughDoor(/^Tapes:/);
    expect(page()).toBe('/vods');
    await act(async () => nav(-1));
    await waitFor(() => expect(document.activeElement).toBe(door(/^Tapes:/)));
  });

  test('Back through a thing (the iris) lands on it too', async () => {
    renderSite();
    await goThroughDoor(/^Photo:/);
    await act(async () => nav(-1));
    await waitFor(() => expect(document.activeElement).toBe(door(/^Photo:/)));
  });

  test('reduced motion: Back lands on the door too', async () => {
    renderSite(F.offair.input, true, ZERO, true);
    await goThroughDoor(/^TV guide:/);
    await act(async () => nav(-1));
    await waitFor(() => expect(document.activeElement).toBe(door(/^TV guide:/)));
  });

  test('phones: Back lands on the tile', async () => {
    renderSite(F.offair.input, false);
    await goThroughDoor(/^Remote:/);
    expect(page()).toBe('/store');
    await act(async () => nav(-1));
    await waitFor(() => expect(document.activeElement).toBe(door(/^Remote:/)));
  });

  test('coming home by the nav takes no door', async () => {
    renderSite();
    await goThroughDoor(/^Tapes:/);
    await act(async () => nav('/'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.activeElement).toBe(document.body);
  });
});

test.each([
  ['the room', true],
  ['a phone', false],
])('watching from %s keeps the page query (a dev ?fixture= survives)', async (_, room) => {
  let loc;
  function Here() {
    loc = useLocation();
    return <Couch input={F.live.input} />;
  }
  window.matchMedia = jest.fn((query) => ({ matches: query.includes('reduced-motion') ? false : room, addEventListener() {}, removeEventListener() {} }));
  render(
    <MemoryRouter initialEntries={['/?fixture=live']}>
      <CameraProvider timings={ZERO}>
        <Here />
      </CameraProvider>
    </MemoryRouter>
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('link', { name: /^TV:/ }), { button: 0 });
  });
  expect(await screen.findByTitle("Goofer's live stream")).toBeTruthy();
  expect([loc.pathname, loc.search]).toEqual(['/', '?fixture=live']);
});

describe('watching inside the TV', () => {
  const tvDoor = () => screen.getByRole('link', { name: /^TV:/ });
  const room = () => document.querySelector('section[aria-label="Goofer\'s couch"]');
  async function watch(input = F.live.input) {
    const view = renderSite(input);
    await act(async () => {
      fireEvent.click(tvDoor(), { button: 0 });
    });
    const frame = await screen.findByTitle("Goofer's live stream");
    return { view, frame, dialog: screen.getByRole('dialog', { name: "Goofer's stream" }) };
  }
  const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  test('the buttons come before the player, and focus starts on Back to the couch', async () => {
    const { frame } = await watch();
    const back = screen.getByRole('button', { name: 'Back to the couch' });
    const twitch = screen.getByRole('link', { name: 'Open on Twitch in a new tab' });
    expect(follows(back, twitch)).toBe(true);
    expect(follows(twitch, frame)).toBe(true);
    expect(document.activeElement).toBe(back);
    // It opens a new tab, says so, and reads at 5:1.
    expect(twitch.getAttribute('target')).toBe('_blank');
    expect(twitch.className).toContain('bg-onair-viewer-deep');
  });

  test('Tab stays inside: round from the last stop to the first and back', async () => {
    const { frame, dialog } = await watch();
    const back = screen.getByRole('button', { name: 'Back to the couch' });
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(frame);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(back);
    // Tabbing out past the player's own controls lands on the guard, which sends focus round.
    dialog.querySelector('[data-focus-guard]').focus();
    expect(document.activeElement).toBe(back);
    // Focus somewhere outside (it can't get there by Tab) comes back in.
    act(() => tvDoor().focus());
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  test('the room behind is inert while it is open, and wakes when it closes', async () => {
    const { dialog } = await watch();
    expect(room().closest('[inert]')).toBeTruthy();
    expect(dialog.closest('[inert]')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back to the couch' }));
    });
    expect(document.querySelector('[inert]')).toBeNull();
  });

  test('Back to the couch hands focus to the TV door', async () => {
    await watch();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back to the couch' }));
    });
    expect(screen.queryByTitle("Goofer's live stream")).toBeNull();
    expect(document.activeElement).toBe(tvDoor());
  });

  test('Escape hands focus to the TV door', async () => {
    await watch();
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByTitle("Goofer's live stream")).toBeNull();
    expect(document.activeElement).toBe(tvDoor());
  });

  test('Back hands focus to the TV door', async () => {
    await watch();
    await act(async () => nav(-1));
    expect(screen.queryByTitle("Goofer's live stream")).toBeNull();
    expect(document.activeElement).toBe(tvDoor());
  });

  test('the stream ending hands focus to the TV door', async () => {
    const { view } = await watch();
    view.rerender(
      <MemoryRouter initialEntries={['/']}>
        <CameraProvider timings={ZERO}>
          <Site input={F.offair.input} />
        </CameraProvider>
      </MemoryRouter>
    );
    expect(screen.queryByTitle("Goofer's live stream")).toBeNull();
    expect(document.activeElement).toBe(tvDoor());
    expect(document.querySelector('[inert]')).toBeNull();
  });
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
    expect(tv().getAttribute('aria-label')).toBe(GSN_LABEL);
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

  test('a 3G connection is treated like Save-Data: the commercial is one still frame', () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '3g' } });
    try {
      renderSite();
      toGsn();
      const ad = screen.getByTestId('tv-ad');
      expect(ad.getAttribute('data-still')).toBe('true');
      expect(ad.querySelectorAll('img')).toHaveLength(1);
    } finally {
      delete navigator.connection;
    }
  });

  test('pointing at the TV door holds the reel, so the door never changes under you', () => {
    renderSite();
    fireEvent.pointerEnter(tv());
    for (let i = 0; i < 5; i += 1) step(SEGMENT_MS);
    expect(screen.queryByTestId('tv-switch')).toBeNull();
    expect(tv().getAttribute('href')).toBe('/vods');
    fireEvent.pointerLeave(tv());
    toGsn();
    expect(tv().getAttribute('href')).toBe('/store');
    // Held on the commercial, it stays the store's door past the commercial's slot.
    fireEvent.pointerEnter(tv());
    step(AD_MS * 2);
    expect(screen.getByTestId('tv-ad')).toBeTruthy();
    expect(tv().getAttribute('href')).toBe('/store');
    expect(tv().getAttribute('aria-label')).toBe(GSN_LABEL);
    fireEvent.pointerLeave(tv());
    step(AD_MS);
    step(STATIC_MS);
    expect(tv().getAttribute('href')).toBe('/vods');
  });

  test('keyboard focus on the TV door holds the reel too, until it moves on', () => {
    renderSite();
    // jsdom counts a focus() as :focus-visible, as a browser does after Tab.
    act(() => tv().focus());
    // The pointer passing over and away does not end a keyboard hold.
    fireEvent.pointerEnter(tv());
    fireEvent.pointerLeave(tv());
    for (let i = 0; i < 5; i += 1) step(SEGMENT_MS);
    expect(screen.queryByTestId('tv-switch')).toBeNull();
    act(() => tv().blur());
    toGsn();
    expect(tv().getAttribute('href')).toBe('/store');
  });

  test('phones: the TV crop holds while touched or keyboard-focused too', () => {
    renderSite(F.offair.input, false);
    // A finger on the crop (touch pointers enter and leave like a mouse).
    fireEvent.pointerEnter(tv(), { pointerType: 'touch' });
    for (let i = 0; i < 5; i += 1) step(SEGMENT_MS);
    expect(screen.queryByTestId('tv-switch')).toBeNull();
    expect(tv().getAttribute('href')).toBe('/vods');
    fireEvent.pointerLeave(tv(), { pointerType: 'touch' });
    step(SEGMENT_MS);
    expect(screen.getByTestId('tv-switch')).toBeTruthy();
    step(STATIC_MS);
    act(() => tv().focus());
    for (let i = 0; i < 5; i += 1) step(SEGMENT_MS);
    expect(screen.queryByTestId('tv-switch')).toBeNull();
    act(() => tv().blur());
    step(SEGMENT_MS);
    step(STATIC_MS);
    step(SEGMENT_MS);
    step(STATIC_MS);
    expect(tv().getAttribute('href')).toBe('/store');
  });

  test('phones: the TV crop follows the commercial too', () => {
    renderSite(F.offair.input, false);
    toGsn();
    expect(tv().getAttribute('data-door')).toBe('tv');
    expect(tv().getAttribute('href')).toBe('/store');
    expect(tv().getAttribute('aria-label')).toBe(GSN_LABEL);
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
    expect(laptop().getAttribute('aria-label')).toBe('Laptop: Last hunt paid $412 on $600. Best hit: 1240x on Sugar Rush 1000. Opens Hunts.');
    expect(chip()).toContain('Best hit 1240x');
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

  test('a live hunt keeps the laptop on Hunts, and says so', () => {
    renderSite(F.hunt.input);
    expect(laptop().getAttribute('href')).toBe('/gamba/hunts');
    step(WINDOW_MS);
    step(WINDOW_MS);
    expect(laptop().getAttribute('aria-label')).toBe('Laptop: A hunt is running. 14 of 23 bonuses opened, $412 back so far. Opens Hunts.');
  });

  test('a commercial on the TV and a window on the laptop at once: each door keeps its own', () => {
    const tv = () => screen.getByRole('link', { name: /^TV:/ });
    const WINDOW_DOOR = {
      leaderboard: ['/gamba/leaderboard', 'Leaderboard'],
      recap: ['/gamba/hunts', 'Hunts'],
      history: ['/gamba/hunts', 'Hunts'],
      screensaver: ['/gamba', 'Gamba'],
    };
    renderSite();
    // To the GSN commercial: the newest tape, a card and a clip, each with its static.
    for (let i = 0; i < 3; i += 1) {
      step(SEGMENT_MS);
      step(STATIC_MS);
    }
    expect(screen.getByTestId('tv-ad').getAttribute('data-ad')).toBe('gsn');
    expect(tv().getAttribute('href')).toBe('/store');
    expect(tv().getAttribute('aria-label')).toBe(GSN_LABEL);
    // By now the laptop has moved on from the board too; its door follows its own window.
    const onLaptop = document.querySelector('[data-window]').getAttribute('data-window');
    expect(onLaptop).not.toBe('leaderboard');
    const [href, page] = WINDOW_DOOR[onLaptop];
    expect(laptop().getAttribute('href')).toBe(href);
    expect(laptop().getAttribute('aria-label')).toMatch(new RegExp(`^Laptop: .* Opens ${page}\\.$`));
  });

  test('pointing at or focusing the laptop door holds its window', () => {
    renderSite();
    fireEvent.pointerEnter(laptop());
    step(WINDOW_MS * 3);
    expect(laptop().getAttribute('href')).toBe('/gamba/leaderboard');
    expect(chip()).toContain('BEAN board');
    fireEvent.pointerLeave(laptop());
    step(WINDOW_MS);
    expect(laptop().getAttribute('href')).toBe('/gamba/hunts');
    act(() => laptop().focus());
    step(WINDOW_MS * 3);
    expect(laptop().getAttribute('href')).toBe('/gamba/hunts');
    expect(chip()).toContain('Best hit 1240x');
    act(() => laptop().blur());
    step(WINDOW_MS);
    expect(chip()).toContain('Last 5 hunts');
  });

  test('holding one screen leaves the other running', () => {
    renderSite();
    fireEvent.pointerEnter(laptop());
    for (let i = 0; i < 3; i += 1) {
      step(SEGMENT_MS);
      step(STATIC_MS);
    }
    expect(screen.getByTestId('tv-ad').getAttribute('data-ad')).toBe('gsn');
    expect(laptop().getAttribute('href')).toBe('/gamba/leaderboard');
  });

  test('reduced motion: the laptop holds one window', () => {
    renderSite(F.offair.input, true, ZERO, true);
    for (let i = 0; i < 5; i += 1) step(WINDOW_MS);
    expect(laptop().getAttribute('href')).toBe('/gamba/leaderboard');
    expect(chip()).toContain('BEAN board');
  });

  test('phones have no laptop screen, so the tile keeps its own door', () => {
    renderSite(F.offair.input, false);
    expect(laptop().getAttribute('href')).toBe('/gamba');
    step(WINDOW_MS);
    expect(laptop().getAttribute('href')).toBe('/gamba');
  });
});

// A door focused by a script (Back, leaving the TV) or by a click has no
// :focus-visible in a browser, so it must not hold its screen: a mouse user
// would see the reel or the laptop freeze with no ring and no reason.
describe('a door focused by a script holds nothing', () => {
  const tv = () => screen.getByRole('link', { name: /^TV:/ });
  const laptop = () => screen.getByRole('link', { name: /^Laptop:/ });
  const step = (ms) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  const settle = async () => {
    for (let i = 0; i < 20; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(20);
      });
    }
  };
  // jsdom counts any focus as :focus-visible; here it follows the browser.
  const realMatches = Element.prototype.matches;
  let keyboard = false;
  beforeEach(() => {
    jest.useFakeTimers();
    keyboard = false;
    Element.prototype.matches = function matches(selector) {
      return selector === ':focus-visible' ? keyboard && realMatches.call(this, ':focus') : realMatches.call(this, selector);
    };
  });
  afterEach(() => {
    Element.prototype.matches = realMatches;
    jest.useRealTimers();
  });

  async function throughAndBack(door, path) {
    await act(async () => {
      fireEvent.click(door(), { button: 0 });
    });
    await settle();
    expect(page()).toBe(path);
    await act(async () => nav(-1));
    await settle();
    expect(document.activeElement).toBe(door());
  }

  test('Back through the TV door: focus lands on it, and the reel moves on', async () => {
    renderSite();
    await throughAndBack(tv, '/vods');
    expect(screen.queryByTestId('tv-card')).toBeNull();
    step(SEGMENT_MS);
    step(STATIC_MS);
    expect(screen.getByTestId('tv-card')).toBeTruthy();
  });

  test('Back through the laptop door: focus lands on it, and the windows move on', async () => {
    renderSite();
    await throughAndBack(laptop, '/gamba/leaderboard');
    expect(laptop().getAttribute('href')).toBe('/gamba/leaderboard');
    step(WINDOW_MS);
    expect(laptop().getAttribute('href')).toBe('/gamba/hunts');
  });

  test('the stream ending while you watch: focus lands on the TV door, and the reel runs', async () => {
    const view = renderSite(F.live.input);
    await act(async () => {
      fireEvent.click(tv(), { button: 0 });
    });
    await settle();
    expect(screen.getByTitle("Goofer's live stream")).toBeTruthy();
    view.rerender(
      <MemoryRouter initialEntries={['/']}>
        <CameraProvider timings={ZERO}>
          <Site input={F.offair.input} />
        </CameraProvider>
      </MemoryRouter>
    );
    await settle();
    expect(document.activeElement).toBe(tv());
    step(SEGMENT_MS);
    step(STATIC_MS);
    expect(screen.getByTestId('tv-card')).toBeTruthy();
  });

  test('a keyboard user coming Back (focus is visible) still holds the TV', async () => {
    keyboard = true;
    renderSite();
    await throughAndBack(tv, '/vods');
    for (let i = 0; i < 3; i += 1) step(SEGMENT_MS);
    expect(screen.queryByTestId('tv-switch')).toBeNull();
    expect(screen.queryByTestId('tv-card')).toBeNull();
  });
});
