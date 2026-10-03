import { fireEvent, render, screen } from '@testing-library/react';
import Lineup from '../Lineup';
import EarnPanel from '../EarnPanel';
import OrdersPanel from '../OrdersPanel';
import { lineup } from '../storeModel';

const ITEMS = lineup([
  { id: 'blunt', name: 'Roll a blunt', cost: 420, kind: 'stream', stock: null, sortOrder: 0 },
  { id: 'slot', name: 'Pick a Slot', cost: 1500, kind: 'stream', stock: null, sortOrder: 0 },
  { id: 'bonus', name: 'Bonus buy', cost: 10000, kind: 'stream', stock: 0, sortOrder: 0 },
]);
const VIEWER = { twitchId: 'v1', displayName: 'GooferFan' };
const NOW = 1_800_000_000_000;

describe('Lineup', () => {
  test('every item is a tunable card that says where you stand', () => {
    const onTune = jest.fn();
    render(<Lineup items={ITEMS} tunedId="blunt" balance={1080} onTune={onTune} />);
    expect(screen.getByRole('heading', { name: 'Everything on tonight' })).toBeTruthy();
    expect(screen.getByText('3 channels')).toBeTruthy();
    const blunt = screen.getByRole('button', { name: 'Roll a blunt, 420 tickets, you can order' });
    expect(blunt.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Pick a Slot, 1,500 tickets, 420 short' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bonus buy, 10,000 tickets, sold out' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Pick a Slot/ }));
    expect(onTune).toHaveBeenCalledWith('slot');
  });

  test('signed out cards carry no affordability status', () => {
    render(<Lineup items={ITEMS.slice(0, 2)} tunedId="blunt" balance={null} onTune={() => {}} />);
    expect(screen.getByRole('button', { name: 'Roll a blunt, 420 tickets' })).toBeTruthy();
    expect(screen.getByText('2 channels')).toBeTruthy();
  });
});

describe('EarnPanel', () => {
  const ready = { ready: true, nextAt: null, remainingMs: 0, claiming: false, error: null };

  test('a ready daily drop can be claimed in place', () => {
    const onClaim = jest.fn();
    render(<EarnPanel viewer={VIEWER} user={{ watchMinutes: 845 }} daily={ready} onClaim={onClaim} discordUrl="https://discord.test/x" />);
    expect(screen.getByText('Ready to claim')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Claim +10' }));
    expect(onClaim).toHaveBeenCalled();
    expect(screen.getByText('14h 5m watched')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Link Discord' }).getAttribute('href')).toBe('https://discord.test/x');
  });

  test('cooldown shows when the next drop lands; a linked Discord says so', () => {
    const daily = { ready: false, nextAt: NOW, remainingMs: (5 * 60 + 12) * 60000, claiming: false, error: null };
    render(<EarnPanel viewer={VIEWER} user={{ discordId: 'd1' }} daily={daily} onClaim={() => {}} />);
    expect(screen.getByText('Next drop in 5h 12m')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Claim +10' })).toBeNull();
    expect(screen.getByText('Linked')).toBeTruthy();
  });

  test('signed out explains the ways and offers sign-in', () => {
    const onSignIn = jest.fn();
    render(<EarnPanel viewer={null} user={null} daily={null} onSignIn={onSignIn} />);
    expect(screen.getByText('+10 once a day')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Twitch' }));
    expect(onSignIn).toHaveBeenCalled();
    expect(document.getElementById('store-earn')).toBeTruthy();
  });
});

describe('OrdersPanel', () => {
  test('orders read as called in, aired, granted or refunded', () => {
    const orders = [
      { id: 'a', itemName: 'Roll a blunt', kind: 'stream', status: 'pending', createdAt: new Date(NOW - 8 * 60000) },
      { id: 'b', itemName: 'Pick a Slot', kind: 'stream', status: 'fulfilled', createdAt: new Date(NOW - 3 * 3600000) },
      { id: 'c', itemName: 'Badge', kind: 'virtual', status: 'fulfilled', createdAt: new Date(NOW - 26 * 3600000) },
      { id: 'd', itemName: 'Pick a Slot', kind: 'stream', status: 'cancelled', createdAt: new Date(NOW - 50 * 3600000) },
    ];
    render(<OrdersPanel orders={orders} now={NOW} />);
    expect(screen.getByRole('heading', { name: 'On the list' })).toBeTruthy();
    expect(screen.getByText('Called in')).toBeTruthy();
    expect(screen.getByText('Aired')).toBeTruthy();
    expect(screen.getByText('Granted')).toBeTruthy();
    expect(screen.getByText('Refunded').className).toContain('text-onair-loss');
    expect(screen.getByText('8m ago')).toBeTruthy();
    expect(screen.getByText('See everything on your account')).toBeTruthy();
  });

  test('no orders yet', () => {
    render(<OrdersPanel orders={[]} now={NOW} />);
    expect(screen.getByText('Nothing called in yet.')).toBeTruthy();
  });
});
