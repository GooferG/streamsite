import { act, fireEvent, render, screen } from '@testing-library/react';
import HoldButton from '../HoldButton';

function setup(extra = {}) {
  const onConfirm = jest.fn();
  const utils = render(
    <HoldButton
      idleLabel="Hold to order"
      armedLabel="Press again to spend 420"
      hint="Press and hold · let go to cancel"
      onConfirm={onConfirm}
      {...extra}
    />
  );
  return { ...utils, onConfirm, button: screen.getByRole('button') };
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

test('a full hold confirms once and swallows the click that follows', () => {
  const { onConfirm, button } = setup();
  fireEvent.pointerDown(button);
  expect(button.textContent).toBe('Keep holding…');
  act(() => {
    jest.advanceTimersByTime(900);
  });
  expect(onConfirm).toHaveBeenCalledTimes(1);
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(button.textContent).toBe('Hold to order');
});

test('letting go early cancels and does not arm', () => {
  const { onConfirm, button } = setup();
  fireEvent.pointerDown(button);
  act(() => {
    jest.advanceTimersByTime(500);
  });
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(onConfirm).not.toHaveBeenCalled();
  expect(button.textContent).toBe('Hold to order');
});

test('a quick tap arms, and a second press inside the window confirms', () => {
  const { onConfirm, button } = setup();
  fireEvent.pointerDown(button);
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(button.textContent).toBe('Press again to spend 420');
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(button); // keyboard / screen reader style: no pointer
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(button.textContent).toBe('Hold to order');
});

test('the arm expires after the confirm window', () => {
  const { onConfirm, button } = setup();
  fireEvent.click(button);
  act(() => {
    jest.advanceTimersByTime(4000);
  });
  expect(button.textContent).toBe('Hold to order');
  fireEvent.click(button);
  expect(onConfirm).not.toHaveBeenCalled();
});

test('Space held down confirms and key repeat never restarts the timer', () => {
  const { onConfirm, button } = setup();
  fireEvent.keyDown(button, { key: ' ' });
  act(() => {
    jest.advanceTimersByTime(600);
  });
  fireEvent.keyDown(button, { key: ' ', repeat: true });
  act(() => {
    jest.advanceTimersByTime(300);
  });
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('becoming disabled mid-hold cancels the hold', () => {
  const { onConfirm, button, rerender } = setup();
  fireEvent.pointerDown(button);
  rerender(
    <HoldButton idleLabel="Hold to order" armedLabel="Press again to spend 420" onConfirm={onConfirm} disabled />
  );
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(onConfirm).not.toHaveBeenCalled();
});

test('disabled ignores presses and clicks', () => {
  const { onConfirm, button } = setup({ disabled: true });
  fireEvent.pointerDown(button);
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  fireEvent.click(button);
  expect(onConfirm).not.toHaveBeenCalled();
});

test('onHoldStart fires when a hold begins, and the hint describes the button', () => {
  const onHoldStart = jest.fn();
  const { button } = setup({ onHoldStart });
  fireEvent.pointerDown(button);
  expect(onHoldStart).toHaveBeenCalledTimes(1);
  const hint = document.getElementById(button.getAttribute('aria-describedby'));
  expect(hint.textContent).toBe('Press and hold · let go to cancel');
});
