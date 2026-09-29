import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

function Boom() {
  throw new Error('boom');
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('a null fallback renders nothing', () => {
  const { container } = render(<ErrorBoundary fallback={null}><Boom /></ErrorBoundary>);
  expect(container.innerHTML).toBe('');
});

test('a function fallback gets a reset', () => {
  render(
    <ErrorBoundary fallback={(reset) => <button onClick={reset}>Reopen</button>}>
      <Boom />
    </ErrorBoundary>
  );
  expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
});

test('no fallback keeps the page error screen', () => {
  render(<ErrorBoundary><Boom /></ErrorBoundary>);
  expect(screen.getByText(/something broke/i)).toBeTruthy();
});
