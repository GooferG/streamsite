import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OperatorControls from '../OperatorControls';
import { useAuth } from '../../../contexts/AuthContext';
import { useControlRoom } from '../../../contexts/ControlRoomContext';

jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));

const toggle = jest.fn();
const open = jest.fn();
const logout = jest.fn();

function arm(giveaway = null, enabled = true) {
  useAuth.mockReturnValue({ logout });
  useControlRoom.mockReturnValue({ enabled, giveaway, panelActions: { toggle, open } });
}

function renderAt(path, isAdmin) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <OperatorControls isAdmin={isAdmin} />
      <Routes>
        <Route path="/admin/giveaways" element={<p>giveaways page</p>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => arm());

test('the control room button toggles the floating panel on public pages', () => {
  renderAt('/', false);
  fireEvent.click(screen.getByRole('button', { name: /Control room/ }));
  expect(toggle).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /OP/ })).toBeNull();
});

test('on /admin, where the panel is hidden, it opens the giveaways page', () => {
  renderAt('/admin/hunts', false);
  fireEvent.click(screen.getByRole('button', { name: /Control room/ }));
  expect(toggle).not.toHaveBeenCalled();
  expect(screen.getByText('giveaways page')).toBeTruthy();
});

test('without a provider it still offers the giveaways page', () => {
  useControlRoom.mockReturnValue(null);
  renderAt('/', false);
  fireEvent.click(screen.getByRole('button', { name: /Control room/ }));
  expect(screen.getByText('giveaways page')).toBeTruthy();
});

test('admin: the OP menu holds control room, admin and sign out', () => {
  renderAt('/', true);
  const op = screen.getByRole('button', { name: 'OP: operator menu' });
  fireEvent.click(op);
  expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin');
  fireEvent.click(screen.getAllByRole('button', { name: /Control room/ })[1]);
  expect(open).toHaveBeenCalled();
  fireEvent.click(op);
  fireEvent.click(screen.getByRole('button', { name: /Sign out/ }));
  expect(logout).toHaveBeenCalled();
});

test('no orange anywhere in the operator controls', () => {
  arm({ status: 'open', prize: 'Key', entryCount: 37 });
  const { container } = renderAt('/', true);
  fireEvent.click(screen.getByRole('button', { name: 'OP: operator menu' }));
  expect(container.innerHTML).not.toMatch(/orange|onair-winner/);
});
