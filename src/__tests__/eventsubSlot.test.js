/**
 * @jest-environment node
 */
import crypto from 'crypto';
import { Readable } from 'stream';
import handler from '../../api/twitch/eventsub.js';
import { __fake } from '../../api/_lib/firebaseAdmin.js';
import { handleSlotCommand } from '../../api/_lib/slotCommand.js';
import { markChatted } from '../../api/_lib/watchtimeStore.js';
import { isFollower } from '../../api/_lib/chatRoles.js';

jest.mock('../../api/_lib/firebaseAdmin.js', () => {
  const { createFakeFirestore } = require('../test/fakeFirestore');
  const fake = createFakeFirestore();
  return { adminDb: fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp, __fake: fake };
});
jest.mock('../../api/_lib/slotCommand.js', () => ({
  ...jest.requireActual('../../api/_lib/slotCommand.js'),
  handleSlotCommand: jest.fn(),
}));
jest.mock('../../api/_lib/watchtimeStore.js', () => ({ markChatted: jest.fn() }));
jest.mock('../../api/_lib/chatRoles.js', () => ({
  ...jest.requireActual('../../api/_lib/chatRoles.js'),
  isFollower: jest.fn(),
}));

const SECRET = 'test-secret';
let seq = 0;

async function post(text) {
  const raw = JSON.stringify({
    subscription: { type: 'channel.chat.message' },
    event: {
      chatter_user_id: 'v1',
      chatter_user_login: 'viewer1',
      chatter_user_name: 'Viewer1',
      broadcaster_user_id: 'b1',
      message_id: 'm1',
      message: { text },
      badges: [],
    },
  });
  seq += 1;
  const id = `msg-${seq}`;
  const ts = new Date().toISOString();
  const sig = crypto.createHmac('sha256', SECRET).update(id + ts + raw).digest('hex');
  const req = Readable.from([Buffer.from(raw)]);
  req.method = 'POST';
  req.headers = {
    'twitch-eventsub-message-id': id,
    'twitch-eventsub-message-timestamp': ts,
    'twitch-eventsub-message-type': 'notification',
    'twitch-eventsub-message-signature': `sha256=${sig}`,
  };
  const res = {
    statusCode: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json() { return this; },
    send() { return this; },
    end() { return this; },
  };
  await handler(req, res);
  return res;
}

beforeEach(() => {
  process.env.TWITCH_EVENTSUB_SECRET = SECRET;
  __fake.reset();
  handleSlotCommand.mockResolvedValue({ handled: true });
  markChatted.mockResolvedValue(undefined);
  isFollower.mockResolvedValue(true);
});

test('a !slot message is handed to the slot command', async () => {
  const res = await post('!slot gates of olympus');
  expect(res.statusCode).toBe(204);
  expect(handleSlotCommand).toHaveBeenCalledTimes(1);
  expect(handleSlotCommand.mock.calls[0][0]).toMatchObject({ chatter_user_id: 'v1', message: { text: '!slot gates of olympus' } });
});

test('other chat is not', async () => {
  await post('hello there');
  expect(handleSlotCommand).not.toHaveBeenCalled();
});

test('a failing !slot never blocks a giveaway entry', async () => {
  handleSlotCommand.mockRejectedValue(new Error('boom'));
  __fake.seed('giveaways/g1', { status: 'open', keyword: 'GOOF', requireFollow: false, weights: {}, entryCount: 0, totalWeight: 0 });
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await post('!slot GOOF');
  spy.mockRestore();
  expect(handleSlotCommand).toHaveBeenCalledTimes(1);
  expect(__fake.read('giveaways/g1/entries/v1')).toBeTruthy();
});
