/**
 * Opens a DM channel with a user and posts a message.
 * Returns the full chat.postMessage response so callers can access `ts` and `channel`.
 *
 * @param {import("@slack/bolt").App["client"]} client - Slack Web API client
 * @param {string} userId - Slack user ID to DM
 * @param {string} text - Message text (supports mrkdwn)
 */
export async function sendDM(client, userId, text) {
  const { channel } = await client.conversations.open({ users: userId });
  return client.chat.postMessage({ channel: channel.id, text });
}
