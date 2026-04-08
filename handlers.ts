import { randomUUID } from "node:crypto";
import type { App, BlockAction, ButtonAction } from "@slack/bolt";
import { pool } from "./db.ts";
import { sendJob } from "./lib/queue.ts";
import { broadcastModal } from "./views/broadcastModal.ts";
import { sendDM } from "./lib/slack.ts";
import {
  REQUEST_APPROVAL_QUEUE,
  HANDLE_APPROVAL_QUEUE,
} from "./workers/index.ts";

interface PendingBroadcast {
  title: string;
  scheduleAt: number;
  scheduledDate: string;
  requesterId: string;
  channelId: string;
  approvers: string[];
}

// In-memory store for broadcasts awaiting a reply in the bot DM thread (keyed by bot message ts).
// Entry is created when the modal is submitted, deleted when the user replies with the content.
const pendingBroadcasts = new Map<string, PendingBroadcast>();

interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  url_private: string;
  permalink: string;
}

interface GenericMessageEvent {
  channel_type: "channel" | "group" | "im" | "mpim";
  thread_ts?: string;
  bot_id?: string;
  text?: string;
  channel: string;
  files?: SlackFile[];
}

interface ApprovalActionValue {
  broadcastId: string;
  userId: string;
  scheduledFor: string;
}

/**
 * Registers all Slack event, command, and view handlers on the given Bolt app.
 */
export function registerHandlers(app: App): void {
  // ── /ping ─────────────────────────────────────────────────────────────────
  app.command("/ping", async ({ ack, say, command, logger }) => {
    await ack();

    const { rows } = await pool.query("SELECT version()");
    logger.info(`/ping: DB version: ${rows[0].version}`);

    await say(`Hello, <@${command.user_id}>! DB connected: ${rows[0].version}`);
  });

  // ── /broadcast ────────────────────────────────────────────────────────────
  app.command("/broadcast", async ({ ack, client, body, logger }) => {
    await ack();

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: broadcastModal,
      });
    } catch (error) {
      logger.error("Failed to open broadcast modal:", error);
    }
  });

  // ── Modal submission ───────────────────────────────────────────────────────
  // Triggered when the user fills in and submits the broadcast modal.
  app.view(
    broadcastModal.callback_id!,
    async ({ ack, body, view, client, logger }) => {
      await ack();

      const values = view.state.values;
      const title = values.broadcast_title.title_input.value!;
      const scheduleAt =
        values.broadcast_schedule.schedule_input.selected_date_time!;
      const approvers =
        values.broadcast_approvers["multi_users_select-action"].selected_users!;

      const scheduledDate = new Date(scheduleAt * 1000).toLocaleString(
        "en-US",
        {
          dateStyle: "long",
          timeStyle: "short",
        },
      );

      const message = [
        `Hey <@${body.user.id}>! 👋 Your broadcast *${title}* has been registered for ${scheduledDate}.`,
        `Reply to this message with the content you want to broadcast. You can attach files too.`,
      ].join("\n");

      const response = await sendDM(client, body.user.id, message);

      // Key the pending entry by the bot message ts so the thread-reply handler can look it up.
      pendingBroadcasts.set(response.ts, {
        title,
        scheduleAt,
        scheduledDate,
        requesterId: body.user.id,
        channelId: response.channel,
        approvers,
      });

      logger.info(
        `Broadcast pending reply — title: "${title}", scheduledAt: "${scheduledDate}", thread_ts: ${response.ts}`,
      );
    },
  );

  // ── Broadcast approval actions ────────────────────────────────────────────
  app.action(
    "approve_broadcast",
    async ({ ack, action, body, client, logger }) => {
      await ack();
      const { broadcastId, userId, scheduledFor } = JSON.parse(
        (action as ButtonAction).value!,
      ) as ApprovalActionValue;
      logger.info(
        `Broadcast approved — broadcastId: ${broadcastId}, userId: ${userId}`,
      );

      const blockBody = body as BlockAction;
      const channel = blockBody.channel!.id;
      const messageTs = blockBody.message!.ts!;

      await client.chat.update({
        channel,
        ts: messageTs,
        blocks: blockBody.message!.blocks?.filter(
          (b: { type: string }) => b.type !== "actions",
        ),
      });

      await sendJob(HANDLE_APPROVAL_QUEUE, {
        broadcastId,
        approved: true,
        approverId: body.user.id,
        requesterId: userId,
        scheduledFor,
      });

      await client.chat.postMessage({
        channel,
        thread_ts: messageTs,
        text: `✅ Answer saved: *Approved* by <@${body.user.id}>.`,
      });
    },
  );

  app.action(
    "reject_broadcast",
    async ({ ack, action, body, client, logger }) => {
      await ack();
      const { broadcastId, userId, scheduledFor } = JSON.parse(
        (action as ButtonAction).value!,
      ) as ApprovalActionValue;
      logger.info(
        `Broadcast rejected — broadcastId: ${broadcastId}, userId: ${userId}`,
      );

      const blockBody = body as BlockAction;
      const channel = blockBody.channel!.id;
      const messageTs = blockBody.message!.ts!;

      await client.chat.update({
        channel,
        ts: messageTs,
        blocks: blockBody.message!.blocks?.filter(
          (b: { type: string }) => b.type !== "actions",
        ),
      });

      await sendJob(HANDLE_APPROVAL_QUEUE, {
        broadcastId,
        approved: false,
        approverId: body.user.id,
        requesterId: userId,
        scheduledFor,
      });

      await client.chat.postMessage({
        channel,
        thread_ts: messageTs,
        text: `❌ Answer saved: *Rejected* by <@${body.user.id}>.`,
      });
    },
  );

  // ── DM thread reply ────────────────────────────────────────────────────────
  // The user submits broadcast content by replying to the bot's DM confirmation.
  app.message(async ({ message: rawMessage, client, logger }) => {
    const message = rawMessage as GenericMessageEvent;
    // Only handle user replies inside a DM thread; ignore bot messages and non-thread events.
    if (message.channel_type !== "im" || !message.thread_ts || message.bot_id) {
      return;
    }

    const pending = pendingBroadcasts.get(message.thread_ts);
    if (!pending) {
      logger.info(
        `No pending broadcast for thread_ts ${message.thread_ts} — ignoring.`,
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

    pendingBroadcasts.delete(message.thread_ts);

    const { title, scheduledDate, requesterId, approvers } = pending;

    const files = (
      (message as unknown as { files?: SlackFile[] }).files ?? []
    ).map(({ id, name, mimetype, url_private, permalink }) => ({
      id,
      name,
      mimetype,
      url_private,
      permalink,
    }));

    // Pre-generate the broadcast ID so it can serve as both the PgBoss job ID
    // and a stable correlation ID that downstream jobs can reference.
    const broadcastId = randomUUID();

    await sendJob(
      REQUEST_APPROVAL_QUEUE,
      {
        broadcastId,
        title,
        scheduledFor: scheduledDate,
        messageBody: message.text,
        files,
        requesterId,
        approvers,
        channelId: message.channel,
        threadTs: message.thread_ts,
      },
      { id: broadcastId },
    );

    await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.thread_ts,
      text: `✅ Broadcast registered! Your broadcast ID is \`${broadcastId}\``,
    });

    logger.info(
      `Broadcast job created — broadcastId: ${broadcastId}, title: "${title}", scheduledFor: "${scheduledDate}", files: ${files.length}`,
    );
  });
}
