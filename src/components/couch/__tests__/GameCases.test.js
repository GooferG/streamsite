import { render } from '@testing-library/react';
import GameCases from '../GameCases';

const cover = (n) => ({ appid: n, cover: `/c${n}.jpg` });

test('up to three cases, newest in front, hidden from screen readers', () => {
  const { container } = render(<GameCases covers={[cover(1), cover(2), cover(3), cover(4)]} />);
  const cases = container.querySelectorAll('[data-case]');
  expect(cases).toHaveLength(3);
  expect([...cases].map((c) => c.querySelector('img').getAttribute('src'))).toEqual(['/c1.jpg', '/c2.jpg', '/c3.jpg']);
  expect(Number(cases[0].style.zIndex)).toBeGreaterThan(Number(cases[2].style.zIndex));
  expect(container.firstChild.getAttribute('aria-hidden')).toBe('true');
});

test('the cases fill the games box: the last one ends at its right edge', () => {
  const { container } = render(<GameCases covers={[cover(1), cover(2), cover(3)]} />);
  const last = container.querySelectorAll('[data-case]')[2];
  expect(parseFloat(last.style.left) + parseFloat(last.style.width)).toBeCloseTo(100, 5);
});

test('no covers, no cases', () => {
  const { container } = render(<GameCases covers={[]} />);
  expect(container.firstChild).toBeNull();
});

test('one case stands upright at the left with no shade', () => {
  const { container } = render(<GameCases covers={[cover(1)]} />);
  const only = container.querySelector('[data-case]');
  expect(only.style.left).toBe('0%');
  expect(only.style.transform).toBe('rotate(0deg)');
  expect(only.querySelector('.couch-case-shade')).toBeNull();
});

test('the cases behind lean on the one in front', () => {
  const { container } = render(<GameCases covers={[cover(1), cover(2), cover(3)]} />);
  expect([...container.querySelectorAll('[data-case]')].map((c) => c.style.transform)).toEqual(['rotate(0deg)', 'rotate(3deg)', 'rotate(6deg)']);
});

test('a game without a cover is left off the shelf', () => {
  const { container } = render(<GameCases covers={[{ appid: 9, cover: null }, cover(2)]} />);
  const cases = container.querySelectorAll('[data-case]');
  expect(cases).toHaveLength(1);
  expect(cases[0].querySelector('img').getAttribute('src')).toBe('/c2.jpg');
});
