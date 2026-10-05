import { fireEvent, render, screen, within as inside } from '@testing-library/react';
import CouchFront from '../CouchFront';
import { buildCouch } from '../couchModel';
import { COUCH_FIXTURES as F } from '../couchFixtures';
import useCouchStage from '../useCouchStage';
import { ART_ASPECT, LAYOUT } from '../couchLayout';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
beforeEach(() => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});

function Room({ fixture = 'offair', onDoor = () => {} }) {
  const stage = useCouchStage(ART_ASPECT, LAYOUT.art.focal);
  const couch = buildCouch(F[fixture].input);
  return <CouchFront couch={couch} items={[]} mode="stills" onDoor={onDoor} stage={stage} roomLayout />;
}
const doorList = () => screen.getByRole('list', { name: 'Things in the room' });

test('the room is an ordered list of real links, in door order', () => {
  render(<Room />);
  const links = inside(doorList()).getAllByRole('link');
  expect(links.map((a) => a.getAttribute('href'))).toEqual(['/vods', '/gamba', '/vods', '/schedule', '/gaming', '/store', '/about']);
  expect(links[0].getAttribute('aria-label')).toBe('TV: Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time! Opens Vods.');
});

test('a plain click hands the door to onDoor; a ctrl-click stays native', () => {
  const onDoor = jest.fn();
  render(<Room onDoor={onDoor} />);
  const guide = screen.getByRole('link', { name: /^TV guide:/ });
  fireEvent.click(guide, { button: 0, ctrlKey: true });
  expect(onDoor).not.toHaveBeenCalled();
  fireEvent.click(guide, { button: 0 });
  expect(onDoor.mock.calls[0][0].id).toBe('guide');
  expect(onDoor.mock.calls[0][1]).toBe(guide);
});

test('labels show the teaser; the plate and screens render', () => {
  render(<Room />);
  expect(screen.getByText('Back tomorrow 11:00 AM')).toBeTruthy();
  expect(screen.getByTestId('couch-stage').querySelector('img').getAttribute('src')).toBe('/couch/90s/test-room-1280.webp');
  expect(screen.getByTestId('couch-tv')).toBeTruthy();
  expect(screen.getByTestId('laptop-screen')).toBeTruthy();
});

test('live: the TV light is on and the TV door goes to the stream', () => {
  render(<Room fixture="live" />);
  expect(screen.getByTestId('couch-glow')).toBeTruthy();
  expect(screen.getByRole('link', { name: /^TV:/ }).getAttribute('href')).toBe('https://twitch.tv/GooferG');
});

test('off air the room casts no light', () => {
  render(<Room />);
  expect(screen.queryByTestId('couch-glow')).toBeNull();
});

test('an open giveaway puts the handwritten note on the TV', () => {
  render(<Room fixture="giveaway" />);
  const note = screen.getByRole('link', { name: /^Note:/ });
  expect(note.textContent).toContain('!goof');
  expect(note.getAttribute('href')).toBe('/giveaway');
});

test('a new tape wears a sticker', () => {
  render(<Room />);
  expect(inside(screen.getByRole('link', { name: /^Tapes:/ })).getByText('New')).toBeTruthy();
});
