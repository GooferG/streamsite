import { render, screen, fireEvent, act } from '@testing-library/react';
import ControlRoom from '../ControlRoom';
import { useControlRoom } from '../../../contexts/ControlRoomContext';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../GiveawayTab', () => () => require('react').createElement('p', null, 'giveaway tab body'));
jest.mock('../PredictTab', () => () => require('react').createElement('p', null, 'predict tab body'));

const at = (ms) => ({ toMillis: () => ms });

// jsdom has no PointerEvent constructor, so `fireEvent.pointerDown` (which
// falls back to the plain `Event` constructor) silently drops `button`,
// `clientX`, `clientY` and `pointerId` — properties the base Event type
// doesn't accept as init options. Build the event by hand and assign them
// directly, wrapped in `act` since dispatchEvent bypasses fireEvent's own
// act wrapping.
function firePointer(type, el, { clientX = 0, clientY = 0, button = 0, pointerId = 1 } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { button, clientX, clientY, pointerId });
  act(() => {
    el.dispatchEvent(event);
  });
}

function makeCr(overrides = {}) {
  const { panel, ...rest } = overrides;
  return {
    enabled: true,
    giveaway: null,
    giveaways: [],
    activeRound: null,
    latestRound: null,
    rounds: [],
    warnings: [],
    dismissWarning: jest.fn(),
    dataLost: false,
    dataGaveUp: false,
    ducked: false,
    panel: { mode: 'float', restoreTo: 'float', rect: null, corner: 'tr', tab: 'giveaway', ...panel },
    panelActions: {
      open: jest.fn(),
      toggle: jest.fn(),
      minimize: jest.fn(),
      close: jest.fn(),
      dock: jest.fn(),
      undock: jest.fn(),
      moveTo: jest.fn(),
      setTab: jest.fn(),
      resetPosition: jest.fn(),
    },
    prefs: { stage: false, hideLiveBadge: false },
    setStage: jest.fn(),
    setHideLiveBadge: jest.fn(),
    ...rest,
  };
}

let cr;
function show(overrides) {
  cr = makeCr(overrides);
  useControlRoom.mockReturnValue(cr);
  return render(<ControlRoom isLive />);
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

test('closed renders no panel', () => {
  show({ panel: { mode: 'closed' } });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('float shows the panel with its tabs and the active tab body', () => {
  show();
  expect(screen.getByRole('dialog', { name: 'Control room' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: /giveaway/i }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('giveaway tab body')).toBeTruthy();
});

test('backtick opens a closed panel', () => {
  show({ panel: { mode: 'closed' } });
  fireEvent.keyDown(window, { key: '`' });
  expect(cr.panelActions.open).toHaveBeenCalled();
});

// Review Focus 5: typing a backtick in a field never toggles the panel.
test('backtick inside a text field does nothing', () => {
  show({ panel: { mode: 'closed' } });
  const input = document.createElement('input');
  document.body.appendChild(input);
  fireEvent.keyDown(input, { key: '`' });
  expect(cr.panelActions.open).not.toHaveBeenCalled();
});

test('Escape powers off, then minimizes', () => {
  show();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(cr.panelActions.minimize).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(cr.panelActions.minimize).toHaveBeenCalled();
});

test('Escape leaves the panel alone while a modal dialog is open', () => {
  const modal = document.createElement('div');
  modal.setAttribute('aria-modal', 'true');
  document.body.appendChild(modal);
  show();
  fireEvent.keyDown(window, { key: 'Escape' });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(cr.panelActions.minimize).not.toHaveBeenCalled();
});

test('header controls call the right actions', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Stage' }));
  expect(cr.setStage).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Dock to the right' }));
  expect(cr.panelActions.dock).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Panel options' }));
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /hide live badge/i }));
  expect(cr.setHideLiveBadge).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Close control room' }));
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(cr.panelActions.close).toHaveBeenCalled();
});

test('the pill shows live state and reopens the panel', () => {
  show({ panel: { mode: 'pill' }, giveaway: { status: 'open', closesAt: null, entryCount: 3 } });
  fireEvent.click(screen.getByRole('button', { name: /open control room\. gvw open · 3 in/i }));
  expect(cr.panelActions.open).toHaveBeenCalled();
});

// Review Focus 2: a stale saved position is clamped on screen (jsdom is 1024×768).
test('a saved position off screen comes back on screen', () => {
  show({ panel: { rect: { x: 5000, y: 5000 } } });
  const dialog = screen.getByRole('dialog', { name: 'Control room' });
  expect(dialog.style.left).toBe('976px');
  expect(dialog.style.top).toBe('732px');
});

test('a new pick opens a minimized panel on the Giveaway tab', () => {
  const view = show({ panel: { mode: 'pill', tab: 'predict' } });
  cr = makeCr({
    panel: { mode: 'pill', tab: 'predict' },
    giveaway: { id: 'g1', status: 'rolling', winnerTwitchId: 'tw1', rolledAt: at(Date.now()), winners: [], winner: { displayName: 'A' } },
  });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  expect(cr.panelActions.open).toHaveBeenCalled();
  expect(cr.panelActions.setTab).toHaveBeenCalledWith('giveaway');
});

test('arrow keys move between tabs', () => {
  show();
  fireEvent.keyDown(screen.getByRole('tab', { name: /giveaway/i }), { key: 'ArrowRight' });
  act(() => {
    jest.advanceTimersByTime(240);
  });
  expect(cr.panelActions.setTab).toHaveBeenCalledWith('predict');
});

// Fix round 1, finding 7: Escape inside a text field must not minimize.
test('Escape inside a text field does not minimize the panel', () => {
  show();
  const input = document.createElement('input');
  document.body.appendChild(input);
  fireEvent.keyDown(input, { key: 'Escape' });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(cr.panelActions.minimize).not.toHaveBeenCalled();
});

// Fix round 1, finding 2: an interrupted drag (Escape mid-drag, here) must
// never leave the panel with a resting `.cr-lifted` transform.
test('an interrupted drag never leaves a resting lift', () => {
  const view = show();
  const dialog = screen.getByRole('dialog', { name: 'Control room' });
  // The drag handle is the header strip; the LIVE tally sits inside it and
  // isn't a button/link/input, so a pointerdown there starts a drag without
  // reaching into the DOM tree for the header itself.
  firePointer('pointerdown', screen.getByText('LIVE'), { button: 0, clientX: 100, clientY: 100 });
  expect(dialog.className).toMatch('cr-lifted');
  fireEvent.keyDown(window, { key: 'Escape' });
  act(() => {
    jest.advanceTimersByTime(320);
  });
  cr = makeCr({ panel: { mode: 'float' } });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  const reopened = screen.getByRole('dialog', { name: 'Control room' });
  expect(reopened.className).not.toMatch('cr-lifted');
});
