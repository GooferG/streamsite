import { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SlotAutocomplete from '../SlotAutocomplete';
import { __resetSlotCatalogForTests } from '../../hooks/useSlotCatalog';

const ROWS = [
  { name: 'Gates of Olympus', provider: 'pragmatic-play', rainbetSlug: 'pp-gates', thumb: 'https://cdn.rainbet.com/slots/Gates%20of%20Olympus.png' },
  { name: 'Sugar Mix', provider: 'bgaming', rainbetSlug: 'bg-sugar', thumb: null },
];

function Harness({ onSelect }) {
  const [value, setValue] = useState('');
  return <SlotAutocomplete value={value} onChange={setValue} onSelect={onSelect} aria-label="Slot" />;
}

beforeEach(() => {
  __resetSlotCatalogForTests();
});

// Review fix: the selected slot carries the thumbnail exactly as upstream sent it.
test('suggests fetched slots and selects one with display provider and upstream art', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ slots: ROWS }) })
  );
  const onSelect = jest.fn();
  render(<Harness onSelect={onSelect} />);
  const input = screen.getByLabelText('Slot');
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/slots'));
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'gates' } });
  const option = await screen.findByText('Gates of Olympus');
  expect(screen.getByText('Pragmatic Play')).toBeTruthy();
  fireEvent.mouseDown(option);
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Gates of Olympus',
      provider: 'Pragmatic Play',
      thumbnail: 'https://cdn.rainbet.com/slots/Gates%20of%20Olympus.png',
    })
  );
  expect(input.value).toBe('Gates of Olympus');
});

// Review Focus 5: typed before the list arrived → suggestions appear on arrival.
test('suggestions appear when the catalogue arrives after typing', async () => {
  let resolveFetch;
  global.fetch = jest.fn(
    () => new Promise((resolve) => { resolveFetch = resolve; })
  );
  render(<Harness onSelect={() => {}} />);
  const input = screen.getByLabelText('Slot');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'sugar' } });
  expect(screen.queryByText('Sugar Mix')).toBeNull();
  await act(async () => {
    resolveFetch({ ok: true, status: 200, json: () => Promise.resolve({ slots: ROWS }) });
  });
  expect(await screen.findByText('Sugar Mix')).toBeTruthy();
});

// Review Focus 3: offline catalogue still allows free typing.
test('free typing works when the catalogue fails to load', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) })
  );
  render(<Harness onSelect={() => {}} />);
  const input = screen.getByLabelText('Slot');
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'My custom slot' } });
  expect(input.value).toBe('My custom slot');
  expect(screen.queryByRole('listbox')).toBeNull();
});
