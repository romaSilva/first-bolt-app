import type { KnownBlock } from "@slack/web-api";
import { toReadableDate } from "../lib/date.ts";

export interface ApprovalMessageMetadata {
  broadcastId: string;
  title: string;
  scheduledFor: number;
  requesterId: string;
  audience: string[];
}

export function approvalMessage({
  broadcastId,
  title,
  scheduledFor,
  requesterId,
  audience,
}: ApprovalMessageMetadata): { text: string; blocks: KnownBlock[] } {
  const metadata: ApprovalMessageMetadata = {
    broadcastId,
    title,
    scheduledFor,
    requesterId,
    audience,
  };
  const buttonValue = JSON.stringify(metadata);

  return {
    text: `📋 Approval request from <@${requesterId}>: *${title}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Broadcast Approval Request*\n\nYou have a pending approval from <@${requesterId}>.`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Title*: ${title}\n*Scheduled For*: ${toReadableDate(scheduledFor)}\n*Broadcast ID*: \`${broadcastId}\`\n*Requested By*: <@${requesterId}>\n*Audience*: ${audience.map((c) => `<#${c}>`).join(", ")}`,
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
