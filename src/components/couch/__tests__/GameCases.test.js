import { render } from '@testing-library/react';
import GameCases from '../GameCases';
import { LAYOUT, pctStyle, within } from '../couchLayout';

const cover = (n) => ({ appid: n, name: `Game ${n}`, cover: `/c${n}.jpg` });

test('one spine per case box on the shelf, newest first, hidden from screen readers', () => {
  const { container } = render(<GameCases covers={[cover(1), cover(2), cover(3), cover(4)]} />);
  const spines = container.querySelectorAll('[data-case]');
  expect(spines).toHaveLength(LAYOUT.doors.games.cases.length);
  expect([...spines].map((s) => s.querySelector('img').getAttribute('src'))).toEqual(['/c1.jpg', '/c2.jpg', '/c3.jpg']);
  expect(container.firstChild.getAttribute('aria-hidden')).toBe('true');
});

test('each spine sits exactly on its case box in the art', () => {
  const { container } = render(<GameCases covers={[cover(1), cover(2), cover(3)]} />);
  const box = LAYOUT.doors.games;
  [...container.querySelectorAll('[data-case]')].forEach((spine, i) => {
    const want = pctStyle(within(box.rect, box.cases[i]));
    expect([spine.style.left, spine.style.top, spine.style.width, spine.style.height]).toEqual([want.left, want.top, want.width, want.height]);
  });
});

test("the game's name runs up the spine", () => {
  const { getByText } = render(<GameCases covers={[cover(1)]} />);
  expect(getByText('Game 1').className).toContain('[writing-mode:vertical-rl]');
});

test('a game without a cover is left off the shelf', () => {
  const { container } = render(<GameCases covers={[{ appid: 9, name: 'x', cover: null }, cover(2)]} />);
  const spines = container.querySelectorAll('[data-case]');
  expect(spines).toHaveLength(1);
  expect(spines[0].querySelector('img').getAttribute('src')).toBe('/c2.jpg');
});

test('no covers, no spines', () => {
  const { container } = render(<GameCases covers={[]} />);
  expect(container.firstChild).toBeNull();
});
