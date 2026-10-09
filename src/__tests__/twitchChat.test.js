/**
 * @jest-environment node
 */
import { sendChannelMessage } from '../../api/_lib/twitchChat.js';
import { getBroadcasterAccessToken, helix } from '../../api/_lib/twitchBroadcasterToken.js';

jest.mock('../../api/_lib/twitchBroadcasterToken.js', () => ({
  helix: jest.fn(),
  getBroadcasterAccessToken: jest.fn(),
  getBotAccessToken: jest.fn(),
}));

beforeEach(() => {
  process.env.TWITCH_BROADCASTER_ID = 'b1';
  delete process.env.TWITCH_BOT_ID;
  delete process.env.TWITCH_BOT_REFRESH_TOKEN;
  getBroadcasterAccessToken.mockResolvedValue('tok');
  helix.mockResolvedValue({ data: [{ is_sent: true, message_id: 'm2' }] });
});

test('a reply threads under the viewer message', async () => {
  await sendChannelMessage('hi', { replyTo: 'm1' });
  expect(helix).toHaveBeenCalledWith('POST', '/chat/messages', 'tok', {
    broadcaster_id: 'b1',
    sender_id: 'b1',
    message: 'hi',
    reply_parent_message_id: 'm1',
  });
});

test('a plain message carries no reply field', async () => {
  await sendChannelMessage('hi');
  expect(helix.mock.calls[0][3]).toEqual({ broadcaster_id: 'b1', sender_id: 'b1', message: 'hi' });
});
