import { randomUUID } from "node:crypto";
import { pool } from "./db.js";
import { boss } from "./boss.js";
import { broadcastModal } from "./views/broadcastModal.js";
import { sendDM } from "./lib/slack.js";
import { QUEUE } from "./worker.js";

// In-memory store for broadcasts awaiting a reply in the bot DM thread (keyed by bot message ts).
// Entry is created when the modal is submitted, deleted when the user replies with the content.
const pendingBroadcasts = new Map();

/**
 * Registers all Slack event, command, and view handlers on the given Bolt app.
 * @param {import("@slack/bolt").App} app
 */
export function registerHandlers(app) {
  // ── /ping ─────────────────────────────────────────────────────────────────
  app.command("/ping", async ({ ack, say, client, command, logger }) => {
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
    broadcastModal.callback_id,
    async ({ ack, body, view, client, logger }) => {
      await ack();

      const values = view.state.values;
      const title = values.broadcast_title.title_input.value;
      const scheduleAt =
        values.broadcast_schedule.schedule_input.selected_date_time;
      const approvers =
        values.broadcast_approvers["multi_users_select-action"].selected_users;

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
        userId: body.user.id,
        channelId: response.channel,
        approvers,
      });

      logger.info(
        `Broadcast pending reply — title: "${title}", scheduledAt: "${scheduledDate}", thread_ts: ${response.ts}`,
      );
    },
  );

  // ── DM thread reply ────────────────────────────────────────────────────────
  // The user submits broadcast content by replying to the bot's DM confirmation.
  app.message(async ({ message, client, logger }) => {
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

    const { title, scheduledDate, userId, approvers } = pending;

    const files = (message.files ?? []).map(
      ({ id, name, mimetype, url_private, permalink }) => ({
        id,
        name,
        mimetype,
        url_private,
        permalink,
      }),
    );

    // Pre-generate the broadcast ID so it can serve as both the PgBoss job ID
    // and a stable correlation ID that downstream jobs can reference.
    const broadcastId = randomUUID();

    await boss.send(
      QUEUE,
      {
        broadcastId,
        title,
        scheduledFor: scheduledDate,
        messageBody: message.text,
        files,
        userId,
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
