import { render, screen, fireEvent, act, within } from '@testing-library/react';
import ControlRoom from '../ControlRoom';
import SettleModal from '../../admin/predictions/SettleModal';
import NewRoundModal from '../../admin/predictions/NewRoundModal';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { authedFetch } from '../../../utils/authedFetch';
import { useMediaQuery } from '../useMediaQuery';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../GiveawayTab', () => () => require('react').createElement('p', null, 'giveaway tab body'));
jest.mock('../PredictTab', () => () => require('react').createElement('p', null, 'predict tab body'));
jest.mock('../RedeemTab', () => () => require('react').createElement('p', null, 'redeem tab body'));
jest.mock('../useMediaQuery', () => ({ useMediaQuery: jest.fn() }));
jest.mock('../../../config/firebase', () => ({ db: {}, auth: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  onSnapshot: () => () => {},
  orderBy: () => ({}),
  query: () => ({}),
  limit: () => ({}),
}));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const at = (ms) => ({ toMillis: () => ms });

// jsdom has no PointerEvent constructor, so `fireEvent.pointerDown` (which
// falls back to the plain `Event` constructor) silently drops `button`,
// `clientX`, `clientY` and `pointerId` — properties the base Event type
// doesn't accept as init options. Build the event by hand and assign them
// directly, wrapped in `act` since dispatchEvent bypasses fireEvent's own
// act wrapping.
function firePointer(type, el, { clientX = 0, clientY = 0, button = 0, pointerId = 1, buttons } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { button, clientX, clientY, pointerId });
  if (buttons !== undefined) event.buttons = buttons;
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
    redemptions: [],
    redeem: { pending: 0, unseen: 0, capped: false },
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
      resizeTo: jest.fn(),
      setDockW: jest.fn(),
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
  document.body.className = '';
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

// Final review I1: the prediction modals open over the panel. Keys pressed in
// them must never power the panel off, which would unmount the modal and lose
// the settle preview or the new round draft.
const ROUND = {
  id: 'r1',
  title: 'Sunday',
  source: 'manual',
  acceptPredictions: true,
  bonusHuntSnapshot: null,
  rewards: { tiers: [{ place: 1, tickets: 100, prize: null }] },
};

function pressAndWait(el, key) {
  fireEvent.keyDown(el, { key });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
}

test('Escape and backtick inside the settle modal leave the panel open', () => {
  show();
  render(<SettleModal round={ROUND} onClose={() => {}} onSettled={() => {}} />);
  const modal = screen.getByRole('dialog', { name: 'Settle round' });
  const cancel = within(modal).getByRole('button', { name: /cancel/i });
  pressAndWait(cancel, 'Escape');
  pressAndWait(cancel, '`');
  expect(cr.panelActions.minimize).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Control room' })).toBeTruthy();
});

test('Escape and backtick inside the new round modal leave the panel open', async () => {
  authedFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'NO_CURRENT_HUNT' }) });
  show();
  render(<NewRoundModal onClose={() => {}} onCreated={() => {}} />);
  await screen.findByText(/no communityhunts\.gg hunt found yet/i);
  const modal = screen.getByRole('dialog', { name: 'New round' });
  const manual = within(modal).getByRole('button', { name: /manual entry/i });
  pressAndWait(manual, 'Escape');
  pressAndWait(manual, '`');
  expect(cr.panelActions.minimize).not.toHaveBeenCalled();
});

// Final review M5: the inline new giveaway form marks itself keep-open, so a
// backtick on one of its chip buttons never drops the draft.
test('backtick and Escape leave the panel open while an inline draft is on screen', () => {
  const draft = document.createElement('form');
  draft.setAttribute('data-cr-keep-open', '');
  const chip = document.createElement('button');
  chip.type = 'button';
  draft.appendChild(chip);
  document.body.appendChild(draft);
  show();
  pressAndWait(chip, '`');
  pressAndWait(window, 'Escape');
  expect(cr.panelActions.minimize).not.toHaveBeenCalled();
});

// Final review T11: focus stays on the menu trigger, so Escape has to be
// caught there, or it reaches the panel and powers the whole thing off.
test('Escape with the options menu open closes just the menu', () => {
  show();
  const trigger = screen.getByRole('button', { name: 'Panel options' });
  fireEvent.click(trigger);
  expect(screen.getByRole('menu')).toBeTruthy();
  pressAndWait(trigger, 'Escape');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(cr.panelActions.minimize).not.toHaveBeenCalled();
});

// pt-BR and US-International keyboards report the backtick as a dead key.
test('a dead-key backtick toggles the panel, other dead keys do not', () => {
  show({ panel: { mode: 'closed' } });
  fireEvent.keyDown(window, { key: 'Dead', code: 'BracketLeft' });
  expect(cr.panelActions.open).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'Dead', code: 'Backquote' });
  expect(cr.panelActions.open).toHaveBeenCalledTimes(1);
});

test('a held-down backtick does not keep toggling', () => {
  show({ panel: { mode: 'closed' } });
  fireEvent.keyDown(window, { key: '`', repeat: true });
  expect(cr.panelActions.open).not.toHaveBeenCalled();
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
test('a saved position off screen comes back fully on screen', () => {
  show({ panel: { rect: { x: 5000, y: 5000 } } });
  const dialog = screen.getByRole('dialog', { name: 'Control room' });
  expect(dialog.style.left).toBe('644px');
  expect(dialog.style.top).toBe('732px');
});

test('a wide panel saved on a bigger window fits this one', () => {
  show({ panel: { rect: { x: 678, y: 73 }, size: { w: 720, h: null } } });
  const dialog = screen.getByRole('dialog', { name: 'Control room' });
  expect(dialog.style.width).toBe('720px');
  expect(dialog.style.left).toBe('304px');
});

test('a drag can pass the edge, but the drop settles fully on screen', () => {
  show();
  const dialog = screen.getByRole('dialog', { name: 'Control room' });
  // jsdom measures the panel at 0,0, so the grab offset is the pointer itself.
  firePointer('pointerdown', screen.getByText('LIVE'), { clientX: 700, clientY: 80 });
  firePointer('pointermove', screen.getByText('LIVE'), { clientX: 1600, clientY: 150 });
  expect(dialog.style.left).toBe('900px');
  firePointer('pointerup', screen.getByText('LIVE'), { clientX: 1600, clientY: 150 });
  const [rect] = cr.panelActions.moveTo.mock.calls[0];
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + 380).toBeLessThanOrEqual(1024);
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

test('the Redeem tab shows its body', () => {
  show({ panel: { tab: 'redeem' } });
  expect(screen.getByRole('tab', { name: /redeem/i }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('redeem tab body')).toBeTruthy();
});

test('ArrowLeft from Giveaway wraps to Redeem', () => {
  show();
  fireEvent.keyDown(screen.getByRole('tab', { name: /giveaway/i }), { key: 'ArrowLeft' });
  act(() => {
    jest.advanceTimersByTime(240);
  });
  expect(cr.panelActions.setTab).toHaveBeenCalledWith('redeem');
});

test('pending redemptions light the RED tally and pulse the Redeem LED while unseen', () => {
  const view = show({ redeem: { pending: 2, unseen: 1, capped: false } });
  expect(screen.getByText('RED 2').className).toMatch('is-on');
  const led = () => screen.getByRole('tab', { name: /redeem/i }).querySelector('.cr-tab-led');
  expect(led().className).toMatch('cr-led-pulse');
  cr = makeCr({ redeem: { pending: 2, unseen: 0, capped: false } });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  expect(led().className).toMatch('cr-led-on');
});

test('the pill counts pending redemptions next to its label', () => {
  show({ panel: { mode: 'pill' }, redeem: { pending: 2, unseen: 1, capped: false } });
  const pill = screen.getByRole('button', { name: 'Open control room. CONTROL ROOM. 2 redemptions pending' });
  expect(within(pill).getByText('RED 2').className).toMatch('is-pulse');
});

test('the options menu resets position and size', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Panel options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reset position and size' }));
  expect(cr.panelActions.resetPosition).toHaveBeenCalled();
});

const handle = (edge) => document.querySelector(`[data-cr-resize="${edge}"]`);
const panelEl = () => screen.getByRole('dialog', { name: 'Control room' });
const resizing = () => document.body.classList.contains('cr-resizing');

// jsdom is 1024×768, so a fresh panel floats at { x: 628, y: 73 }, 380 wide.
test('a floating panel has resize handles; the phone sheet has none', () => {
  const view = show();
  const edges = [...document.querySelectorAll('[data-cr-resize]')].map((el) => el.dataset.crResize).sort();
  expect(edges).toEqual(['b', 'bl', 'br', 'l', 'r']);
  view.unmount();
  useMediaQuery.mockReturnValue(true);
  show();
  expect(document.querySelectorAll('[data-cr-resize]')).toHaveLength(0);
});

test('dragging the left edge widens a top-right panel and keeps its right edge', () => {
  show();
  firePointer('pointerdown', handle('l'), { clientX: 628, clientY: 200 });
  firePointer('pointermove', handle('l'), { clientX: 528, clientY: 200 });
  expect(panelEl().style.width).toBe('480px');
  expect(panelEl().style.left).toBe('528px');
  expect(resizing()).toBe(true);
  expect(cr.panelActions.resizeTo).not.toHaveBeenCalled();
  firePointer('pointerup', handle('l'), { clientX: 528, clientY: 200 });
  expect(cr.panelActions.resizeTo).toHaveBeenCalledWith({ x: 528, y: 73 }, { w: 480, h: null });
  expect(resizing()).toBe(false);
});

test('the bottom-right grip sets width and height', () => {
  show({ panel: { rect: { x: 16, y: 73 } } });
  const grip = screen.getByRole('button', { name: 'Resize panel' });
  expect(grip.dataset.crResize).toBe('br');
  firePointer('pointerdown', grip, { clientX: 100, clientY: 100 });
  firePointer('pointerup', grip, { clientX: 140, clientY: 160 });
  expect(cr.panelActions.resizeTo).toHaveBeenCalledWith({ x: 16, y: 73 }, { w: 420, h: 480 });
});

test('a click on the grip without moving changes nothing', () => {
  show();
  const grip = screen.getByRole('button', { name: 'Resize panel' });
  firePointer('pointerdown', grip, { clientX: 300, clientY: 400 });
  firePointer('pointerup', grip, { clientX: 300, clientY: 400 });
  expect(cr.panelActions.resizeTo).not.toHaveBeenCalled();
});

test('the grip resizes from the keyboard', () => {
  show();
  const grip = screen.getByRole('button', { name: 'Resize panel' });
  expect(grip.dataset.crResize).toBe('bl');
  fireEvent.keyDown(grip, { key: 'ArrowLeft' });
  expect(cr.panelActions.resizeTo).toHaveBeenLastCalledWith({ x: 612, y: 73 }, { w: 396, h: null });
  fireEvent.keyDown(grip, { key: 'ArrowLeft', shiftKey: true });
  expect(cr.panelActions.resizeTo).toHaveBeenLastCalledWith({ x: 564, y: 73 }, { w: 444, h: null });
  fireEvent.keyDown(grip, { key: 'ArrowDown' });
  expect(cr.panelActions.resizeTo).toHaveBeenLastCalledWith({ x: 628, y: 73 }, { w: 380, h: 436 });
});

// Review Focus 3: a size saved on a bigger monitor fits this one.
test('a stored size comes back clamped to the window', () => {
  show({ panel: { size: { w: 700, h: 2000 } } });
  expect(panelEl().style.width).toBe('700px');
  expect(panelEl().style.height).toBe('695px');
  expect(panelEl().style.maxHeight).toBe('');
});

test('the dock edge resizes by keyboard and pointer, and the page follows on release', () => {
  const view = show({ panel: { mode: 'dock', restoreTo: 'dock', dockW: 400 } });
  const edge = screen.getByRole('separator', { name: 'Resize dock' });
  expect(edge.getAttribute('aria-valuenow')).toBe('400');
  fireEvent.keyDown(edge, { key: 'ArrowLeft' });
  expect(cr.panelActions.setDockW).toHaveBeenLastCalledWith(416);
  firePointer('pointerdown', edge, { clientX: 624, clientY: 300 });
  firePointer('pointermove', edge, { clientX: 524, clientY: 300 });
  expect(panelEl().style.width).toBe('500px');
  expect(document.documentElement.style.getPropertyValue('--control-dock-w')).toBe('400px');
  firePointer('pointerup', edge, { clientX: 524, clientY: 300 });
  expect(cr.panelActions.setDockW).toHaveBeenLastCalledWith(500);
  cr = makeCr({ panel: { mode: 'dock', restoreTo: 'dock', dockW: 500 } });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  expect(document.documentElement.style.getPropertyValue('--control-dock-w')).toBe('500px');
});

// Review Focus 3: the page padding uses the clamped dock width too.
test('a dock width saved on a wider monitor fits this one', () => {
  show({ panel: { mode: 'dock', restoreTo: 'dock', dockW: 720 } });
  expect(panelEl().style.width).toBe('544px');
  expect(document.documentElement.style.getPropertyValue('--control-dock-w')).toBe('544px');
});

// Review Focus 2: release outside the window, alt-tab, lost capture.
test('losing the pointer mid-resize commits nothing and puts the size back', () => {
  show();
  firePointer('pointerdown', handle('l'), { clientX: 628, clientY: 200 });
  firePointer('pointermove', handle('l'), { clientX: 528, clientY: 200 });
  firePointer('lostpointercapture', handle('l'));
  expect(panelEl().style.width).toBe('380px');
  expect(cr.panelActions.resizeTo).not.toHaveBeenCalled();
  expect(resizing()).toBe(false);
});

test('minimizing mid-resize drops the preview', () => {
  const view = show();
  firePointer('pointerdown', handle('l'), { clientX: 628, clientY: 200 });
  firePointer('pointermove', handle('l'), { clientX: 528, clientY: 200 });
  fireEvent.keyDown(window, { key: 'Escape' });
  act(() => {
    jest.advanceTimersByTime(320);
  });
  cr = makeCr({ panel: { mode: 'pill' } });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  cr = makeCr();
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  expect(panelEl().style.width).toBe('380px');
  expect(resizing()).toBe(false);
});

test('the grip keeps its corner while a drag carries the panel past the centre', () => {
  show({ panel: { rect: { x: 400, y: 73 } } });
  const grip = screen.getByRole('button', { name: 'Resize panel' });
  expect(grip.dataset.crResize).toBe('bl');
  firePointer('pointerdown', grip, { clientX: 400, clientY: 300 });
  firePointer('pointermove', grip, { clientX: 240, clientY: 300 });
  expect(document.body.contains(grip)).toBe(true);
  expect(grip.dataset.crResize).toBe('bl');
  firePointer('pointerup', grip, { clientX: 240, clientY: 300 });
  expect(cr.panelActions.resizeTo).toHaveBeenCalledWith({ x: 240, y: 73 }, { w: 540, h: 420 });
  expect(resizing()).toBe(false);
});

test('a focused grip stays put when the panel crosses the centre', () => {
  const view = show({ panel: { rect: { x: 400, y: 73 } } });
  const grip = screen.getByRole('button', { name: 'Resize panel' });
  act(() => grip.focus());
  cr = makeCr({ panel: { rect: { x: 240, y: 73 }, size: { w: 540, h: null } } });
  useControlRoom.mockReturnValue(cr);
  view.rerender(<ControlRoom isLive />);
  expect(document.activeElement).toBe(grip);
  expect(grip.dataset.crResize).toBe('bl');
  act(() => grip.blur());
  expect(screen.getByRole('button', { name: 'Resize panel' }).dataset.crResize).toBe('br');
});

test('a move with no button held ends the resize without committing', () => {
  show();
  firePointer('pointerdown', handle('l'), { clientX: 628, clientY: 200 });
  firePointer('pointermove', handle('l'), { clientX: 528, clientY: 200, buttons: 0 });
  expect(cr.panelActions.resizeTo).not.toHaveBeenCalled();
  expect(panelEl().style.width).toBe('380px');
  expect(resizing()).toBe(false);
});
