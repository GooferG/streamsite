import { fireEvent, render, screen, within } from '@testing-library/react';
import { Aisle, GameDivider, Shelf } from '../Shelf';
import VhsBox from '../VhsBox';
import ClipCassette from '../ClipCassette';
import { buildStore } from '../videoStoreModel';
import { VIDEO_STORE_FIXTURES as F } from '../videoStoreFixtures';

const store = buildStore(F.rich);

test('a VHS box names itself and opens its tape', () => {
  const onOpen = jest.fn();
  render(<VhsBox tape={store.byId['2888141530']} onOpen={onOpen} />);
  const box = screen.getByRole('button', { name: 'Win Wednesdays, Wed, Sep 30, 5:02:30, 2 clips inside' });
  expect(within(box).getByText('No. 1530')).toBeTruthy();
  expect(within(box).getByText('WED')).toBeTruthy();
  expect(within(box).getByText('T-120 · EP')).toBeTruthy();
  expect(within(box).getByText('2 clips inside')).toBeTruthy();
  fireEvent.click(box);
  expect(onOpen).toHaveBeenCalledWith('2888141530');
});

test('the newest box wears New release over its cover', () => {
  render(<VhsBox tape={store.byId['2889109731']} onOpen={() => {}} />);
  expect(screen.getByText('New release')).toBeTruthy();
  expect(screen.getByRole('button').querySelector('img').getAttribute('src')).toMatch(/thumb0-440x248\.jpg$/);
});

test('a box with no picture shows the test card', () => {
  const tape = buildStore(F.nothumb).byId['2889109731'];
  render(<VhsBox tape={tape} onOpen={() => {}} />);
  expect(screen.getByTestId('no-picture')).toBeTruthy();
  expect(screen.getByRole('button').querySelector('img')).toBeNull();
});

test('a cassette credits whoever clipped it, with its year in the classics', () => {
  const onOpen = jest.fn();
  render(<ClipCassette clip={store.byId.GeniusSmokyOpossumFrankerZ} viewerName={null} showYear onOpen={onOpen} />);
  const cassette = screen.getByRole('button', { name: 'What just happened, Picked by Moogle_Cat, 0:39, © 2018' });
  expect(within(cassette).getByText('© 2018')).toBeTruthy();
  expect(within(cassette).getByText('219 views')).toBeTruthy();
  fireEvent.click(cassette);
  expect(onOpen).toHaveBeenCalledWith('GeniusSmokyOpossumFrankerZ');
});

test('a clip watched once says 1 view', () => {
  const clip = { ...store.byId.GeniusSmokyOpossumFrankerZ, viewCount: 1, views: '1' };
  render(<ClipCassette clip={clip} viewerName={null} onOpen={() => {}} />);
  expect(screen.getByText('1 view')).toBeTruthy();
  expect(screen.queryByText('1 views')).toBeNull();
});

test('your own clip reads Picked by you', () => {
  render(<ClipCassette clip={store.byId.GeniusSmokyOpossumFrankerZ} viewerName="moogle_cat" onOpen={() => {}} />);
  expect(screen.getByText('Picked by you').getAttribute('data-you')).toBe('true');
  expect(screen.queryByText('© 2018')).toBeNull();
});

test('a cassette without a picture shows the test card', () => {
  const clip = { ...store.byId.GeniusSmokyOpossumFrankerZ, cover: null };
  render(<ClipCassette clip={clip} viewerName={null} onOpen={() => {}} />);
  expect(screen.getByTestId('no-picture')).toBeTruthy();
});

test('a shelf labels its row and puts every tape on the lip', () => {
  render(
    <Shelf label="This week">
      <span>a</span>
      <span>b</span>
    </Shelf>
  );
  expect(screen.getByRole('heading', { level: 3, name: 'This week' })).toBeTruthy();
  expect(within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByRole('list', { name: 'This week' }).getAttribute('role')).toBe('list');
});

test('a game divider is a level-4 heading with its clip count', () => {
  const { unmount } = render(<GameDivider game="Nioh" count={2} />);
  expect(screen.getByRole('heading', { level: 4, name: 'Nioh' })).toBeTruthy();
  expect(screen.getByText('2 clips')).toBeTruthy();
  unmount();
  render(<GameDivider game="Slots" count={1} />);
  expect(screen.getByText('1 clip')).toBeTruthy();
});

test('an aisle is a region named by a focusable heading', () => {
  render(
    <Aisle id="fresh-picks" title="Fresh picks" count={12}>
      <p>shelves</p>
    </Aisle>
  );
  const heading = screen.getByRole('heading', { level: 2, name: 'Fresh picks' });
  expect(screen.getByRole('region', { name: 'Fresh picks' })).toBeTruthy();
  expect(heading.id).toBe('fresh-picks');
  expect(heading.getAttribute('tabindex')).toBe('-1');
  expect(screen.getByText('012 on the shelf')).toBeTruthy();
});
