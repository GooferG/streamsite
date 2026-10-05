import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CameraProvider from '../../components/camera/CameraProvider';
import HomePage from '../HomePage';

jest.mock('../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
// The live path's hooks reach Firebase; a fixture never calls them.
jest.mock('../../components/couch/useCouchData', () => () => ({}));

beforeEach(() => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
  window.history.pushState({}, '', '/?fixture=offair');
});
afterEach(() => window.history.pushState({}, '', '/'));

test('a dev fixture renders the couch', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <CameraProvider>
        <HomePage introDone={false} />
      </CameraProvider>
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: /^Tapes:/ }).getAttribute('href')).toBe('/vods');
});
