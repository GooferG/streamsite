import { fireEvent, render, screen, within } from '@testing-library/react';
import VideoStoreFront from '../VideoStoreFront';
import { VIDEO_STORE_FIXTURES as F } from '../videoStoreFixtures';

const renderStore = (key, props = {}) => render(<VideoStoreFront {...F[key]} {...props} />);
const aisle = (name) => within(screen.getByRole('region', { name }));
const SEP30_BOX = /^Win Wednesdays, Wed, Sep 30/;

test('New releases shelves the tapes by week, newest first', () => {
  renderStore('rich');
  expect(aisle('New releases').getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
    'This week',
    'Last week',
    'Sep 14–20',
    'Sep 7–13',
    'Aug 31–Sep 6',
    'Aug 24–30',
    'Aug 17–23',
  ]);
  const thisWeek = within(screen.getByRole('list', { name: 'This week' })).getAllByRole('button');
  expect(thisWeek.map((b) => b.getAttribute('aria-label'))).toEqual([
    'Win Wednesdays, Thu, Oct 1, 4:37:20, New release',
    'Win Wednesdays, Wed, Sep 30, 5:02:30, 2 clips inside',
    'Monday Hunts and Twists, Mon, Sep 28, 2:45:00, 5 clips inside',
  ]);
  expect(screen.queryByText(/communityhunts\.gg/)).toBeNull();
});

test('aisle signs carry the counts and hand focus to the aisle', () => {
  renderStore('rich');
  const nav = within(screen.getByRole('navigation', { name: 'Aisles' }));
  expect(nav.getAllByRole('link').map((a) => a.textContent)).toEqual(['Fresh picks012', 'New releases027', 'Cult classics016']);
  fireEvent.click(nav.getByRole('link', { name: /^Cult classics/ }));
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Cult classics' }));
});

test('the floor runs TV, Fresh picks, New releases, Cult classics', () => {
  renderStore('rich');
  expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label') || r.querySelector('h2').textContent)).toEqual([
    'In-store TV',
    'Fresh picks',
    'New releases',
    'Cult classics',
  ]);
});

test('the in-store TV rents its tape on the counter', () => {
  const onTapeChange = jest.fn();
  renderStore('rich', { onTapeChange });
  fireEvent.click(screen.getByRole('button', { name: 'Rent it: Win Wednesdays' }));
  expect(screen.getByRole('dialog', { name: 'Win Wednesdays' }).querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2889109731&parent=localhost&autoplay=true'
  );
  expect(onTapeChange).toHaveBeenCalledWith('2889109731');
});

test('while live the TV leads with the stream', () => {
  renderStore('live');
  const tv = within(screen.getByRole('region', { name: 'In-store TV' }));
  expect(tv.getByText('On the air now')).toBeTruthy();
  expect(tv.getByRole('link', { name: 'Watch now' }).getAttribute('href')).toBe('/');
});

test('an aisle with nothing in it is left out, and so is its sign', () => {
  const { unmount } = renderStore('fresh');
  expect(screen.queryByRole('region', { name: 'Cult classics' })).toBeNull();
  expect(screen.queryByRole('link', { name: /^Cult classics/ })).toBeNull();
  unmount();
  renderStore('classics');
  expect(screen.queryByRole('region', { name: 'Fresh picks' })).toBeNull();
  expect(screen.queryByRole('link', { name: /^Fresh picks/ })).toBeNull();
});

test('Cult classics files clips behind a divider per game, most watched first', () => {
  renderStore('rich');
  expect(aisle('Cult classics').getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
    'Escape from Tarkov',
    'League of Legends',
    'Nioh',
    'Misc.',
    'Slots',
    'iRacing',
    'PUBG: BATTLEGROUNDS',
    'World of Warcraft',
    'Fortnite',
  ]);
  expect(
    within(screen.getByRole('list', { name: 'Escape from Tarkov' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
  ).toEqual(['What just happened, Picked by Moogle_Cat, 0:39, © 2018', 'ghost?, Picked by GooferG, 0:08, © 2018']);
});

test('Fresh picks credit the clipper, and you in purple', () => {
  renderStore('rich', { viewerName: 'LARRYMENTA' });
  const fresh = within(screen.getByRole('list', { name: 'Last 60 days' }));
  expect(fresh.getAllByRole('button')).toHaveLength(12);
  expect(fresh.getByRole('button', { name: '500x hit, Picked by you, 0:30' })).toBeTruthy();
  expect(fresh.getByText('Picked by you').getAttribute('data-you')).toBe('true');
  expect(fresh.getByRole('button', { name: 'No label · at 2:30:39, Picked by GooferG, 0:30' })).toBeTruthy();
});

test('stickers: due back as the archive runs out', () => {
  renderStore('expiring');
  expect(screen.getAllByText('Due back today')).toHaveLength(2);
  expect(screen.getByText('Due back Oct 17')).toBeTruthy();
  expect(screen.getByText('New release')).toBeTruthy();
});

test('tapes without a picture show the test card, on the shelf and on the TV', () => {
  renderStore('nothumb');
  expect(aisle('New releases').getAllByTestId('no-picture')).toHaveLength(2);
  expect(within(screen.getByRole('region', { name: 'In-store TV' })).getByTestId('no-picture')).toBeTruthy();
});

test('the OPEN sign is the live light', () => {
  const { unmount } = renderStore('live');
  expect(screen.getByText('Open')).toBeTruthy();
  unmount();
  renderStore('rich');
  expect(screen.getByTestId('after-hours')).toBeTruthy();
});

test('loading: blank sleeves and the clerk restocking', () => {
  renderStore('loading');
  expect(screen.getByRole('status').textContent).toBe('Restocking the shelves…');
  expect(screen.getByTestId('clerk-restock')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'In-store TV' })).getByText('Tuning in…')).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Aisles' })).toBeNull();
  expect(screen.queryByText(/clips on the floor/)).toBeNull();
});

test('an empty store: the clerk asleep and a plain message', () => {
  renderStore('empty');
  expect(screen.getByRole('heading', { level: 2, name: 'Shelves are empty.' })).toBeTruthy();
  expect(screen.getByText('Check back after the next stream.')).toBeTruthy();
  expect(screen.getByTestId('clerk-asleep')).toBeTruthy();
});

test('the sign-off counts the floor', () => {
  renderStore('rich');
  expect(screen.getByText('Be kind, rewind.')).toBeTruthy();
  expect(screen.getByText('027 tapes · 028 clips on the floor')).toBeTruthy();
});

test('a box opens the counter and reports the tape', () => {
  const onTapeChange = jest.fn();
  renderStore('rich', { onTapeChange });
  fireEvent.click(screen.getByRole('button', { name: SEP30_BOX }));
  const dialog = screen.getByRole('dialog', { name: 'Win Wednesdays' });
  expect(dialog.querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true'
  );
  expect(onTapeChange).toHaveBeenCalledWith('2888141530');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Jump to 3:57:20, 5 scat? pants off' }));
  expect(dialog.querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true&time=3h57m20s'
  );
});

test('Escape closes the counter, clears the tape and returns focus to the box', () => {
  const onTapeChange = jest.fn();
  renderStore('rich', { onTapeChange });
  const box = screen.getByRole('button', { name: /^Monday Hunts and Twists, Mon, Sep 28/ });
  box.focus();
  fireEvent.click(box);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(box);
  expect(onTapeChange).toHaveBeenLastCalledWith(null);
});

test('switching tapes keeps one counter and focus goes home', () => {
  const onTapeChange = jest.fn();
  renderStore('rich', { onTapeChange });
  const cassette = screen.getByRole('button', { name: '5 scat? pants off, Picked by GooferG, 0:30' });
  cassette.focus();
  fireEvent.click(cassette);
  fireEvent.click(screen.getByRole('button', { name: 'Found on tape: Win Wednesdays, Sep 30 at 3:57:20' }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  const dialog = screen.getByRole('dialog', { name: 'Win Wednesdays' });
  expect(dialog.querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true&time=3h57m20s'
  );
  expect(onTapeChange).toHaveBeenLastCalledWith('2888141530');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(document.activeElement).toBe(cassette);
  expect(document.body.style.overflow).toBe('');
});

test('?tape= opens the counter on load; an unknown id is ignored', () => {
  const { unmount } = renderStore('rich', { initialTapeId: '2886426857' });
  expect(screen.getByRole('dialog', { name: 'Monday Hunts and Twists' })).toBeTruthy();
  unmount();
  renderStore('rich', { initialTapeId: 'nope' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a deep link waits for clips that load late', () => {
  const id = 'FamousBlindingAlmondOSkomodo-jvd8g9Ok0a4EkTUz';
  const { rerender } = render(<VideoStoreFront {...F.rich} recentClips={[]} initialTapeId={id} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<VideoStoreFront {...F.rich} initialTapeId={id} />);
  expect(screen.getByRole('dialog', { name: 'goofer voice' })).toBeTruthy();
});

test('an id that is an Object.prototype key is ignored like any unknown id', () => {
  for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    const { unmount } = renderStore('rich', { initialTapeId: id, viewerName: 'someone' });
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
  }
});

test('pressing the current mark again restarts the player', () => {
  renderStore('rich');
  fireEvent.click(screen.getByRole('button', { name: SEP30_BOX }));
  const mark = () => within(screen.getByRole('dialog')).getByRole('button', { name: 'Jump to 3:57:20, 5 scat? pants off' });
  fireEvent.click(mark());
  const first = screen.getByRole('dialog').querySelector('iframe');
  fireEvent.click(mark());
  const second = screen.getByRole('dialog').querySelector('iframe');
  expect(second).not.toBe(first);
  expect(second.getAttribute('src')).toMatch(/&time=3h57m20s$/);
});

test('a poll refresh keeps the tape playing', () => {
  const { rerender } = render(<VideoStoreFront {...F.rich} />);
  fireEvent.click(screen.getByRole('button', { name: SEP30_BOX }));
  const frame = screen.getByRole('dialog').querySelector('iframe');
  rerender(<VideoStoreFront {...F.rich} videos={F.rich.videos.map((v) => ({ ...v }))} topClips={[...F.rich.topClips]} />);
  expect(screen.getByRole('dialog').querySelector('iframe')).toBe(frame);
});

test('a tape that leaves the archive closes the counter', () => {
  const onTapeChange = jest.fn();
  const { rerender } = render(<VideoStoreFront {...F.rich} onTapeChange={onTapeChange} />);
  fireEvent.click(screen.getByRole('button', { name: SEP30_BOX }));
  rerender(
    <VideoStoreFront {...F.rich} videos={F.rich.videos.filter((v) => v.id !== '2888141530')} onTapeChange={onTapeChange} />
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('');
  expect(onTapeChange).toHaveBeenLastCalledWith(null);
});

test('the floor pads scrolling for the nav and the aisle bar, and puts it back on the way out', () => {
  const { unmount } = renderStore('rich');
  expect(document.documentElement.style.scrollPaddingTop).toBe('9rem');
  unmount();
  expect(document.documentElement.style.scrollPaddingTop).toBe('');
});

test('while live, the broadcast still recording sits on the shelf but not on the TV', () => {
  renderStore('live');
  const tv = within(screen.getByRole('region', { name: 'In-store TV' }));
  fireEvent.click(tv.getByRole('button', { name: 'Next spot' }));
  expect(tv.getByText('Now on tape')).toBeTruthy();
  expect(screen.getByTestId('spot-title').textContent).toBe('Win Wednesdays');
  expect(tv.getByRole('button', { name: 'Rent it: Win Wednesdays' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Win Wednesdays, Sun, Oct 4/ })).toBeTruthy();
});
