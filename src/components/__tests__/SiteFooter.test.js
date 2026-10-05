import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SiteFooter from '../SiteFooter';

test('footer text reads at 4.5:1 or better (Readable Labels: never fainter than ink-5)', () => {
  render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>
  );
  const footer = screen.getByRole('contentinfo');
  expect(footer.innerHTML).not.toMatch(/text-white\/(30|35|45)\b/);
  expect(screen.getByText(/Off-air but archived/).className).toContain('text-onair-ink-5');
  expect(screen.getByText(/We do not take responsibility/).className).toContain('text-onair-ink-5');
  // The link stays a step brighter than the text around it.
  expect(screen.getByRole('link', { name: /Terms/ }).className).toContain('text-onair-ink-4');
});
