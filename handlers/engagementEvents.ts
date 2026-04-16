import type { App } from "@slack/bolt";
import { pool } from "../db.ts";
import { sendDM } from "../lib/slack.ts";
import type { BroadcastMetadata } from "../types.ts";

interface BroadcastMessageRow {
  broadcast_id: string;
}

interface GenericMessageEvent {
  subtype?: string;
  bot_id?: string;
  thread_ts?: string;
  channel: string;
  ts: string;
  user?: string;
  text?: string;
}

export function registerEngagementEventHandlers(app: App): void {
  app.event("reaction_added", async ({ event, context, logger }) => {
    try {
      const { user, reaction, item } = event;

      if (item.type !== "message") return;
      if (user === context.botUserId) return;

      const { channel, ts } = item;

      const { rows } = await pool.query<BroadcastMessageRow>(
        `SELECT broadcast_id
         FROM bot.broadcast_messages
         WHERE channel_id = $1 AND message_ts = $2`,
        [channel, ts],
      );

      if (!rows.length) return;

      const { broadcast_id } = rows[0];

      await pool.query(
        `INSERT INTO bot.broadcast_reactions (broadcast_id, recipient_id, reaction)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [broadcast_id, user, reaction],
      );

      logger.info(
        `Reaction stored — broadcastId: "${broadcast_id}", user: "${user}", reaction: "${reaction}"`,
      );
    } catch (err) {
      logger.error("Error handling reaction_added event:", err);
    }
  });

  app.event("reaction_removed", async ({ event, context, logger }) => {
    try {
      const { user, reaction, item } = event;

      if (item.type !== "message") return;
      if (user === context.botUserId) return;

      const { channel, ts } = item;

      const { rows } = await pool.query<BroadcastMessageRow>(
        `SELECT broadcast_id
         FROM bot.broadcast_messages
         WHERE channel_id = $1 AND message_ts = $2`,
        [channel, ts],
      );

      if (!rows.length) return;

      const { broadcast_id } = rows[0];

      await pool.query(
        `DELETE FROM bot.broadcast_reactions
         WHERE broadcast_id = $1
           AND recipient_id = $2
           AND reaction = $3`,
        [broadcast_id, user, reaction],
      );

      logger.info(
        `Reaction removed — broadcastId: "${broadcast_id}", user: "${user}", reaction: "${reaction}"`,
      );
    } catch (err) {
      logger.error("Error handling reaction_removed event:", err);
    }
  });

  app.event("message", async ({ event, client, logger }) => {
    try {
      const ev = event as GenericMessageEvent;

      // Ignore bot messages and edited/deleted subtypes
      if (ev.subtype) return;
      if (ev.bot_id) return;

      // Only care about threaded replies
      if (!ev.thread_ts) return;

      const { channel, ts, thread_ts, user, text } = ev;

      const { rows } = await pool.query<BroadcastMessageRow>(
        `SELECT broadcast_id
         FROM bot.broadcast_messages
         WHERE channel_id = $1 AND message_ts = $2
         LIMIT 1`,
        [channel, thread_ts],
      );

      if (!rows.length) return;

      const { broadcast_id } = rows[0];

      await pool.query(
        `INSERT INTO bot.broadcast_replies (
           broadcast_id,
           recipient_id,
           message_ts,
           thread_ts,
           body
         )
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (message_ts) DO NOTHING`,
        [broadcast_id, user, ts, thread_ts, text],
      );

      logger.info(
        `Reply stored — broadcastId: "${broadcast_id}", user: "${user}", ts: "${ts}"`,
      );

      const { rows: broadcastRows } = await pool.query<{
        metadata: BroadcastMetadata;
      }>(`SELECT metadata FROM bot.broadcasts WHERE id = $1`, [broadcast_id]);

      const responders = broadcastRows[0]?.metadata?.responders ?? [];
      if (responders.length > 0) {
        const notification = `New reply to broadcast \`${broadcast_id}\`:\n> ${text}`;
        await Promise.all(
          responders.map((responderId) =>
            sendDM(client, responderId, notification).catch((err) =>
              logger.error(
                `Failed to notify responder ${responderId} for broadcast ${broadcast_id}:`,
                err,
              ),
            ),
          ),
        );
      }
    } catch (err) {
      logger.error("Error handling reply event:", err);
    }
  });
}
