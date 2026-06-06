import { render, screen } from '@testing-library/react';
import HuntHero from '../HuntHero';

test('shows positive P/L with + sign', () => {
  render(<HuntHero profit={250} avgReqRemaining={null} totalWins={1850} start={1600} wlMultiplier={1.16} />);
  expect(screen.getByText(/\+\$250\.00/)).toBeTruthy();
});

test('shows BEHIND pace chip when down and need-per-remaining provided', () => {
  render(<HuntHero profit={-300} avgReqRemaining={92.5} totalWins={300} start={600} wlMultiplier={0.5} />);
  expect(screen.getByText(/behind/i)).toBeTruthy();
});

test('shows em dash when profit is null', () => {
  render(<HuntHero profit={null} avgReqRemaining={null} totalWins={0} start={null} wlMultiplier={null} />);
  expect(screen.getByText('—')).toBeTruthy();
});
