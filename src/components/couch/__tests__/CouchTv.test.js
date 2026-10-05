import { act, fireEvent, render, screen } from '@testing-library/react';
import CouchTv from '../CouchTv';
import { STATIC_MS } from '../reel';

const STILL = { kind: 'still', id: 's1', src: '/a.jpg' };
const CARD = { kind: 'card', id: 'card-0', kicker: 'Off air', text: 'Back tomorrow.' };
const VIDEO = { kind: 'video', id: 'v1', sources: { av1: '/v1.webm', h264: '/v1.mp4' }, poster: '/v1.jpg' };
const OFF = { state: 'offair', preview: null, viewers: null, cards: [] };

beforeEach(() => {
  jest.useFakeTimers();
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});
afterEach(() => jest.useRealTimers());

test('waiting shows static and the whole TV is decorative', () => {
  render(<CouchTv tv={{ ...OFF, state: 'waiting' }} items={[]} mode="video" />);
  expect(screen.getByTestId('tv-static')).toBeTruthy();
  expect(screen.getByTestId('couch-tv').getAttribute('aria-hidden')).toBe('true');
});

test('live shows the preview and the tally', () => {
  render(<CouchTv tv={{ state: 'live', preview: '/p-640x360.jpg?p=1', viewers: 214, cards: [] }} items={[STILL]} mode="video" />);
  expect(screen.getByTestId('tv-live').getAttribute('src')).toBe('/p-640x360.jpg?p=1');
  expect(screen.getByText('Live · 214')).toBeTruthy();
  expect(screen.queryByTestId('tv-still')).toBeNull();
});

test('stills advance through a static cut to the card', () => {
  render(<CouchTv tv={OFF} items={[STILL, CARD]} mode="stills" segmentMs={1000} />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/a.jpg');
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByTestId('tv-switch')).toBeTruthy();
  act(() => jest.advanceTimersByTime(STATIC_MS));
  expect(screen.getByTestId('tv-card').textContent).toContain('Back tomorrow.');
});

test('hold mode keeps one still with the sentence and never advances', () => {
  render(<CouchTv tv={OFF} items={[CARD, STILL]} mode="hold" segmentMs={1000} />);
  act(() => jest.advanceTimersByTime(10000));
  expect(screen.getByTestId('tv-still')).toBeTruthy();
  expect(screen.getByText('Back tomorrow.')).toBeTruthy();
  expect(screen.queryByTestId('tv-switch')).toBeNull();
});

test('stills mode shows a loop as its poster', () => {
  render(<CouchTv tv={OFF} items={[VIDEO]} mode="stills" />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/v1.jpg');
});

test('video mode plays muted and reports a refused autoplay', async () => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })));
  const onBlocked = jest.fn();
  render(<CouchTv tv={OFF} items={[VIDEO]} mode="video" onAutoplayBlocked={onBlocked} />);
  const video = screen.getByTestId('tv-video');
  expect(video.muted).toBe(true);
  expect(video.querySelectorAll('source')).toHaveLength(2);
  await act(async () => {});
  expect(onBlocked).toHaveBeenCalled();
});

test('an aborted play is not a refused autoplay', async () => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })));
  const onBlocked = jest.fn();
  render(<CouchTv tv={OFF} items={[VIDEO]} mode="video" onAutoplayBlocked={onBlocked} />);
  await act(async () => {});
  expect(onBlocked).not.toHaveBeenCalled();
});

test('a refusal is reported once even with an inline callback', async () => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.reject(Object.assign(new Error('b'), { name: 'NotAllowedError' })));
  const onBlocked = jest.fn();
  const ui = () => <CouchTv tv={OFF} items={[VIDEO]} mode="video" onAutoplayBlocked={() => onBlocked()} />;
  const { rerender } = render(ui());
  await act(async () => {});
  rerender(ui());
  await act(async () => {});
  expect(onBlocked).toHaveBeenCalledTimes(1);
});

test('items vanishing mid-switch and returning does not crash', () => {
  const { rerender } = render(<CouchTv tv={OFF} items={[STILL, CARD]} mode="stills" segmentMs={1000} />);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByTestId('tv-switch')).toBeTruthy();
  rerender(<CouchTv tv={OFF} items={[]} mode="stills" segmentMs={1000} />);
  act(() => jest.advanceTimersByTime(STATIC_MS * 2));
  rerender(<CouchTv tv={OFF} items={[STILL, CARD]} mode="stills" segmentMs={1000} />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/a.jpg');
});

test('the remote flips the screen to the GSN ident', () => {
  render(<CouchTv tv={OFF} items={[STILL]} mode="stills" flipTo="gsn" />);
  expect(screen.getByTestId('tv-flip').getAttribute('src')).toBe('/gsn/ident.webp');
});

test('a still that fails to load is dropped, and a new src gets a fresh try', () => {
  const { rerender } = render(<CouchTv tv={OFF} items={[STILL]} mode="stills" />);
  fireEvent.error(screen.getByTestId('tv-still'));
  expect(screen.queryByTestId('tv-still')).toBeNull();
  rerender(<CouchTv tv={OFF} items={[{ ...STILL, src: '/b.jpg' }]} mode="stills" />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/b.jpg');
});

test('a live preview that fails to load is dropped', () => {
  render(<CouchTv tv={{ state: 'live', preview: '/dead.jpg', viewers: 3, cards: [] }} items={[]} mode="video" />);
  fireEvent.error(screen.getByTestId('tv-live'));
  expect(screen.queryByTestId('tv-live')).toBeNull();
  expect(screen.getByText('Live · 3')).toBeTruthy();
});
