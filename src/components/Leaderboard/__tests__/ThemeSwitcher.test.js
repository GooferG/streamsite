import { render, screen, fireEvent } from '@testing-library/react';
import ThemeSwitcher from '../ThemeSwitcher';

const THEMES = [
  { id: 'broadcast', label: 'Broadcast', Component: () => null },
  { id: 'casino', label: 'Casino', Component: () => null },
  { id: 'neon', label: 'Neon', Component: () => null },
];

function setup(activeId) {
  const onSelect = jest.fn();
  render(
    <ThemeSwitcher
      themes={THEMES}
      activeId={activeId}
      defaultId="broadcast"
      onSelect={onSelect}
    />,
  );
  return { onSelect };
}

describe('ThemeSwitcher', () => {
  it('renders a chip per theme', () => {
    setup('broadcast');
    THEMES.forEach((t) => {
      expect(screen.getByRole('button', { name: t.label })).toBeTruthy();
    });
  });

  it('marks the active chip with aria-pressed=true', () => {
    setup('casino');
    expect(
      screen.getByRole('button', { name: 'Casino' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Broadcast' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('calls onSelect with the theme id when a chip is clicked', () => {
    const { onSelect } = setup('broadcast');
    fireEvent.click(screen.getByRole('button', { name: 'Neon' }));
    expect(onSelect).toHaveBeenCalledWith('neon');
  });

  it('hides the reset control when active theme is the default', () => {
    setup('broadcast');
    expect(screen.queryByRole('button', { name: /reset/i })).toBeNull();
  });

  it('shows reset when off-default and calls onSelect(defaultId)', () => {
    const { onSelect } = setup('neon');
    const reset = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(reset);
    expect(onSelect).toHaveBeenCalledWith('broadcast');
  });
});
