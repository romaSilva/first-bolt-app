import type { App } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import type { PlainTextOption } from "@slack/web-api";
import { pool } from "../db.ts";
import { buildBroadcastModal } from "../views/broadcastModal.ts";
import { getChannelMembers, postContentMessage } from "../lib/slack.ts";
import { BroadcastStatus } from "../types.ts";
import type { BroadcastMetadata, BroadcastContent } from "../types.ts";
import { broadcastDetail } from "../views/broadcastDetail.ts";
import { broadcastCancelConfirm } from "../views/broadcastCancel.ts";
import {
  buildBroadcastListBlocks,
  type BroadcastRow,
} from "../views/broadcastList.ts";

async function fetchApproverOptions(
  client: WebClient,
  channelId: string,
): Promise<PlainTextOption[]> {
  const memberIds = await getChannelMembers(client, channelId);

  const options: PlainTextOption[] = [];

  await Promise.all(
    memberIds.map(async (userId) => {
      const { user } = await client.users.info({ user: userId });
      if (!user || user.deleted || user.is_bot) return;
      const name =
        user.profile?.display_name_normalized ||
        user.profile?.real_name_normalized ||
        user.name ||
        userId;
      options.push({
        text: { type: "plain_text", text: name, emoji: false },
        value: userId,
      });
    }),
  );

  return options.sort((a, b) =>
    (a.text as { text: string }).text.localeCompare(
      (b.text as { text: string }).text,
    ),
  );
}

export function registerCommandHandlers(app: App): void {
  // ── /ping ─────────────────────────────────────────────────────────────────
  app.command("/ping", async ({ ack, say, command, logger }) => {
    await ack();

    try {
      await pool.query("SELECT 1");
    } catch (error) {
      logger.error("/ping: DB health check failed:", error);
    }

    await say(`Pong, <@${command.user_id}>! 🏓`);
  });

  // ── /broadcast ────────────────────────────────────────────────────────────
  app.command("/broadcast", async ({ ack, client, body, logger }) => {
    await ack();

    const approversChannelId = process.env.APPROVERS_CHANNEL_ID;
    if (!approversChannelId) {
      logger.error(
        "APPROVERS_CHANNEL_ID is not set. Cannot open broadcast modal.",
      );
      return;
    }

    try {
      const approverOptions = await fetchApproverOptions(
        client,
        approversChannelId,
      );
      await client.views.open({
        trigger_id: body.trigger_id,
        view: buildBroadcastModal(approverOptions),
      });
    } catch (error) {
      logger.error("Failed to open broadcast modal:", error);
    }
  });

  // ── /broadcast-list ───────────────────────────────────────────────────────
  app.command("/broadcast-list", async ({ ack, client, command, logger }) => {
    await ack();

    try {
      const { rows } = await pool.query<BroadcastRow>(
        `SELECT id, status, metadata, created_at
         FROM bot.broadcasts
         WHERE metadata->>'requesterId' = $1
         ORDER BY created_at DESC
         LIMIT 15`,
        [command.user_id],
      );

      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `You have ${rows.length} broadcast(s).`,
        blocks: buildBroadcastListBlocks(rows),
      });
    } catch (error) {
      logger.error("/broadcast-list: Failed to fetch broadcasts:", error);
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: "Failed to load your broadcasts. Please try again.",
      });
    }
  });

  // ── /broadcast-cancel ─────────────────────────────────────────────────────
  app.command(
    "/broadcast-cancel",
    async ({ ack, respond, command, logger }) => {
      await ack();

      const broadcastId = command.text.trim();
      if (!broadcastId) {
        await respond({
          response_type: "ephemeral",
          text: "Please provide a broadcast ID: `/broadcast-cancel <broadcast_id>`",
        });
        return;
      }

      try {
        const { rows } = await pool.query<{
          id: string;
          status: BroadcastStatus;
          metadata: BroadcastMetadata;
        }>(
          `SELECT id, status, metadata FROM bot.broadcasts
         WHERE id = $1 AND metadata->>'requesterId' = $2`,
          [broadcastId, command.user_id],
        );

        if (rows.length === 0) {
          await respond({
            response_type: "ephemeral",
            text: `Broadcast \`${broadcastId}\` not found or you don't have permission to cancel it.`,
          });
          return;
        }

        const { status, metadata } = rows[0];
        const terminalStatuses: BroadcastStatus[] = [
          BroadcastStatus.Rejected,
          BroadcastStatus.Delivered,
          BroadcastStatus.Cancelled,
        ];
        if (terminalStatuses.includes(status)) {
          await respond({
            response_type: "ephemeral",
            text: `This broadcast cannot be cancelled — it is already *${status.replace(/_/g, " ")}*.`,
          });
          return;
        }

        await respond({
          response_type: "ephemeral",
          ...broadcastCancelConfirm({
            broadcastId,
            title: metadata.title,
            scheduledFor: metadata.scheduledFor,
          }),
        });
      } catch (error) {
        logger.error("/broadcast-cancel: Failed to load broadcast:", error);
        await respond({
          response_type: "ephemeral",
          text: "Something went wrong. Please try again.",
        });
      }
    },
  );

  // ── /broadcast-view ───────────────────────────────────────────────────────
  app.command("/broadcast-view", async ({ ack, client, command, logger }) => {
    await ack();

    const broadcastId = command.text.trim();
    if (!broadcastId) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: "Please provide a broadcast ID: `/broadcast-view <broadcast_id>`",
      });
      return;
    }

    try {
      const { rows } = await pool.query<{
        status: string;
        metadata: BroadcastMetadata;
        content: BroadcastContent;
      }>(
        `SELECT status, metadata, content FROM bot.broadcasts
         WHERE id = $1 AND metadata->>'requesterId' = $2`,
        [broadcastId, command.user_id],
      );

      if (rows.length === 0) {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: `Broadcast \`${broadcastId}\` not found or you don't have permission to view it.`,
        });
        return;
      }

      const { status, metadata, content } = rows[0];
      const {
        title,
        scheduledFor,
        requesterId,
        channelId,
        audience,
        approvers,
        responders,
      } = metadata;
      const { messageBody, files } = content;

      const { channel: dm } = await client.conversations.open({
        users: command.user_id,
      });
      const dmChannelId = dm!.id!;

      const intro = await client.chat.postMessage({
        channel: dmChannelId,
        ...broadcastDetail({
          broadcastId,
          title,
          status,
          scheduledFor,
          requesterId,
          audience,
          approvers,
          responders,
        }),
      });

      await postContentMessage(
        client,
        dmChannelId,
        intro.ts!,
        messageBody,
        files,
      );

      if (command.channel_id !== dmChannelId) {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: "📬 Broadcast details sent to your DMs.",
        });
      }
    } catch (error) {
      logger.error("/broadcast-view: Failed to fetch broadcast:", error);
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: "Failed to load the broadcast. Please try again.",
      });
    }
  });
}
