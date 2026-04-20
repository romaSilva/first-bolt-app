import type { KnownBlock } from "@slack/web-api";
import { toReadableDate } from "../lib/date.ts";

export interface BroadcastCancelData {
  broadcastId: string;
  title: string;
  scheduledFor: number;
}

export function broadcastCancelConfirm({
  broadcastId,
  title,
  scheduledFor,
}: BroadcastCancelData): { blocks: KnownBlock[] } {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Are you sure you want to cancel this broadcast?\n*${title}* — scheduled for ${toReadableDate(scheduledFor)}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            style: "danger",
            text: { type: "plain_text", text: "Yes, cancel it", emoji: true },
            action_id: "confirm_cancel_broadcast",
            value: JSON.stringify({ broadcastId }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "No, keep it", emoji: true },
            action_id: "deny_cancel_broadcast",
            value: broadcastId,
          },
        ],
      },
    ],
  };
}
