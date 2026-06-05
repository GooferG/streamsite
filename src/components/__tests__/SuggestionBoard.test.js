import { render, screen } from '@testing-library/react';
import SuggestionBoard from '../SuggestionBoard';

const BOARD = [
  { person: 'Ana', slots: [
    { name: 'Big Bass', status: 'in' },
    { name: 'Gates', status: 'pending' },
  ] },
  { person: 'Bo', slots: [{ name: 'Doom', status: 'skipped' }] },
];

test('renders each person and their slots', () => {
  render(<SuggestionBoard board={BOARD} loading={false} myName="" refreshSeconds={12} />);
  expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.getByText('Bo')).toBeTruthy();
  expect(screen.getByText('Big Bass')).toBeTruthy();
  expect(screen.getByText('Doom')).toBeTruthy();
});

test('shows the refresh disclaimer', () => {
  render(<SuggestionBoard board={BOARD} loading={false} myName="" refreshSeconds={12} />);
  expect(screen.getByText(/refreshes every 12s/i)).toBeTruthy();
});

test('empty board shows the be-the-first state', () => {
  render(<SuggestionBoard board={[]} loading={false} myName="" refreshSeconds={12} />);
  expect(screen.getByText(/be the first/i)).toBeTruthy();
});

test('highlights the viewer’s own group (case-insensitive match)', () => {
  render(<SuggestionBoard board={BOARD} loading={false} myName="  ana " refreshSeconds={12} />);
  // The "you" tag renders only on the matching group.
  expect(screen.getByText(/you/i)).toBeTruthy();
});

test('loading (first load, no board yet) shows a loading state', () => {
  render(<SuggestionBoard board={null} loading={true} myName="" refreshSeconds={12} />);
  expect(screen.getByText(/loading/i)).toBeTruthy();
});
