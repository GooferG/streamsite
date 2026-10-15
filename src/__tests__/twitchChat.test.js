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
  // CRA's Jest loads .env, and the play-test .env sets CHAT_DRY_RUN=1.
  delete process.env.CHAT_DRY_RUN;
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

test('CHAT_DRY_RUN=1 logs the line and never posts', async () => {
  process.env.CHAT_DRY_RUN = '1';
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const res = await sendChannelMessage('Ball 01: Gates of Olympus', { replyTo: 'm1' });
    expect(res).toEqual({ ok: true, twitchMessageId: null, sentAs: 'dry-run' });
    expect(helix).not.toHaveBeenCalled();
    expect(getBroadcasterAccessToken).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toContain('Ball 01: Gates of Olympus');
  } finally {
    delete process.env.CHAT_DRY_RUN;
    log.mockRestore();
  }
});
