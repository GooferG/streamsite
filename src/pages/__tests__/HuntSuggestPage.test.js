import { render, screen, waitFor } from '@testing-library/react';
import HuntSuggestPage from '../HuntSuggestPage';

// useParams is stubbed via the project's reactRouterDomStub; provide linkId.
jest.mock('react-router-dom', () => ({
  useParams: () => ({ linkId: 'test-link' }),
}));

function mockInfo(body) {
  global.fetch = jest.fn((url) => {
    if (String(url).includes('/api/hunt-suggest/info')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

afterEach(() => {
  jest.resetAllMocks();
});

test('shows password field when the link requires a password', async () => {
  mockInfo({ huntName: 'Hunt', open: true, requiresPassword: true });
  render(<HuntSuggestPage />);
  // Wait for the loaded form (submit button) to appear.
  await waitFor(() => expect(screen.queryByText('Send suggestions')).toBeTruthy());
  expect(document.querySelector('input[type=password]')).toBeTruthy();
});

test('hides password field when the link is open', async () => {
  mockInfo({ huntName: 'Hunt', open: true, requiresPassword: false });
  render(<HuntSuggestPage />);
  await waitFor(() => expect(screen.queryByText('Send suggestions')).toBeTruthy());
  expect(document.querySelector('input[type=password]')).toBeFalsy();
});
