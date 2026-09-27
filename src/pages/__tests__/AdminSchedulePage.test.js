import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminSchedulePage from '../AdminSchedulePage';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: () => ({}),
  getDoc: () => Promise.resolve({ exists: () => false }),
  setDoc: () => Promise.resolve(),
}));

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ games: [] }) })
  );
});

// Regression: the day editor modal re-ran its focus effect on every render,
// pulling focus off the field after each keystroke.
test('day editor fields keep focus while typing', async () => {
  render(<AdminSchedulePage />);
  const cells = await waitFor(() => screen.getAllByText('Edit'));
  fireEvent.click(cells[0]);
  // Let GameAutocomplete's game-list fetch settle.
  await act(async () => {});

  const content = screen.getByPlaceholderText('Gaming, Gambling, Just Chatting');
  content.focus();
  expect(document.activeElement).toBe(content);

  fireEvent.change(content, { target: { value: 'G' } });
  fireEvent.change(content, { target: { value: 'Ga' } });

  expect(content.value).toBe('Ga');
  expect(document.activeElement).toBe(content);
});
