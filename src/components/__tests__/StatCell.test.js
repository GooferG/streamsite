import { render, screen } from '@testing-library/react';
import StatCell from '../StatCell';

describe('StatCell', () => {
  it('renders label and value', () => {
    render(<StatCell label="Profit" value="+100" />);
    expect(screen.getByText('Profit')).toBeTruthy();
    expect(screen.getByText('+100')).toBeTruthy();
  });

  it('default variant keeps the bordered box class', () => {
    const { container } = render(<StatCell label="X" value="1" />);
    expect(container.firstChild.className).toContain('border');
  });

  it('bare variant drops the border', () => {
    const { container } = render(<StatCell label="X" value="1" variant="bare" />);
    expect(container.firstChild.className.includes('border ')).toBe(false);
  });

  it('hero enlarges the value', () => {
    const { container } = render(<StatCell label="Profit" value="+100" hero />);
    expect(container.querySelector('.text-2xl, .text-3xl')).toBeTruthy();
  });
});
