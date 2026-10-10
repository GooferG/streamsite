import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BallPayout from '../BallPayout';
import HuntLink from '../HuntLink';
import { ballAction } from '../ballApi';
import useBallHunt from '../../../hooks/useBallHunt';
import useCommunityHunts from '../../../hooks/useCommunityHunts';

jest.mock('../ballApi', () => ({ ...jest.requireActual('../ballApi'), ballAction: jest.fn() }));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));
jest.mock('../../../hooks/useBallHunt', () => jest.fn());
jest.mock('../../../hooks/useCommunityHunts', () => jest.fn());

const at = (ms) => ({ toMillis: () => ms });
const ROUND = {
  id: 'r1',
  status: 'closed',
  huntId: 'h1',
  prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
  rack: [
    { drawNo: 1, twitchId: 'a', displayName: 'CoolGuy', slotName: 'Gates of Olympus', drawnAt: at(1), scratched: false },
    { drawNo: 2, twitchId: 'b', displayName: 'SugarFan', slotName: 'Sugar Rush 1000', drawnAt: at(2), scratched: false },
  ],
};
const PREVIEW = {
  ok: true,
  status: 200,
  data: { ok: true, winner: { drawNo: 1, displayName: 'CoolGuy', slotName: 'Gates of Olympus', multiplier: 412 }, huntError: null },
};

beforeEach(() => {
  useBallHunt.mockReturnValue({
    hunt: { bonuses: [{ slot: 'Gates of Olympus', multiplier: 412, win: 412, bet: 1 }, { slot: 'Sugar Rush 1000', multiplier: null, win: null }] },
    stale: false,
    loading: false,
  });
  useCommunityHunts.mockReturnValue({ live: { id: 'h9', status: 'live', bonusCount: 10, startedAt: '2026-10-09T01:00:00Z' }, recent: [], loading: false, error: null });
  ballAction.mockResolvedValue({ ok: true, status: 200, data: { ok: true } });
});

async function previewAndArm() {
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  await screen.findByText('@CoolGuy · Gates of Olympus · 412x wins 200 tickets + $5');
}

test('rows show hunt results; a pending row takes a typed multiplier', async () => {
  render(<BallPayout round={ROUND} />);
  expect(screen.getByText('412x')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Multiplier for ball 2'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  await waitFor(() =>
    expect(ballAction).toHaveBeenCalledWith({ action: 'preview_settle', id: 'r1', overrides: { 2: { multiplier: '500', win: '', bonusIndex: null } } })
  );
});

test('preview names the winner; pay out sends the same overrides and the previewed winner', async () => {
  ballAction.mockResolvedValueOnce(PREVIEW);
  render(<BallPayout round={ROUND} />);
  await previewAndArm();
  fireEvent.click(screen.getByRole('button', { name: 'Hold to pay out' }));
  fireEvent.click(screen.getByRole('button', { name: 'Press again to pay out' }));
  await waitFor(() => expect(ballAction).toHaveBeenLastCalledWith({ action: 'settle', id: 'r1', overrides: {}, expectDrawNo: 1 }));
});

test.each(['WINNER_CHANGED', 'HUNT_CHANGED'])('%s clears the preview so staff must preview again', async (code) => {
  ballAction.mockResolvedValueOnce(PREVIEW);
  ballAction.mockResolvedValueOnce({ ok: false, status: 409, data: { error: code } });
  render(<BallPayout round={ROUND} />);
  await previewAndArm();
  fireEvent.click(screen.getByRole('button', { name: 'Hold to pay out' }));
  fireEvent.click(screen.getByRole('button', { name: 'Press again to pay out' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: /pay out/i })).toBeNull());
  expect(screen.getByText(/Preview again\./)).toBeTruthy();
});

test('no linked hunt: everything is typed', () => {
  useBallHunt.mockReturnValue({ hunt: null, stale: false, loading: false });
  render(<BallPayout round={{ ...ROUND, huntId: null }} />);
  expect(screen.getByLabelText('Multiplier for ball 1')).toBeTruthy();
  expect(screen.getByText('No hunt linked: type each multiplier.')).toBeTruthy();
});

test('HuntLink: pick the live hunt, or unlink', async () => {
  const { rerender } = render(<HuntLink round={{ ...ROUND, huntId: null }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Link hunt' }));
  fireEvent.click(screen.getByRole('button', { name: /LIVE · 10 bonuses/ }));
  await waitFor(() => expect(ballAction).toHaveBeenCalledWith({ action: 'link_hunt', id: 'r1', huntId: 'h9' }));
  rerender(<HuntLink round={ROUND} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Unlink' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
  await waitFor(() => expect(ballAction).toHaveBeenLastCalledWith({ action: 'link_hunt', id: 'r1', huntId: null }));
});

test('a hunt row can be overridden with Edit', async () => {
  render(<BallPayout round={ROUND} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit ball 1' }));
  const input = screen.getByLabelText('Multiplier for ball 1');
  expect(input.value).toBe('412');
  fireEvent.change(input, { target: { value: '600' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  await waitFor(() =>
    expect(ballAction).toHaveBeenCalledWith({ action: 'preview_settle', id: 'r1', overrides: { 1: { multiplier: '600', win: '412', bonusIndex: null } } })
  );
});

test('an unparseable multiplier is flagged and blocks Preview', () => {
  render(<BallPayout round={ROUND} />);
  const input = screen.getByLabelText('Multiplier for ball 2');
  fireEvent.change(input, { target: { value: '1,250' } });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('Not a number')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Preview' }).disabled).toBe(true);
  fireEvent.change(input, { target: { value: '   ' } });
  expect(screen.getByRole('button', { name: 'Preview' }).disabled).toBe(false);
});

test('rows show win and bet; unmatched and unopened rows are told apart', () => {
  const { unmount } = render(<BallPayout round={ROUND} />);
  expect(screen.getByText('win 412 · bet 1')).toBeTruthy();
  expect(screen.getByText('Not opened yet')).toBeTruthy();
  expect(screen.getByLabelText('Win for ball 2')).toBeTruthy();
  unmount();
  useBallHunt.mockReturnValue({ hunt: { bonuses: [{ slot: 'Gates of Olympus', multiplier: 412, win: 412 }] }, stale: false, loading: false });
  render(<BallPayout round={ROUND} />);
  expect(screen.getByText('No hunt row: type it')).toBeTruthy();
  expect(screen.queryByText('Not opened yet')).toBeNull();
});

test('a duplicate hunt row can be picked', async () => {
  useBallHunt.mockReturnValue({
    hunt: { bonuses: [{ slot: 'Gates of Olympus', multiplier: 412, win: 412 }, { slot: 'Gates of Olympus', multiplier: 90, win: 90 }] },
    stale: false,
    loading: false,
  });
  render(<BallPayout round={ROUND} />);
  expect(screen.getByRole('option', { name: 'Hunt row 2 · 90x · win 90' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Hunt row for ball 1'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  await waitFor(() =>
    expect(ballAction).toHaveBeenCalledWith({ action: 'preview_settle', id: 'r1', overrides: { 1: { multiplier: '', win: '', bonusIndex: 1 } } })
  );
});

test('hunt outage: the message shows and typed numbers still pay out', async () => {
  useBallHunt.mockReturnValue({ hunt: null, stale: true, loading: false });
  ballAction.mockResolvedValueOnce({ ...PREVIEW, data: { ...PREVIEW.data, huntError: 'COMMUNITYHUNTS_UNAVAILABLE' } });
  render(<BallPayout round={ROUND} />);
  fireEvent.change(screen.getByLabelText('Multiplier for ball 1'), { target: { value: '412' } });
  fireEvent.change(screen.getByLabelText('Multiplier for ball 2'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  expect(await screen.findByText('Hunt unavailable (COMMUNITYHUNTS_UNAVAILABLE). Type every multiplier to pay out.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Hold to pay out' }));
  fireEvent.click(screen.getByRole('button', { name: 'Press again to pay out' }));
  await waitFor(() =>
    expect(ballAction).toHaveBeenLastCalledWith({
      action: 'settle',
      id: 'r1',
      overrides: { 1: { multiplier: '412', win: '', bonusIndex: null }, 2: { multiplier: '10', win: '', bonusIndex: null } },
      expectDrawNo: 1,
    })
  );
});

test('a preview that returns after an edit is dropped', async () => {
  let release;
  ballAction.mockReturnValueOnce(new Promise((res) => { release = res; }));
  render(<BallPayout round={ROUND} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  fireEvent.change(screen.getByLabelText('Multiplier for ball 2'), { target: { value: '9' } });
  release(PREVIEW);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' }).disabled).toBe(false));
  expect(screen.queryByText(/wins 200 tickets/)).toBeNull();
});

test('HuntLink: says so when there are no hunts', () => {
  useCommunityHunts.mockReturnValue({ live: null, recent: [], loading: false, error: null });
  render(<HuntLink round={{ ...ROUND, huntId: null }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Link hunt' }));
  expect(screen.getByText('No hunts yet.')).toBeTruthy();
});

test('relinking a hunt clears typed edits and the picked hunt row', () => {
  const { rerender } = render(<BallPayout round={ROUND} />);
  fireEvent.change(screen.getByLabelText('Multiplier for ball 2'), { target: { value: '9' } });
  expect(screen.getByLabelText('Multiplier for ball 2').value).toBe('9');
  rerender(<BallPayout round={{ ...ROUND, huntId: 'h2' }} />);
  expect(screen.getByLabelText('Multiplier for ball 2').value).toBe('');
});

test('an invalid value behind a row that shows the hunt number no longer locks Preview', () => {
  render(<BallPayout round={ROUND} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit ball 1' }));
  fireEvent.change(screen.getByLabelText('Win for ball 1'), { target: { value: 'abc' } });
  expect(screen.getByRole('button', { name: 'Preview' }).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Multiplier for ball 1'), { target: { value: '' } });
  expect(screen.queryByLabelText('Win for ball 1')).toBeNull();
  expect(screen.getByRole('button', { name: 'Preview' }).disabled).toBe(false);
});

test('invalid inputs are styled through aria-invalid', () => {
  render(<BallPayout round={ROUND} />);
  expect(screen.getByLabelText('Multiplier for ball 2').className).toContain('aria-[invalid=true]:border-red-destructive');
});
