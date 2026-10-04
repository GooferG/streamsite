import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GambaGuide, { GuideView } from '../GambaGuide';
import { GUIDE_FIXTURES } from '../guideFixtures';
import useGuideData from '../useGuideData';

jest.mock('../useGuideData', () => jest.fn());

const view = (key) =>
  render(
    <MemoryRouter>
      <GuideView data={GUIDE_FIXTURES[key]} now={GUIDE_FIXTURES[key].now} />
    </MemoryRouter>
  );

const listings = () => within(screen.getByRole('region', { name: "What's on" }));

test('live fixture: Hunts holds the monitor and its row is lit', () => {
  view('live');
  expect(screen.getByRole('region', { name: 'Featured channel' }).textContent).toContain('Hunts');
  expect(listings().getByRole('link', { name: /CH 02\s*Hunts/ }).getAttribute('data-lit')).toBe('signal');
  expect(listings().getAllByRole('link')).toHaveLength(4);
});

test('pre-hunt fixture: the question on the monitor', () => {
  view('prehunt');
  expect(screen.getByRole('heading', { name: 'What does the hunt pay?' })).toBeTruthy();
});

test('off-air fixture: the leaderboard holds the monitor, nothing lit', () => {
  view('offair');
  expect(screen.getByRole('link', { name: 'View standings' })).toBeTruthy();
  listings()
    .getAllByRole('link')
    .forEach((a) => expect(a.getAttribute('data-lit')).toBeNull());
});

test('no-leaderboard fixture: No signal on the monitor', () => {
  view('noleaderboard');
  expect(screen.getByRole('heading', { name: 'No signal' })).toBeTruthy();
});

test('live data path: GambaGuide reads useGuideData', () => {
  useGuideData.mockReturnValue(GUIDE_FIXTURES.offair);
  render(
    <MemoryRouter>
      <GambaGuide />
    </MemoryRouter>
  );
  expect(useGuideData).toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'View standings' })).toBeTruthy();
});
