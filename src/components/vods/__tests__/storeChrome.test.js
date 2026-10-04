import { fireEvent, render, screen } from '@testing-library/react';
import StoreSign from '../StoreSign';
import AisleSigns from '../AisleSigns';
import Clerk from '../Clerk';

test('the sign is the page heading', () => {
  render(<StoreSign isLive={false} statusReady={false} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Goofer Video' })).toBeTruthy();
  expect(screen.getByText("Every stream from the last 60 days, plus the clips chat couldn't let go.")).toBeTruthy();
});

test('the OPEN light waits for the first Twitch poll', () => {
  render(<StoreSign isLive statusReady={false} />);
  expect(screen.queryByText('Open')).toBeNull();
  expect(screen.queryByTestId('after-hours')).toBeNull();
});

test('live: OPEN is lit and links to the stream', () => {
  render(<StoreSign isLive statusReady />);
  expect(screen.getByText('Open')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Goofer is live, watch now' }).getAttribute('href')).toBe('/');
});

test('off air: the sign reads After hours, unlit', () => {
  render(<StoreSign isLive={false} statusReady />);
  expect(screen.getByTestId('after-hours').textContent).toBe('After hours');
  expect(screen.queryByText('Open')).toBeNull();
});

test('aisle signs jump to their aisle and hand it focus', () => {
  render(
    <>
      <AisleSigns
        aisles={[
          { id: 'new-releases', label: 'New releases', count: 27 },
          { id: 'fresh-picks', label: 'Fresh picks', count: 12 },
        ]}
      />
      <h2 id="fresh-picks" tabIndex={-1}>
        Fresh picks
      </h2>
    </>
  );
  const link = screen.getByRole('link', { name: /^Fresh picks\s*012$/ });
  expect(link.getAttribute('href')).toBe('#fresh-picks');
  expect(screen.getByRole('navigation', { name: 'Aisles' })).toBeTruthy();
  fireEvent.click(link);
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Fresh picks' }));
});

test('the clerk is set dressing and bows out when the art is missing', () => {
  render(<Clerk pose="asleep" />);
  const img = screen.getByTestId('clerk-asleep');
  expect(img.getAttribute('aria-hidden')).toBe('true');
  expect(img.getAttribute('alt')).toBe('');
  expect(img.getAttribute('src')).toBe('/gsn/video/clerk-asleep.webp');
  fireEvent.error(img);
  expect(screen.queryByTestId('clerk-asleep')).toBeNull();
});
