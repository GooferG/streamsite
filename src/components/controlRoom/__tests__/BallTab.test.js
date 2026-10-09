import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BallTab from '../BallTab';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { ballAction } from '../ballApi';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../ballApi', () => ({ ...jest.requireActual('../ballApi'), ballAction: jest.fn() }));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));
jest.mock('../BallPayout', () => () => require('react').createElement('p', null, 'payout table'));
jest.mock('../HuntLink', () => () => require('react').createElement('p', null, 'hunt link'));

const at = (ms) => ({ toMillis: () => ms });
const OPEN = {
  id: 'r1',
  status: 'open',
  prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
  rack: [{ drawNo: 1, twitchId: 'a', displayName: 'CoolGuy', slotName: 'Gates of Olympus', drawnAt: at(1), scratched: false }],
  lastDrawAt: at(Date.now() - 60_000),
  huntId: null,
};
const BALLS = [
  { id: 'a', status: 'drawn', slotName: 'Gates of Olympus', displayName: 'CoolGuy', enteredAt: at(1) },
  { id: 'b', status: 'drum', slotName: 'Sugar Rush', displayName: 'SugarFan', enteredAt: at(3) },
  { id: 'c', status: 'drum', slotName: 'The Dog House', displayName: 'Pupper', enteredAt: at(2) },
];
const QUIET = { error: null, retry: jest.fn() };

function show(cr) {
  useControlRoom.mockReturnValue({
    ballRound: null,
    balls: [],
    giveaway: null,
    ballDrawAnnounce: QUIET,
    ballResults: { posted: false, posting: false, error: null, retry: jest.fn() },
    ...cr,
  });
  return render(<BallTab />);
}

beforeEach(() => {
  ballAction.mockResolvedValue({ ok: true, status: 200, data: { ok: true } });
});

test('idle: open the drum with the prize from the form', async () => {
  show({});
  expect(screen.getByText('No drum open.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Tickets'), { target: { value: '300' } });
  fireEvent.change(screen.getByLabelText('Dollar prize'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Prize kind'), { target: { value: 'bonus' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open the drum' }));
  await waitFor(() =>
    expect(ballAction).toHaveBeenCalledWith({ action: 'open', prize: { tickets: 300, prize: { kind: 'bonus', amount: 5 } }, requireFollow: true })
  );
});

test('the open form pre-fills from the last round', () => {
  show({ ballRound: { id: 'old', status: 'cancelled', prize: { tickets: 75, prize: null } } });
  expect(screen.getByLabelText('Tickets').value).toBe('75');
  expect(screen.getByLabelText('Dollar prize').value).toBe('');
});

test('open: counts, prize, rack, just-in, and Draw', async () => {
  show({ ballRound: OPEN, balls: BALLS });
  expect(screen.getByText('OPEN')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByText('200 tickets + $5')).toBeTruthy();
  expect(screen.getByText('Gates of Olympus')).toBeTruthy();
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toContain('SugarFanSugar Rush');
  fireEvent.click(screen.getByRole('button', { name: 'Draw ball' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'draw', id: 'r1' }));
});

test('Draw waits while a ball or a giveaway reveal is on screen', () => {
  const { unmount } = show({ ballRound: { ...OPEN, lastDrawAt: at(Date.now() - 1000) }, balls: BALLS });
  expect(screen.getByRole('button', { name: 'Ball on screen…' }).disabled).toBe(true);
  unmount();
  show({ ballRound: OPEN, balls: BALLS, giveaway: { status: 'rolling', rolledAt: at(Date.now() - 1000) } });
  expect(screen.getByRole('button', { name: 'Giveaway on screen…' }).disabled).toBe(true);
});

test('scratch and close are two-press', async () => {
  show({ ballRound: OPEN, balls: BALLS });
  fireEvent.click(screen.getByRole('button', { name: 'Scratch' }));
  expect(ballAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm scratch' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'scratch', id: 'r1', drawNo: 1 }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Close lineup' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Close lineup' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm close' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'close', id: 'r1' }));
});

test('edit the prize inline', async () => {
  show({ ballRound: OPEN, balls: BALLS });
  fireEvent.click(screen.getByRole('button', { name: 'Edit prize' }));
  fireEvent.change(screen.getByLabelText('Tickets'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save prize' }));
  await waitFor(() =>
    expect(ballAction).toHaveBeenCalledWith({ action: 'update_prize', id: 'r1', prize: { tickets: 500, prize: { kind: 'cash', amount: 5 } } })
  );
});

test('server errors show in words', async () => {
  ballAction.mockResolvedValue({ ok: false, status: 400, data: { error: 'EMPTY_DRUM' } });
  show({ ballRound: OPEN, balls: BALLS });
  fireEvent.click(screen.getByRole('button', { name: 'Draw ball' }));
  expect(await screen.findByText('Nobody in the drum.')).toBeTruthy();
});

test('closed: the payout table, Reopen and two-press Cancel', async () => {
  show({ ballRound: { ...OPEN, status: 'closed' }, balls: BALLS });
  expect(screen.getByText('payout table')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Draw ball' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'reopen', id: 'r1' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel round' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel round' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel' }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'cancel', id: 'r1' }));
});

test('a failed draw line offers Retry', () => {
  const retry = jest.fn();
  show({ ballRound: OPEN, balls: BALLS, ballDrawAnnounce: { error: 'CHAT_DROPPED:x', retry } });
  fireEvent.click(screen.getByRole('button', { name: 'Retry chat line' }));
  expect(retry).toHaveBeenCalled();
});
