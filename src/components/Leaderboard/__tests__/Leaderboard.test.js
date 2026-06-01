import { render } from '@testing-library/react';
import Leaderboard from '../Leaderboard';

// react-router v7 ships its core as ESM-only, which CRA's Jest resolver can't
// load. The wrapper's only router dependency is useSearchParams, so we mock it
// directly and drive the active theme via the ?theme= param. The real router
// import is exercised by the production webpack build, not here.
let mockSearch = '';
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(mockSearch), jest.fn()],
}));

function renderWithTheme(theme) {
  mockSearch = theme === undefined ? '' : `?theme=${theme}`;
  return render(<Leaderboard />);
}

describe('Leaderboard theme resolution', () => {
  it('renders the default (broadcast) theme with no ?theme param', () => {
    const { container } = renderWithTheme(undefined);
    expect(container.querySelector('[data-theme="broadcast"]')).toBeTruthy();
  });

  it('falls back to default theme for an unknown ?theme value', () => {
    const { container } = renderWithTheme('banana');
    expect(container.querySelector('[data-theme="broadcast"]')).toBeTruthy();
  });

  it('renders broadcast when ?theme=broadcast', () => {
    const { container } = renderWithTheme('broadcast');
    expect(container.querySelector('[data-theme="broadcast"]')).toBeTruthy();
  });

  it('renders the minimal theme when ?theme=minimal', () => {
    const { container } = renderWithTheme('minimal');
    expect(container.querySelector('[data-theme="minimal"]')).toBeTruthy();
    expect(container.querySelector('[data-theme="broadcast"]')).toBeNull();
  });

  it('renders the casino theme when ?theme=casino', () => {
    const { container } = renderWithTheme('casino');
    expect(container.querySelector('[data-theme="casino"]')).toBeTruthy();
  });

  it('renders the neon theme when ?theme=neon', () => {
    const { container } = renderWithTheme('neon');
    expect(container.querySelector('[data-theme="neon"]')).toBeTruthy();
  });
});
