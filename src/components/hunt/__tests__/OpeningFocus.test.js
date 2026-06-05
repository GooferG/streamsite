import { render, screen, fireEvent } from '@testing-library/react';
import OpeningFocus from '../OpeningFocus';

const ORDER = [
  { id: 'a', slot: 'Big Bass', stake: 10, win: 0, caller: 'Ana' },
  { id: 'b', slot: 'Gates', stake: 20, win: 0, caller: 'Bo' },
];

test('shows current slot name and computes live multiplier on payout entry', () => {
  const onWin = jest.fn();
  render(
    <OpeningFocus order={ORDER} idx={0} openedCount={0}
      onWin={onWin} onNote={() => {}} onPrev={() => {}} onNext={() => {}}
      onDefer={() => {}} onExit={() => {}} onFinish={() => {}} />
  );
  expect(screen.getByText('Big Bass')).toBeTruthy();
  const payout = screen.getByLabelText(/payout/i);
  fireEvent.change(payout, { target: { value: '1000' } });
  expect(onWin).toHaveBeenCalledWith('a', '1000');
});

test('renders the live multiplier from the current bonus win/stake', () => {
  // bonus 'a' already has a win of 1000 over stake 10 = 100.00x
  const ORDER2 = [{ id: 'a', slot: 'Big Bass', stake: 10, win: 1000, caller: 'Ana' }];
  render(
    <OpeningFocus order={ORDER2} idx={0} openedCount={1}
      onWin={() => {}} onNote={() => {}} onPrev={() => {}} onNext={() => {}}
      onDefer={() => {}} onExit={() => {}} onFinish={() => {}} />
  );
  expect(screen.getByText(/100\.00x/)).toBeTruthy();
});

test('last bonus shows Finish opening and calls onFinish', () => {
  const onFinish = jest.fn();
  render(
    <OpeningFocus order={ORDER} idx={1} openedCount={1}
      onWin={() => {}} onNote={() => {}} onPrev={() => {}} onNext={() => {}}
      onDefer={() => {}} onExit={() => {}} onFinish={onFinish} />
  );
  const finishBtn = screen.getByRole('button', { name: /finish opening/i });
  fireEvent.click(finishBtn);
  expect(onFinish).toHaveBeenCalled();
});
