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
    hunt: { bonuses: [{ slot: 'Gates of Olympus', multiplier: 412, win: 412, bet: 1 }, { slot: 'Sugar Rush 1000', multiplier: null }] },
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
