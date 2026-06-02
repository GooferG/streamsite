import { render, screen, fireEvent } from '@testing-library/react';
import CopyLinkButton from '../CopyLinkButton';

describe('CopyLinkButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });
  afterEach(() => jest.useRealTimers());

  it('renders the given label', () => {
    render(<CopyLinkButton url="https://x/live/ab" label="Copy watch link" />);
    expect(screen.getByText('Copy watch link')).toBeTruthy();
  });

  it('writes the url to the clipboard on click', () => {
    render(<CopyLinkButton url="https://x/live/ab" label="Copy watch link" />);
    fireEvent.click(screen.getByRole('button'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://x/live/ab');
  });
});
