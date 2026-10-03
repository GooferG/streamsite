import { fireEvent, render, screen } from '@testing-library/react';
import StoreMonitor from '../StoreMonitor';
import { lineup } from '../storeModel';

const [BLUNT, SLOT] = lineup([
  { id: 'blunt', name: 'Roll a blunt', description: 'Watch Goofer roll a perfect one.', cost: 420, kind: 'stream', stock: null, sortOrder: 0 },
  { id: 'slot', name: 'Pick a Slot', cost: 1500, kind: 'virtual', stock: 5, sortOrder: 0 },
]);
const TICKER = [{ key: 'standby', text: 'Operators are standing by' }];

function renderMonitor(props = {}) {
  const handlers = { onPrev: jest.fn(), onNext: jest.fn(), onBack: jest.fn() };
  render(
    <StoreMonitor
      mode="item"
      item={BLUNT}
      position={{ index: 0, count: 2 }}
      order={{ phase: 'idle' }}
      isLive={false}
      ticker={TICKER}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

test('the item channel shows name, price, chips and position', () => {
  renderMonitor();
  expect(screen.getByRole('region', { name: 'Store monitor' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Roll a blunt' })).toBeTruthy();
  expect(screen.getByText('420')).toBeTruthy();
  expect(screen.getByText('Played on stream')).toBeTruthy();
  expect(screen.getByText('Unlimited')).toBeTruthy();
  expect(screen.getByText('1 of 2')).toBeTruthy();
  expect(screen.getByText('CH 01 · Now selling')).toBeTruthy();
});

test('previous and next are real buttons; one item has none', () => {
  const { onNext, onPrev } = renderMonitor();
  fireEvent.click(screen.getByRole('button', { name: 'Next item' }));
  fireEvent.click(screen.getByRole('button', { name: 'Previous item' }));
  expect(onNext).toHaveBeenCalledTimes(1);
  expect(onPrev).toHaveBeenCalledTimes(1);
});

test('a single item hides the controls', () => {
  renderMonitor({ item: SLOT, position: { index: 0, count: 1 } });
  expect(screen.queryByRole('button', { name: 'Next item' })).toBeNull();
  expect(screen.getByText('Instant')).toBeTruthy();
  expect(screen.getByText('5 left')).toBeTruthy();
});

test.each([
  ['loading', 'Tuning in…'],
  ['empty', 'Off the air. Nothing on the shelf yet.'],
  ['error', 'Signal lost. Try again in a bit.'],
])('the %s ident', (mode, line) => {
  renderMonitor({ mode, item: null, position: { index: 0, count: 0 } });
  expect(screen.getByText(line)).toBeTruthy();
});

test('received shows the order number; pending reads as on the list, fulfilled as granted', () => {
  renderMonitor({ mode: 'received', order: { phase: 'received', item: BLUNT, orderId: 'abcdR7Q2', status: 'pending' } });
  expect(screen.getByText('Order #R7Q2')).toBeTruthy();
  expect(screen.getByText("You're on the list.")).toBeTruthy();
});

test('an instant order reads as granted', () => {
  renderMonitor({ mode: 'received', order: { phase: 'received', item: SLOT, orderId: 'zzzz0001', status: 'fulfilled' } });
  expect(screen.getByText('Granted.')).toBeTruthy();
});

test('calling shows the line connecting', () => {
  renderMonitor({ mode: 'calling', order: { phase: 'calling', item: BLUNT } });
  expect(screen.getByText('Line 1 · connecting…')).toBeTruthy();
});

test('busy explains, reassures and offers a way back', () => {
  const { onBack } = renderMonitor({ mode: 'busy', order: { phase: 'busy', item: BLUNT, message: 'Not enough tickets.' } });
  expect(screen.getByText('Not enough tickets.')).toBeTruthy();
  expect(screen.getByText('No tickets were spent.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back to the lineup' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('your own order reads as "you" in viewer purple on the chyron', () => {
  renderMonitor({ ticker: [{ key: 'order-a', you: true, who: null, what: 'Pick a Slot' }, ...TICKER] });
  expect(screen.getAllByText('you')[0].className).toContain('text-onair-viewer-light');
});

test('the LIVE light shows while the channel is live', () => {
  renderMonitor({ isLive: true });
  expect(screen.getByText('Live')).toBeTruthy();
});
