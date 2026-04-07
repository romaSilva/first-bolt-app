/**
 * Builds the introductory approval DM with broadcast metadata and approve/reject buttons.
 * The actual broadcast content is posted as a reply in the thread.
 *
 * @param {object} params
 * @param {string} params.broadcastId
 * @param {string} params.title
 * @param {string} params.scheduledFor
 * @param {string} params.userId - Slack user ID of the broadcast creator
 * @returns {{ text: string, blocks: object[] }}
 */
export function approvalMessage({ broadcastId, title, scheduledFor, userId }) {
  const buttonValue = JSON.stringify({ broadcastId, userId });

  return {
    text: `📋 Approval request from <@${userId}>: *${title}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Broadcast Approval Request*\n\nYou have a pending approval from <@${userId}>.`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Title*: ${title}\n*Scheduled For*: ${scheduledFor}\n*Broadcast ID*: \`${broadcastId}\`\n*Requested By*: <@${userId}>`,
        },
      },
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💬 The message to be broadcast is in the thread below.",
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "✅ Approve", emoji: true },
            style: "primary",
            action_id: "approve_broadcast",
            value: buttonValue,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "❌ Reject", emoji: true },
            style: "danger",
            action_id: "reject_broadcast",
            value: buttonValue,
          },
        ],
      },
    ],
  };
}
