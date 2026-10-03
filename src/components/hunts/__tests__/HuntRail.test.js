import { fireEvent, render, screen } from '@testing-library/react';
import RunnerUpCard from '../RunnerUpCard';
import PastEpisodes from '../PastEpisodes';

test('runner-up card lists places 2 and up with their prizes', () => {
  render(
    <RunnerUpCard
      winners={[
        { place: 1, twitchId: 'x', displayName: 'Xilentdrifter', prize: { tickets: 500 } },
        { place: 3, twitchId: 'r', displayName: 'RYGARTEARROW', prize: { tickets: 50 } },
        { place: 2, twitchId: 's', displayName: 'skillsytv', prize: { tickets: 100 } },
      ]}
    />
  );
  const labels = screen.getAllByText(/Runner-up|3rd place/).map((n) => n.textContent);
  expect(labels).toEqual(['Runner-up', '3rd place']);
  expect(screen.getByText('skillsytv')).toBeTruthy();
  expect(screen.getByText('+100 tickets')).toBeTruthy();
  expect(screen.queryByText('Xilentdrifter')).toBeNull();
});

test('runner-up card renders nothing without places 2+', () => {
  const { container } = render(<RunnerUpCard winners={[{ place: 1, twitchId: 'x' }]} />);
  expect(container.firstChild).toBeNull();
});

test('past episodes: name, date, signed result; selecting toggles', () => {
  const onSelect = jest.fn();
  const hunts = [
    { id: 'a', huntType: 'community', endedAt: '2026-09-27T23:00:00', pot: 1000, totalWon: 2284.4 },
    { id: 'b', huntType: 'solo', endedAt: '2026-09-24T23:00:00', pot: 500, totalWon: 387.95 },
    { id: 'c', huntType: 'vip', endedAt: null, pot: 0, totalWon: 50 },
  ];
  const { rerender } = render(<PastEpisodes hunts={hunts} activeId={null} onSelect={onSelect} />);
  expect(screen.getByText('Past episodes')).toBeTruthy();
  expect(screen.getByText('+$1,284.40')).toBeTruthy();
  expect(screen.getByText('−$112.05').className).toContain('text-onair-loss');
  expect(screen.getByText('SEP 27')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Community hunt/ }));
  expect(onSelect).toHaveBeenCalledWith('a');
  rerender(<PastEpisodes hunts={hunts} activeId="a" onSelect={onSelect} />);
  const active = screen.getByRole('button', { name: /Community hunt/ });
  expect(active.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(active);
  expect(onSelect).toHaveBeenLastCalledWith(null);
});

test('past episodes renders nothing for an empty list', () => {
  const { container } = render(<PastEpisodes hunts={[]} activeId={null} onSelect={() => {}} />);
  expect(container.firstChild).toBeNull();
});
