import { fireEvent, render, screen, within } from '@testing-library/react';
import RentalCounter from '../RentalCounter';
import { buildStore } from '../videoStoreModel';
import { VIDEO_STORE_FIXTURES as F } from '../videoStoreFixtures';

const store = buildStore(F.rich);
const SEP30 = store.byId['2888141530'];
const OCT1 = store.byId['2889109731'];
const SCAT = store.byId['CarefulHyperCasetteKlappa-YJOqxReFjKsu26i4'];
const UNNAMED = store.byId['GiantViscousFerretNinjaGrumpy-0S22YNqMADX44pfl'];
const CLASSIC = store.byId.GeniusSmokyOpossumFrankerZ;

function renderCounter(props = {}) {
  const handlers = { onSeek: jest.fn(), onSwitch: jest.fn(), onClose: jest.fn() };
  const view = render(<RentalCounter item={SEP30} at={null} viewerName={null} {...handlers} {...props} />);
  return { ...view, ...handlers, dialog: () => screen.getByRole('dialog') };
}

test('a VOD plays on the TV with the back of its box beside it', () => {
  const { dialog } = renderCounter();
  expect(screen.getByRole('dialog', { name: 'Win Wednesdays' })).toBeTruthy();
  expect(within(dialog()).getByText('Rental No. 1530')).toBeTruthy();
  expect(dialog().querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true'
  );
  const back = within(within(dialog()).getByRole('region', { name: 'Back of the box' }));
  expect(back.getByText('Wed, Sep 30')).toBeTruthy();
  expect(back.getByText('T-120 · EP')).toBeTruthy();
  expect(back.getByText('Nov 29')).toBeTruthy();
});

test('a seek starts the player at the clip, and its mark reads as current', () => {
  const { dialog } = renderCounter({ at: 14240 });
  expect(dialog().querySelector('iframe').getAttribute('src')).toBe(
    'https://player.twitch.tv/?video=2888141530&parent=localhost&autoplay=true&time=3h57m20s'
  );
  const mark = within(dialog()).getByRole('button', { name: 'Jump to 3:57:20, 5 scat? pants off' });
  expect(mark.getAttribute('aria-current')).toBe('true');
  // The track clips overflow, so the ring sits inside the button.
  expect(mark.className).toContain('focus-visible:-outline-offset-2');
});

test('clip marks and the clip list both seek', () => {
  const { dialog, onSeek } = renderCounter();
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Jump to 4:05:44, That\'s a whole lot of bombs aint it?' }));
  expect(onSeek).toHaveBeenLastCalledWith(14744);
  fireEvent.click(within(dialog()).getByRole('button', { name: /^5 scat\? pants off 3:57:20/ }));
  expect(onSeek).toHaveBeenLastCalledWith(14240);
});

test('muted stretches show as static, and a tape nobody clipped says so', () => {
  const { dialog } = renderCounter({ item: OCT1 });
  expect(dialog().querySelectorAll('[data-muted]')).toHaveLength(1);
  expect(within(dialog()).getByText('Audio muted 1:30:00 to 1:40:00')).toBeTruthy();
  expect(within(dialog()).queryByText('No clips on this tape yet')).toBeNull();
  expect(within(dialog()).queryByRole('list', { name: 'Clip marks' })).toBeNull();
  expect(within(dialog()).getByText('Nobody clipped this one yet.')).toBeTruthy();
});

test('a clip plays in the clip embed and links to its tape', () => {
  const { dialog, onSwitch } = renderCounter({ item: SCAT });
  expect(screen.getByRole('dialog', { name: '5 scat? pants off' })).toBeTruthy();
  expect(dialog().querySelector('iframe').getAttribute('src')).toBe(
    'https://clips.twitch.tv/embed?clip=CarefulHyperCasetteKlappa-YJOqxReFjKsu26i4&parent=localhost&autoplay=true'
  );
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Found on tape: Win Wednesdays, Sep 30 at 3:57:20' }));
  expect(onSwitch).toHaveBeenCalledWith('2888141530', 14240);
});

test('a classic whose VOD is gone says the original tape is lost', () => {
  const { dialog } = renderCounter({ item: CLASSIC, viewerName: 'moogle_cat' });
  expect(within(dialog()).getByText('Original tape lost.')).toBeTruthy();
  expect(within(dialog()).getByText('Picked by you')).toBeTruthy();
  expect(within(dialog()).getByText('Escape from Tarkov')).toBeTruthy();
});

test('Escape and the scrim close the counter; a click inside does not', () => {
  const { dialog, onClose } = renderCounter();
  fireEvent.click(dialog());
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('counter-scrim'));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('focus moves in, stays in, and goes back to the box', () => {
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  const { dialog, unmount } = renderCounter();
  const focusables = dialog().querySelectorAll('a[href], button:not([disabled]), iframe');
  expect(document.activeElement).toBe(within(dialog()).getByRole('button', { name: 'Esc, close the counter' }));
  focusables[focusables.length - 1].focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(focusables[0]);
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  unmount();
  expect(document.activeElement).toBe(opener);
  opener.remove();
});

test('the page behind does not scroll while the counter is open', () => {
  const { unmount } = renderCounter();
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).toBe('');
});

test('focus that wandered outside the counter is pulled back in on Tab', () => {
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  const { dialog } = renderCounter();
  const focusables = dialog().querySelectorAll('a[href], button:not([disabled]), iframe');
  outside.focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(focusables[0]);
  outside.focus();
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  outside.remove();
});

test('switching tapes moves focus to the close button', () => {
  const handlers = { onSeek: jest.fn(), onSwitch: jest.fn(), onClose: jest.fn() };
  const { rerender } = render(<RentalCounter item={SCAT} at={null} viewerName={null} {...handlers} />);
  const found = screen.getByRole('button', { name: /^Found on tape/ });
  found.focus();
  expect(document.activeElement).toBe(found);
  rerender(<RentalCounter item={SEP30} at={null} viewerName={null} {...handlers} />);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Esc, close the counter' }));
});

test('an unlabeled clip keeps its generated label out of the marker face', () => {
  renderCounter({ item: UNNAMED });
  const h2 = screen.getByRole('dialog').querySelector('h2');
  expect(h2.textContent.startsWith('No label')).toBe(true);
  expect(h2.className.includes('font-onair-marker')).toBe(false);
});

test('the header strip separates the shop from the rental', () => {
  renderCounter();
  expect(screen.getByRole('dialog').textContent.includes('Goofer Video·Rental No. 1530')).toBe(true);
});
