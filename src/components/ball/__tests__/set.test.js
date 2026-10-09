import { render, screen } from '@testing-library/react';
import DrawTakeover from '../DrawTakeover';
import WinnerCard from '../WinnerCard';
import ChannelSet, { FINE_PRINT } from '../ChannelSet';

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const ENTRY = { drawNo: 3, slotName: 'Gates of Olympus', thumb: null, displayName: 'CoolGuy', twitchName: 'coolguy' };
const sound = () => ({ tick: jest.fn(), burst: jest.fn(), land: jest.fn() });

test('the set: title, LIVE 4:20 bug, the 42 station bug and the fine print', () => {
  render(
    <div className="relative">
      <ChannelSet />
    </div>
  );
  expect(screen.getByText('Goofer Ball')).toBeTruthy();
  expect(screen.getByText('WGOOF · Channel 42 · Nightly draw')).toBeTruthy();
  expect(screen.getByText('● Live 4:20')).toBeTruthy();
  expect(screen.getByText('42')).toBeTruthy();
  expect(FINE_PRINT).toBe('Drawn nightly at 4:20. Supervised by the Goofer Gaming Commission. Odds are odds. Not a real lottery.');
  expect(screen.getByText(FINE_PRINT)).toBeTruthy();
});

test('blower phase: drum only, no ball or lower third yet', () => {
  const s = sound();
  render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} balls={[]} left={61} elapsed={1000} sound={s} />);
  expect(screen.queryByText('@CoolGuy')).toBeNull();
  expect(screen.queryByText(/Called in by/)).toBeNull();
  expect(s.burst).toHaveBeenCalledWith(1600);
});

test('hold phase: the ball close-up and the lower third', () => {
  render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} balls={[]} left={61} elapsed={6000} sound={sound()} />);
  expect(screen.getByText('@CoolGuy')).toBeTruthy();
  expect(screen.getAllByText('Ball 03').length).toBeGreaterThan(0);
  expect(screen.getByText('Called in by @CoolGuy · 61 balls left in the drum')).toBeTruthy();
  expect(screen.getByText('Ball 3: Gates of Olympus, called in by CoolGuy')).toBeTruthy();
});

test('spin phase lands the sound; an unknown drum count drops the "left" clause', () => {
  const s = sound();
  render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} left={null} elapsed={5800} sound={s} />);
  expect(screen.getByText('Called in by @CoolGuy')).toBeTruthy();
  const { rerender } = render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} elapsed={4500} sound={s} />);
  expect(s.land).toHaveBeenCalled();
  rerender(<DrawTakeover entry={ENTRY} rack={[ENTRY]} elapsed={8000} sound={s} />);
});

test('after the reveal it renders nothing', () => {
  const { container } = render(<DrawTakeover entry={ENTRY} rack={[ENTRY]} elapsed={8000} sound={sound()} />);
  expect(container.textContent).toBe('');
});

test('winner card', () => {
  const round = {
    prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
    winner: { ...ENTRY, drawNo: 1, multiplier: 412 },
  };
  render(<WinnerCard round={round} />);
  expect(screen.getByText("Tonight's winning ball")).toBeTruthy();
  expect(screen.getByText('412x')).toBeTruthy();
  expect(screen.getByText('@CoolGuy wins 200 tickets + $5')).toBeTruthy();
  expect(screen.getByText('Results certified by the Goofer Gaming Commission (one guy). Drawn nightly at 4:20.')).toBeTruthy();
});
