import type { KnownBlock } from "@slack/web-api";
import { toReadableDate } from "../lib/date.ts";

export interface BroadcastDetailData {
  broadcastId: string;
  title: string;
  status: string;
  scheduledFor: number;
  requesterId: string;
  audience: string[];
  approvers: string[];
  responders?: string[];
}

export function broadcastDetail({
  broadcastId,
  title,
  status,
  scheduledFor,
  requesterId,
  audience,
  approvers,
  responders,
}: BroadcastDetailData): { text: string; blocks: KnownBlock[] } {
  const approverList = approvers.map((id) => `<@${id}>`).join(", ") || "_None_";
  const responderList =
    responders && responders.length > 0
      ? responders.map((id) => `<@${id}>`).join(", ")
      : "_None_";

  return {
    text: `📋 Broadcast details: *${title}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Broadcast Details*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*Title*: ${title}`,
            `*Status*: ${status.replace(/_/g, " ")}`,
            `*Scheduled For*: ${toReadableDate(scheduledFor)}`,
            `*Broadcast ID*: \`${broadcastId}\``,
            `*Requested By*: <@${requesterId}>`,
            `*Audience*: ${audience.map((c) => `<#${c}>`).join(", ")}`,
            `*Approvers*: ${approverList}`,
            `*Responders*: ${responderList}`,
          ].join("\n"),
        },
      },
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💬 The broadcast content is in the thread below.",
          },
        ],
      },
    ],
  };
}
