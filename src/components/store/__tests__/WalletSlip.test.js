import { act, fireEvent, render, screen, within } from '@testing-library/react';
import WalletSlip, { WalletDock } from '../WalletSlip';
import { lineup } from '../storeModel';

const [BLUNT, SLOT] = lineup([
  { id: 'blunt', name: 'Roll a blunt', cost: 420, kind: 'stream', stock: null, sortOrder: 0 },
  { id: 'slot', name: 'Pick a Slot', cost: 1500, kind: 'stream', stock: 0, sortOrder: 0 },
]);
const VIEWER = { twitchId: 'v1', displayName: 'GooferFan' };

function props(tickets, extra = {}) {
  const user = tickets == null ? null : { tickets };
  return {
    viewer: VIEWER,
    user,
    userLoading: false,
    item: BLUNT,
    balance: user ? user.tickets : null,
    ordering: false,
    onSignIn: jest.fn(),
    onOrder: jest.fn(),
    onEarn: jest.fn(),
    onHoldStart: jest.fn(),
    tear: null,
    ...extra,
  };
}

afterEach(() => {
  jest.useRealTimers();
});

test('can afford: receipt maths and the hold button', () => {
  render(<WalletSlip {...props(1080)} />);
  const slip = screen.getByRole('region', { name: 'Your wallet' });
  expect(within(slip).getByText('1,080', { selector: 'dd' })).toBeTruthy();
  expect(within(slip).getByText('−420')).toBeTruthy();
  expect(within(slip).getByText('660')).toBeTruthy();
  expect(within(slip).getByRole('button', { name: 'Hold to order' })).toBeTruthy();
});

test('short: how far off, the estimate and a way to earn', () => {
  const p = props(100);
  render(<WalletSlip {...p} />);
  expect(screen.getByText('320 short')).toBeTruthy();
  expect(screen.getByText('About 27 h of hanging out in chat (less if you talk)')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ways to earn' }));
  expect(p.onEarn).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Hold to order' })).toBeNull();
});

test('sold out disables ordering', () => {
  render(<WalletSlip {...props(9000, { item: SLOT })} />);
  expect(screen.getByRole('button', { name: 'Sold out' }).disabled).toBe(true);
});

test('signed out offers Twitch sign-in', () => {
  const p = props(null, { viewer: null });
  render(<WalletSlip {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Twitch' }));
  expect(p.onSignIn).toHaveBeenCalled();
});

// Review Focus 4: no "isn't set up" flash while the user doc loads.
test('loading the wallet shows neither the setup warning nor a hold button', () => {
  render(<WalletSlip {...props(null, { userLoading: true })} />);
  expect(screen.getByText('Opening your wallet…')).toBeTruthy();
  expect(screen.queryByText(/isn't set up/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Hold to order' })).toBeNull();
});

// Found in the browser: the empty-shelf line flashed on every load.
test('while the catalogue loads the wallet tunes in instead of claiming the shelf is empty', () => {
  render(<WalletSlip {...props(1080, { item: null, itemsLoading: true })} />);
  expect(screen.getByText('Tuning in…')).toBeTruthy();
  expect(screen.queryByText('Nothing to order right now.')).toBeNull();
});

test('a missing user doc explains how to fix it', () => {
  render(<WalletSlip {...props(null)} />);
  expect(screen.getByText("Your wallet isn't set up yet. Sign out and back in.")).toBeTruthy();
});

// Review Focus 1: a payout or another tab changes the balance mid-hold.
test('a balance drop mid-hold cancels the hold and switches to short', () => {
  jest.useFakeTimers();
  const p = props(2000);
  const { rerender } = render(<WalletSlip {...p} />);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Hold to order' }));
  rerender(<WalletSlip {...p} user={{ tickets: 100 }} balance={100} />);
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  expect(p.onOrder).not.toHaveBeenCalled();
  expect(screen.getByText('320 short')).toBeTruthy();
});

test('a two-step order calls onOrder with the item', () => {
  const p = props(1080);
  render(<WalletSlip {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Hold to order' }));
  fireEvent.click(screen.getByRole('button', { name: 'Press again to spend 420' }));
  expect(p.onOrder).toHaveBeenCalledWith(BLUNT);
});

test('ordering disables the button', () => {
  render(<WalletSlip {...props(1080, { ordering: true })} />);
  expect(screen.getByRole('button', { name: 'Calling it in…' }).disabled).toBe(true);
});

test('a received order tears off a stub showing what was spent', () => {
  render(<WalletSlip {...props(660, { tear: { key: 'r1', amount: 420 } })} />);
  const ghost = screen.getByTestId('tear-ghost');
  expect(ghost.textContent).toBe('−420');
  expect(ghost.getAttribute('aria-hidden')).toBe('true');
});

// Found in the browser: a background tab may never run the tear animation, so
// animationend never fires; the stub must still clear instead of covering the button.
test('the torn stub clears itself even if the animation never runs', () => {
  jest.useFakeTimers();
  render(<WalletSlip {...props(660, { tear: { key: 'r1', amount: 420 } })} />);
  expect(screen.getByTestId('tear-ghost')).toBeTruthy();
  act(() => {
    jest.advanceTimersByTime(700);
  });
  expect(screen.queryByTestId('tear-ghost')).toBeNull();
});

// Final review: an armed press must never carry over to another item.
const [ZAP] = lineup([{ id: 'zap', name: 'Zap', cost: 100, kind: 'stream', stock: null, sortOrder: 0 }]);

test('arming on one item never lets a single press order a different one', () => {
  const p = props(5000);
  const { rerender } = render(<WalletSlip {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Hold to order' }));
  expect(screen.getByRole('button', { name: 'Press again to spend 420' })).toBeTruthy();
  rerender(<WalletSlip {...p} item={ZAP} />);
  fireEvent.click(screen.getByRole('button', { name: 'Hold to order' }));
  expect(p.onOrder).not.toHaveBeenCalled();
});

test('the dock never carries an armed press over to another item', () => {
  const p = props(5000);
  const { rerender } = render(<WalletDock {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Hold to order · 420' }));
  rerender(<WalletDock {...p} item={ZAP} />);
  fireEvent.click(screen.getByRole('button', { name: 'Hold to order · 100' }));
  expect(p.onOrder).not.toHaveBeenCalled();
});

test('the dock carries the balance and the hold-to-order action', () => {
  render(<WalletDock {...props(1080)} />);
  expect(screen.getByRole('button', { name: 'Hold to order · 420' })).toBeTruthy();
  expect(screen.getByText('1,080')).toBeTruthy();
});

test('the dock shows the shortfall with a way to earn', () => {
  render(<WalletDock {...props(100)} />);
  expect(screen.getByText('320 short')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ways to earn' })).toBeTruthy();
});
