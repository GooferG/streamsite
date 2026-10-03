import { fireEvent, render, screen, within } from '@testing-library/react';
import HuntLineup from '../HuntLineup';

const NOW = 100 * 60 * 1000;
const at = (min) => ({ toMillis: () => NOW - min * 60 * 1000 });
const entry = (id, payoutGuess, min, extra = {}) => ({ id, twitchId: id, displayName: id, payoutGuess, submittedAt: at(min), ...extra });
const ENTRIES = [
  entry('skillsytv', 1855, 12),
  entry('G4KUR4', 3663, 9),
  entry('GRUMPZILLA12', 3100, 7),
  entry('RYGARTEARROW', 2777, 5),
  entry('Xilentdrifter', 2122, 3),
  entry('JESSEJEK', 3333, 1),
];

function renderLineup(props) {
  return render(<HuntLineup currency={null} myId={null} myEntry={null} now={NOW} entries={[]} round={{}} {...props} />);
}

test('sealed: your row, eight face-down rows and the rest counted', () => {
  renderLineup({
    mode: 'open',
    sealed: true,
    round: { entryCount: 37 },
    myId: 'me',
    myEntry: entry('me', 2450, 0, { displayName: 'vonbrandt' }),
  });
  expect(screen.getByRole('heading', { name: 'Guesses so far' })).toBeTruthy();
  expect(screen.getByText('Sealed until entries close')).toBeTruthy();
  expect(screen.getByText('(you)')).toBeTruthy();
  expect(screen.getByText('$2,450')).toBeTruthy();
  expect(screen.getAllByTestId('face-down-row')).toHaveLength(8);
  expect(screen.getByText('+28 more sealed')).toBeTruthy();
});

test('sealed with no guesses invites the first one', () => {
  renderLineup({ mode: 'open', sealed: true, round: { entryCount: 0 } });
  expect(screen.getByText('No guesses yet. Be the first on the board.')).toBeTruthy();
});

test('locked: revealed low to high with time ago', () => {
  renderLineup({ mode: 'locked', sealed: false, entries: ENTRIES });
  const rows = screen.getAllByRole('listitem');
  expect(within(rows[0]).getByText('skillsytv')).toBeTruthy();
  expect(within(rows[0]).getAllByText('12m ago').length).toBeGreaterThan(0);
  expect(within(rows[5]).getByText('G4KUR4')).toBeTruthy();
  expect(screen.getByText('Low to high')).toBeTruthy();
});

test('settled: closest first, the winner row lit, offsets signed', () => {
  renderLineup({
    mode: 'settled',
    sealed: false,
    entries: ENTRIES,
    round: { status: 'settled', actual: { payout: 2046.12 }, winners: [{ place: 1, twitchId: 'Xilentdrifter' }] },
  });
  expect(screen.getByRole('heading', { name: "Tonight's lineup" })).toBeTruthy();
  const rows = screen.getAllByRole('listitem');
  expect(rows[0].getAttribute('data-lit')).toBe('winner');
  expect(within(rows[0]).getByText('Xilentdrifter')).toBeTruthy();
  expect(within(rows[0]).getAllByText('+$76').length).toBeGreaterThan(0);
  expect(within(rows[1]).getAllByText('−$191').length).toBeGreaterThan(0);
});

// Review Focus 5: the viewer's own winning row shows winner styling and "(you)".
test('the winner who is also you keeps the winner light', () => {
  renderLineup({
    mode: 'settled',
    sealed: false,
    entries: ENTRIES,
    myId: 'Xilentdrifter',
    round: { status: 'settled', actual: { payout: 2046.12 }, winners: [{ place: 1, twitchId: 'Xilentdrifter' }] },
  });
  const first = screen.getAllByRole('listitem')[0];
  expect(first.getAttribute('data-lit')).toBe('winner');
  expect(within(first).getByText('(you)')).toBeTruthy();
});

test('long lists show ten, pin you, and expand in place', () => {
  const many = Array.from({ length: 14 }, (_, i) => entry(`v${i}`, 1000 + i, i));
  renderLineup({ mode: 'locked', sealed: false, entries: [...many, entry('me', 9999, 0)], myId: 'me' });
  expect(screen.getByText('Your spot')).toBeTruthy();
  const toggle = screen.getByRole('button', { name: 'Show all 15' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle);
  expect(screen.getAllByRole('listitem')).toHaveLength(15);
  expect(screen.queryByText('Your spot')).toBeNull();
  expect(screen.getByRole('button', { name: 'Show fewer' })).toBeTruthy();
});

// Review Focus 1 and 3: huge ARS figures and malformed entries.
test('ARS millions, missing names and broken avatars render cleanly', () => {
  const { container } = renderLineup({
    mode: 'locked',
    sealed: false,
    currency: 'ARS',
    entries: [
      { id: 'a', twitchId: 'a', twitchName: 'tn_only', payoutGuess: 1850000, profileImageUrl: 'https://img/a.png', submittedAt: at(1) },
      { id: 'b', twitchId: 'b', payoutGuess: 2100000, submittedAt: at(2) },
      { id: 'c', twitchId: 'c', displayName: 'no guess' },
    ],
  });
  expect(screen.getByText('tn_only')).toBeTruthy();
  expect(screen.getByText('Viewer')).toBeTruthy();
  expect(screen.queryByText('no guess')).toBeNull();
  expect(screen.getByText(/1,850,000/)).toBeTruthy();
  fireEvent.error(container.querySelector('img'));
  expect(screen.getByText('T')).toBeTruthy();
  expect(container.textContent).not.toMatch(/NaN/);
});
