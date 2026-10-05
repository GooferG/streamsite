import { act, fireEvent, render, screen } from '@testing-library/react';
import useDoorHold, { withHold } from '../useDoorHold';

function Door({ onHold }) {
  const [, hold] = useDoorHold('tv', onHold);
  return (
    <a href="/vods" {...withHold({}, hold)}>
      door
    </a>
  );
}
const door = () => screen.getByRole('link', { name: 'door' });
const held = (onHold) => onHold.mock.calls.map(([, on]) => on);

// jsdom counts any focus as :focus-visible. A browser doesn't after a click or
// a script's focus(), and an older one doesn't know the selector at all.
const realMatches = Element.prototype.matches;
function focusVisible(mode) {
  Element.prototype.matches = function matches(selector) {
    if (selector !== ':focus-visible') return realMatches.call(this, selector);
    if (mode === 'unsupported') throw new SyntaxError("':focus-visible' is not a valid selector");
    return mode && realMatches.call(this, ':focus');
  };
}
afterEach(() => {
  Element.prototype.matches = realMatches;
});

test('the pointer holds the screen, and leaving lets it go', () => {
  const onHold = jest.fn();
  render(<Door onHold={onHold} />);
  fireEvent.pointerEnter(door());
  fireEvent.pointerLeave(door());
  expect(held(onHold)).toEqual([true, false]);
});

test('keyboard focus (:focus-visible) holds the screen, and blur lets it go', () => {
  const onHold = jest.fn();
  focusVisible(true);
  render(<Door onHold={onHold} />);
  act(() => door().focus());
  expect(held(onHold)).toEqual([true]);
  act(() => door().blur());
  expect(held(onHold)).toEqual([true, false]);
});

test('focus from a click or a script (not :focus-visible) holds nothing', () => {
  const onHold = jest.fn();
  focusVisible(false);
  render(<Door onHold={onHold} />);
  act(() => door().focus());
  expect(onHold).not.toHaveBeenCalled();
  // The pointer still holds while it is on the door.
  fireEvent.pointerEnter(door());
  expect(held(onHold)).toEqual([true]);
});

test('without :focus-visible, focus holds only after a key press', () => {
  const onHold = jest.fn();
  focusVisible('unsupported');
  render(<Door onHold={onHold} />);
  fireEvent.pointerDown(document);
  act(() => door().focus());
  expect(onHold).not.toHaveBeenCalled();
  act(() => door().blur());
  fireEvent.keyDown(document, { key: 'Tab' });
  act(() => door().focus());
  expect(held(onHold)).toEqual([true]);
});
