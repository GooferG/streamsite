import { useState } from 'react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useUserDoc } from '../hooks/useUserDoc';
import useDailyDrop from '../hooks/useDailyDrop';
import { discordAuthUrl } from '../utils/discordAuth';
import StoreFront from '../components/store/StoreFront';
import useStoreItems from '../components/store/useStoreItems';
import useMyOrders from '../components/store/useMyOrders';
import useStoreFeed from '../components/store/useStoreFeed';
import useOrder from '../components/store/useOrder';

// /store: the Goofer Shopping Network. Wires live data into StoreFront.
let readFixture = () => null;
if (process.env.NODE_ENV !== 'production') {
  // Dev-only: /store?fixture=rich|short|signedout|loading|empty|soldout|received|busy
  // renders the store from storeFixtures. Webpack drops this branch, and the
  // fixture module with it, from production builds.
  readFixture = () => {
    const key = new URLSearchParams(window.location.search).get('fixture');
    if (!key) return null;
    return require('../components/store/storeFixtures').STORE_FIXTURES[key] || null;
  };
}

const readItemParam = () => new URLSearchParams(window.location.search).get('item');

// Tuning keeps ?item= in the address bar, so a link to one item can go in
// chat. replaceState: flipping channels adds no history entries.
function writeItemParam(id) {
  const url = new URL(window.location.href);
  url.searchParams.set('item', id);
  window.history.replaceState(window.history.state, '', url);
}

const noop = () => {};

function LiveStore({ isLive }) {
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const { user, loading: userLoading } = useUserDoc();
  const { items, error } = useStoreItems();
  const orders = useMyOrders(twitchUser && twitchUser.twitchId);
  const feed = useStoreFeed();
  const order = useOrder();
  const daily = useDailyDrop(user);
  const [initialItemId] = useState(readItemParam);
  return (
    <StoreFront
      items={items}
      itemsError={error}
      viewer={twitchUser}
      user={user}
      userLoading={userLoading}
      orders={orders}
      feed={feed}
      isLive={isLive}
      order={order}
      onOrder={order.order}
      onResetOrder={order.reset}
      daily={daily}
      onClaimDaily={daily.claim}
      discordUrl={discordAuthUrl()}
      onSignIn={loginWithTwitch}
      initialItemId={initialItemId}
      onTuneChange={writeItemParam}
    />
  );
}

export default function StorePage({ isLive = false }) {
  const [fixture] = useState(readFixture);
  return (
    <div className="relative min-h-screen px-4 pb-20 pt-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {fixture ? (
          <StoreFront onOrder={noop} onResetOrder={noop} onClaimDaily={noop} onSignIn={noop} {...fixture} />
        ) : (
          <LiveStore isLive={isLive} />
        )}
      </div>
    </div>
  );
}
