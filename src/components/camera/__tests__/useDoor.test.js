import { fireEvent, render, screen } from '@testing-library/react';
import useDoor from '../useDoor';

const mockPrefetch = jest.fn();
jest.mock('../../../routes/loaders', () => ({ prefetchRoute: (...a) => mockPrefetch(...a) }));

function Door({ onGo }) {
  return (
    <a {...useDoor('/vods', onGo)} data-testid="door">
      Tapes
    </a>
  );
}

test('a plain click hands the anchor to onGo and stops the browser', () => {
  const onGo = jest.fn();
  render(<Door onGo={onGo} />);
  const a = screen.getByTestId('door');
  const notPrevented = fireEvent.click(a, { button: 0 });
  expect(notPrevented).toBe(false);
  expect(onGo).toHaveBeenCalledWith(a);
  expect(a.getAttribute('href')).toBe('/vods');
});

test('modifier and middle clicks stay native', () => {
  const onGo = jest.fn();
  render(<Door onGo={onGo} />);
  const a = screen.getByTestId('door');
  expect(fireEvent.click(a, { button: 0, ctrlKey: true })).toBe(true);
  expect(fireEvent.click(a, { button: 0, metaKey: true })).toBe(true);
  expect(fireEvent.click(a, { button: 1 })).toBe(true);
  expect(onGo).not.toHaveBeenCalled();
});

test('hover, focus and touch start loading the page', () => {
  render(<Door onGo={() => {}} />);
  const a = screen.getByTestId('door');
  fireEvent.pointerEnter(a);
  fireEvent.focus(a);
  fireEvent.touchStart(a);
  expect(mockPrefetch).toHaveBeenCalledTimes(3);
  expect(mockPrefetch).toHaveBeenCalledWith('/vods');
});
