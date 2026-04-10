import { randomUUID } from "node:crypto";
import type { App } from "@slack/bolt";
import { pool } from "../db.ts";
import { sendJob } from "../lib/queue.ts";
import { broadcastModal } from "../views/broadcastModal.ts";
import { sendDM } from "../lib/slack.ts";
import { REQUEST_APPROVAL_QUEUE } from "../workers/index.ts";
import { BroadcastStatus } from "../types.ts";
import type {
  BroadcastContent,
  BroadcastMetadata,
  SlackFile,
} from "../types.ts";
import { toReadableDate } from "../lib/date.ts";

interface GenericMessageEvent {
  channel_type: "channel" | "group" | "im" | "mpim";
  thread_ts?: string;
  bot_id?: string;
  text?: string;
  channel: string;
  files?: SlackFile[];
}

export function registerBroadcastCreationHandlers(app: App): void {
  // Triggered when the user fills in and submits the broadcast modal.
  app.view(
    broadcastModal.callback_id!,
    async ({ ack, body, view, client, logger }) => {
      await ack();

      const values = view.state.values;
      const title = values.broadcast_title.title_input.value!;
      const scheduledFor =
        values.broadcast_schedule.schedule_input.selected_date_time!;
      const approvers =
        values.broadcast_approvers["multi_users_select-action"].selected_users!;
      const audience =
        values.broadcast_channels.channels_select.selected_conversations!;

      const readableScheduledFor = toReadableDate(scheduledFor);

      const message = [
        `Hey <@${body.user.id}>! 👋 Your broadcast *${title}* has been registered for ${readableScheduledFor}.`,
        `Reply to this message with the content you want to broadcast. You can attach files too.`,
      ].join("\n");

      const response = await sendDM(client, body.user.id, message);

      const broadcastId = randomUUID();

      const metadata: BroadcastMetadata = {
        channelId: response.channel,
        title,
        scheduledFor,
        requesterId: body.user.id,
        approvers,
        audience,
      };

      await pool.query(
        `INSERT INTO bot.broadcasts (id, status, thread_ts, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          broadcastId,
          BroadcastStatus.Draft,
          response.ts,
          JSON.stringify(metadata),
        ],
      );

      logger.info(
        `Broadcast pending reply — broadcastId: ${broadcastId}, title: "${title}", scheduledFor: "${readableScheduledFor}", thread_ts: ${response.ts}`,
      );
    },
  );

  // The user submits broadcast content by replying to the bot's DM confirmation.
  app.message(async ({ message: rawMessage, client, logger }) => {
    const message = rawMessage as GenericMessageEvent;
    // Only handle user replies inside a DM thread; ignore bot messages and non-thread events.
    if (message.channel_type !== "im" || !message.thread_ts || message.bot_id) {
      return;
    }

    const { rows } = await pool.query<{
      id: string;
      metadata: BroadcastMetadata;
    }>(
      `SELECT id, metadata FROM bot.broadcasts WHERE thread_ts = $1 AND status = $2`,
      [message.thread_ts, BroadcastStatus.Draft],
    );

    if (rows.length === 0) {
      logger.info(
        `No drafted broadcast for thread_ts ${message.thread_ts} — ignoring.`,
      );
      return;
    }

    if (!message.text?.trim()) {
      await client.chat.postMessage({
        channel: message.channel,
        thread_ts: message.thread_ts,
        text: "⚠️ Your reply was empty. Please reply again with the broadcast content.",
      });
      return;
    }

    const { id: broadcastId, metadata } = rows[0];
    const { title, scheduledFor } = metadata;

    const files: SlackFile[] = (
      (message as unknown as { files?: SlackFile[] }).files ?? []
    ).map(({ name, url_private }) => ({ name, url_private }));

    const content: BroadcastContent = {
      messageBody: message.text,
      files,
    };

    await pool.query(
      `UPDATE bot.broadcasts SET status = $1, content = $2, updated_at = now() WHERE id = $3`,
      [BroadcastStatus.PendingApproval, JSON.stringify(content), broadcastId],
    );

    await sendJob(
      REQUEST_APPROVAL_QUEUE,
      {
        broadcastId,
      },
      {
        group: {
          id: broadcastId,
        },
      },
    );

    await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.thread_ts,
      text: `✅ Broadcast registered! Your broadcast ID is \`${broadcastId}\``,
    });

    logger.info(
      `Broadcast job created — broadcastId: ${broadcastId}, title: "${title}", scheduledFor: "${toReadableDate(scheduledFor)}", files: ${files.length}`,
    );
  });
}
