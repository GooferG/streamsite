import { act, fireEvent, render, screen } from '@testing-library/react';
import WelcomeSignOn from '../WelcomeSignOn';

// The page around the card: #main (focusable, as App renders it) and a link behind the scrim.
function Page() {
  return (
    <main id="main" tabIndex={-1}>
      <a href="/vods">A door behind the card</a>
      <WelcomeSignOn introDone delayMs={0} />
    </main>
  );
}

async function openCard() {
  render(<Page />);
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
  return screen.getByRole('dialog', { name: 'First time on the couch' });
}

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
});
afterEach(() => jest.useRealTimers());

test('the card is modal: it says so and takes focus', async () => {
  const card = await openCard();
  expect(card.getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement).toBe(card);
});

test('Tab stays in the card, both ways', async () => {
  const card = await openCard();
  const button = screen.getByRole('button', { name: 'Look around' });
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(button);
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(button);
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(button);
  // Focus that got outside comes back in.
  screen.getByRole('link', { name: 'A door behind the card' }).focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(card.contains(document.activeElement)).toBe(true);
});

test('closing it with the button lands focus on the page', async () => {
  await openCard();
  fireEvent.click(screen.getByRole('button', { name: 'Look around' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(document.getElementById('main'));
});

test('closing it with Escape or the scrim lands focus on the page too', async () => {
  await openCard();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(document.getElementById('main'));
  window.localStorage.clear();
  document.body.focus();
  const { unmount } = render(<WelcomeSignOn introDone delayMs={0} />);
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
  fireEvent.click(screen.getByRole('dialog').parentElement);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(document.getElementById('main'));
  unmount();
});
