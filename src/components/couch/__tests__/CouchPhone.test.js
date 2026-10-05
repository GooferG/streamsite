import { fireEvent, render, screen, within as inside } from '@testing-library/react';
import CouchFront from '../CouchFront';
import { buildCouch } from '../couchModel';
import { COUCH_FIXTURES as F } from '../couchFixtures';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
beforeEach(() => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});
const STAGE = { containerRef: { current: null }, stageRef: { current: null }, box: null };
const front = (fixture, extra = {}) => (
  <CouchFront couch={buildCouch(F[fixture].input)} items={[]} mode="stills" onDoor={() => {}} stage={STAGE} roomLayout={false} {...extra} />
);

test('phones get the TV crop and a tile per door, TV first', () => {
  render(front('offair'));
  const tv = screen.getByRole('link', { name: /^TV:/ });
  expect(inside(tv).getByTestId('couch-tv')).toBeTruthy();
  const tiles = inside(screen.getByRole('list', { name: 'On the coffee table' })).getAllByRole('link');
  expect(tiles.map((a) => a.getAttribute('data-door'))).toEqual(['laptop', 'tapes', 'guide', 'games', 'remote', 'photo']);
  expect(screen.getByText('You missed Win Wednesdays. Thursday night, 4 hours 37.')).toBeTruthy();
});

test('an open giveaway tile spans both columns', () => {
  render(front('giveaway'));
  const note = screen.getByRole('link', { name: /^Note:/ });
  expect(note.closest('li').className).toMatch(/col-span-2/);
});

test('tapping a tile hands it to onDoor', () => {
  const onDoor = jest.fn();
  render(front('offair', { onDoor }));
  fireEvent.click(screen.getByRole('link', { name: /^Tapes:/ }), { button: 0 });
  expect(onDoor.mock.calls[0][0].id).toBe('tapes');
});

test('no art: every door is a plain tile, the TV included, and no images load', () => {
  const { container } = render(front('offair', { noArt: true, roomLayout: true }));
  const tiles = inside(screen.getByRole('list', { name: 'On the coffee table' })).getAllByRole('link');
  expect(tiles[0].getAttribute('data-door')).toBe('tv');
  expect(container.querySelector('img')).toBeNull();
});

test('a plate that fails to load falls back to the tiles', () => {
  const { container } = render(front('offair', { roomLayout: true, stage: { ...STAGE, box: null } }));
  fireEvent.error(container.querySelector('[data-testid="couch-stage"] img'));
  expect(screen.getByRole('list', { name: 'On the coffee table' })).toBeTruthy();
});
