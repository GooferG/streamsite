import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function Go() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/x')}>go</button>;
}

const where = () => screen.getByTestId('where').textContent;

test('initial location comes from initialEntries', () => {
  render(
    <MemoryRouter initialEntries={['/a?q=1']}>
      <Where />
    </MemoryRouter>
  );
  expect(where()).toBe('/a');
});

test('a Link click updates the location and Routes swaps elements', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Link to="/b">to b</Link>
      <Where />
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/b" element={<p>bee</p>} />
        <Route path="*" element={<p>nope</p>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('home')).toBeTruthy();
  fireEvent.click(screen.getByText('to b'));
  expect(where()).toBe('/b');
  expect(screen.getByText('bee')).toBeTruthy();
  expect(screen.queryByText('home')).toBeNull();
});

test('Routes falls back to the * route', () => {
  render(
    <MemoryRouter initialEntries={['/zzz']}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="*" element={<p>nope</p>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('nope')).toBeTruthy();
});

test('useNavigate navigates', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Go />
      <Where />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText('go'));
  expect(where()).toBe('/x');
});

test('a click whose onClick prevents default does not navigate', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Link to="/b" onClick={(e) => e.preventDefault()}>to b</Link>
      <Where />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText('to b'));
  expect(where()).toBe('/');
});

test('ctrl and meta clicks do not navigate', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Link to="/b">to b</Link>
      <Where />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText('to b'), { ctrlKey: true });
  fireEvent.click(screen.getByText('to b'), { metaKey: true });
  expect(where()).toBe('/');
});

test('useLocation outside a router is /', () => {
  render(<Where />);
  expect(where()).toBe('/');
});

test('Navigate moves to its target once', () => {
  function Here() {
    return <p>at {useLocation().pathname}</p>;
  }
  render(
    <MemoryRouter initialEntries={['/gamba/nope']}>
      <Routes>
        <Route path="/gamba/nope" element={<Navigate to="/gamba" replace />} />
        <Route path="*" element={<Here />} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('at /gamba')).toBeTruthy();
});
