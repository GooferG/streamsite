import { render, screen, fireEvent } from '@testing-library/react';
import ViewerCalls from '../ViewerCalls';

const SUGGESTIONS = [
  { id: 'p1', person: 'Ana', slots: [
    { id: 's1', name: 'Big Bass', status: 'open' },
    { id: 's2', name: 'Gates', status: 'open' },
  ] },
  { id: 'p2', person: 'Bo', slots: [{ id: 's3', name: 'Doom', status: 'open' }] },
  { id: 'p3', person: 'Cy', slots: [{ id: 's4', name: 'Done One', status: 'done' }] }, // not open — excluded
];

test('groups open calls by caller and fires onAdd / onSkip', () => {
  const onAdd = jest.fn();
  const onSkip = jest.fn();
  render(<ViewerCalls suggestions={SUGGESTIONS} onAdd={onAdd} onSkip={onSkip} onSkipAll={() => {}} onOpenLog={() => {}} intakeControls={null} />);
  expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.getByText('Bo')).toBeTruthy();
  // Cy has only a 'done' slot, so the group should not render
  expect(screen.queryByText('Cy')).toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: /add/i })[0]);
  expect(onAdd).toHaveBeenCalledWith('Ana', expect.objectContaining({ id: 's1' }));
  fireEvent.click(screen.getAllByRole('button', { name: /^skip$/i })[0]);
  expect(onSkip).toHaveBeenCalledWith('Ana', expect.objectContaining({ id: 's1' }));
});

test('shows empty state when no open calls', () => {
  const allDone = [{ id: 'p1', person: 'Ana', slots: [{ id: 's1', name: 'X', status: 'done' }] }];
  render(<ViewerCalls suggestions={allDone} onAdd={() => {}} onSkip={() => {}} onSkipAll={() => {}} onOpenLog={() => {}} intakeControls={null} />);
  expect(screen.getByText(/no pending calls/i)).toBeTruthy();
});

test('caller name click fires onOpenLog', () => {
  const onOpenLog = jest.fn();
  render(<ViewerCalls suggestions={SUGGESTIONS} onAdd={() => {}} onSkip={() => {}} onSkipAll={() => {}} onOpenLog={onOpenLog} intakeControls={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ana' }));
  expect(onOpenLog).toHaveBeenCalledWith('Ana');
});
