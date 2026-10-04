import { render, screen } from '@testing-library/react';
import { Chips, Eyebrow, Hero, HeroRow, Question, SideStats, Stage } from '../MonitorStage';

test('the stage parts render the Hunts monitor markup', () => {
  render(
    <Stage eyebrow={<Eyebrow tone="signal">Community hunt · Opening bonuses</Eyebrow>}>
      <Question>What does the hunt pay?</Question>
      <HeroRow hero={<Hero text="ARS 1,539,232.70" label="Won so far" />} side={[{ label: 'Start cost', value: '$2,421.82' }]} />
      <Chips>
        <span>chip</span>
      </Chips>
    </Stage>
  );
  expect(screen.getByText('Community hunt · Opening bonuses').className).toContain('text-onair-signal');
  expect(screen.getByRole('heading', { name: 'What does the hunt pay?' })).toBeTruthy();
  // The currency code is set small beside the figure so long amounts fit.
  expect(screen.getByText('ARS').className).toContain('text-[0.45em]');
  expect(screen.getByText('Start cost')).toBeTruthy();
});

test('SideStats renders nothing without items', () => {
  const { container } = render(<SideStats items={[]} />);
  expect(container.innerHTML).toBe('');
});
