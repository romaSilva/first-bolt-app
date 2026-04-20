import type { KnownBlock } from "@slack/web-api";
import type { BroadcastStatus, BroadcastMetadata } from "../types.ts";
import { toReadableDate } from "../lib/date.ts";

const STATUS_EMOJI: Record<string, string> = {
  draft: "📋",
  pending_approval: "⏳",
  approved: "✅",
  rejected: "❌",
  delivered: "📣",
  cancelled: "🚫",
};

export interface BroadcastRow {
  id: string;
  status: BroadcastStatus;
  metadata: BroadcastMetadata;
  created_at: Date;
}

export function buildBroadcastListBlocks(rows: BroadcastRow[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Your Broadcasts (${rows.length})*`,
      },
    },
  ];

  if (rows.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "You have no broadcasts yet." },
    });
    return blocks;
  }

  for (const row of rows) {
    const { metadata, status, id } = row;
    const emoji = STATUS_EMOJI[status] ?? "❓";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${metadata.title}*`,
          `${emoji} ${status.replace(/_/g, " ")}   •   📅 ${toReadableDate(metadata.scheduledFor)}`,
          `ID: \`${id}\``,
        ].join("\n"),
      },
    });
    blocks.push({ type: "divider" });
  }

  return blocks;
}
