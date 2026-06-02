import { render, screen, fireEvent } from '@testing-library/react';
import HuntTour from '../HuntTour';

describe('HuntTour', () => {
  it('renders step 1 of 6 on open', () => {
    render(<HuntTour open onClose={() => {}} />);
    expect(screen.getByText(/1 \/ 6/)).toBeTruthy();
  });

  it('advances on Next and calls onClose with Done on the last step', () => {
    const onClose = jest.fn();
    render(<HuntTour open onClose={onClose} />);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }
    expect(screen.getByText(/6 \/ 6/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Skip closes immediately', () => {
    const onClose = jest.fn();
    render(<HuntTour open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when open=false', () => {
    const { container } = render(<HuntTour open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
