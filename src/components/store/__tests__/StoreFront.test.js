import { fireEvent, render, screen, within } from '@testing-library/react';
import StoreFront from '../StoreFront';
import { STORE_FIXTURES } from '../storeFixtures';

const monitor = () => screen.getByRole('region', { name: 'Store monitor' });
const slip = () => screen.getByRole('region', { name: 'Your wallet' });

test.each(Object.keys(STORE_FIXTURES))('the %s fixture renders cleanly', (key) => {
  const { container } = render(<StoreFront {...STORE_FIXTURES[key]} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Operators are standing by.' })).toBeTruthy();
  expect(container.textContent).not.toMatch(/NaN|undefined|Infinity/);
});

test('signed out: sign-in prompts, no hold buttons, no orders panel', () => {
  render(<StoreFront {...STORE_FIXTURES.signedout} />);
  expect(screen.getAllByRole('button', { name: 'Sign in with Twitch' }).length).toBeGreaterThan(0);
  expect(screen.queryAllByRole('button', { name: /Hold to order/ })).toHaveLength(0);
  expect(screen.queryByRole('region', { name: 'On the list' })).toBeNull();
});

test('short: the wallet says how far off and how long it takes', () => {
  render(<StoreFront {...STORE_FIXTURES.short} />);
  expect(within(slip()).getByText('420 short')).toBeTruthy();
  expect(within(slip()).getByText('About 35 h of hanging out in chat (less if you talk)')).toBeTruthy();
  expect(within(slip()).queryByRole('button', { name: /Hold to order/ })).toBeNull();
});

test('sold out: the tuned item cannot be ordered', () => {
  render(<StoreFront {...STORE_FIXTURES.soldout} />);
  expect(within(slip()).getByRole('button', { name: 'Sold out' }).disabled).toBe(true);
});

test('received: bumper, order number and a spoken confirmation', () => {
  render(<StoreFront {...STORE_FIXTURES.received} />);
  expect(within(monitor()).getByText('Order #R7Q2')).toBeTruthy();
  expect(within(monitor()).getByText("You're on the list.")).toBeTruthy();
  expect(screen.getByText(/^Order in: Roll a blunt, order R7Q2\./)).toBeTruthy();
});

test('busy: the error, the reassurance and a way back', () => {
  const onResetOrder = jest.fn();
  render(<StoreFront {...STORE_FIXTURES.busy} onResetOrder={onResetOrder} />);
  expect(within(monitor()).getByText('Not enough tickets.')).toBeTruthy();
  expect(within(monitor()).getByText('No tickets were spent.')).toBeTruthy();
  expect(screen.getByText('Not enough tickets. No tickets were spent.')).toBeTruthy();
  fireEvent.click(within(monitor()).getByRole('button', { name: 'Back to the lineup' }));
  expect(onResetOrder).toHaveBeenCalled();
});

// Final review: a dropped line may have committed the order.
test('unsure: no false reassurance, and a pointer to the orders list', () => {
  render(<StoreFront {...STORE_FIXTURES.unsure} />);
  expect(within(monitor()).getByText('The line dropped before we heard back.')).toBeTruthy();
  expect(screen.queryByText(/No tickets were spent/)).toBeNull();
  expect(screen.getByText('The line dropped before we heard back. Check On the list before you try again.')).toBeTruthy();
});

test('tuning from the lineup changes the monitor and reports the item', () => {
  const onTuneChange = jest.fn();
  render(<StoreFront {...STORE_FIXTURES.rich} onTuneChange={onTuneChange} />);
  expect(within(monitor()).getByRole('heading', { name: 'Roll a blunt' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^Pick a Slot, 1,500 tickets/ }));
  expect(within(monitor()).getByRole('heading', { name: 'Pick a Slot' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Pick a Slot, 1,500 tickets/ }).getAttribute('aria-pressed')).toBe('true');
  expect(onTuneChange).toHaveBeenCalledWith('slot');
});

test('previous and next cycle through the lineup', () => {
  render(<StoreFront {...STORE_FIXTURES.rich} />);
  fireEvent.click(within(monitor()).getByRole('button', { name: 'Previous item' }));
  expect(within(monitor()).getByRole('heading', { name: '$ARS 10,000 Bonus Buy' })).toBeTruthy();
  fireEvent.click(within(monitor()).getByRole('button', { name: 'Next item' }));
  expect(within(monitor()).getByRole('heading', { name: 'Roll a blunt' })).toBeTruthy();
});

test('arrow keys flip channels while focus is in the monitor', () => {
  render(<StoreFront {...STORE_FIXTURES.rich} />);
  fireEvent.keyDown(within(monitor()).getByRole('button', { name: 'Next item' }), { key: 'ArrowRight' });
  expect(within(monitor()).getByRole('heading', { name: 'Pick a Slot' })).toBeTruthy();
});

// Review Focus 3: a deep link to an id that isn't (or is no longer) in the catalogue.
test('a deep link tunes to its item; an unknown id falls back to the first', () => {
  const { unmount } = render(<StoreFront {...STORE_FIXTURES.rich} initialItemId="slot" />);
  expect(within(monitor()).getByRole('heading', { name: 'Pick a Slot' })).toBeTruthy();
  unmount();
  render(<StoreFront {...STORE_FIXTURES.rich} initialItemId="gone" />);
  expect(within(monitor()).getByRole('heading', { name: 'Roll a blunt' })).toBeTruthy();
});

// Review Focus 2: an admin deactivates the tuned item, then empties the shelf.
test('if the tuned item leaves the catalogue the monitor falls back, then shows the empty ident', () => {
  const { rerender } = render(<StoreFront {...STORE_FIXTURES.rich} initialItemId="slot" />);
  const without = STORE_FIXTURES.rich.items.filter((i) => i.id !== 'slot');
  rerender(<StoreFront {...STORE_FIXTURES.rich} items={without} initialItemId="slot" />);
  expect(within(monitor()).getByRole('heading', { name: 'Roll a blunt' })).toBeTruthy();
  rerender(<StoreFront {...STORE_FIXTURES.rich} items={[]} />);
  expect(screen.getByText('Off the air. Nothing on the shelf yet.')).toBeTruthy();
});

test('two presses on the wallet button place exactly one order for the tuned item', () => {
  const onOrder = jest.fn();
  render(<StoreFront {...STORE_FIXTURES.rich} onOrder={onOrder} />);
  fireEvent.click(within(slip()).getByRole('button', { name: 'Hold to order' }));
  expect(onOrder).not.toHaveBeenCalled();
  fireEvent.click(within(slip()).getByRole('button', { name: 'Press again to spend 420' }));
  expect(onOrder).toHaveBeenCalledTimes(1);
  expect(onOrder.mock.calls[0][0].id).toBe('blunt');
});
