import type { PgBoss } from "pg-boss";
import type { WebClient } from "@slack/web-api";
import type { Logger } from "@slack/bolt";
import { pool } from "../db.ts";
import { BroadcastStatus } from "../types.ts";
import type { BroadcastMetadata } from "../types.ts";
import { DELIVER_QUEUE } from "./index.ts";
import { sendDM } from "../lib/slack.ts";
import { toReadableDate } from "../lib/date.ts";

export const QUEUE = "broadcast.mark-delivered";

const CRON_EVERY_2_MINUTES = "*/2 * * * *";

interface DeliveryCheckResult {
  ready: boolean;
  total: number;
}

interface DeliveryStats {
  delivered: number;
  attempted: number;
}

async function isReadyToDeliver(
  broadcastId: string,
): Promise<DeliveryCheckResult> {
  const { rows } = await pool.query<{ total: string; terminal: string }>(
    `SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE state IN ('completed', 'cancelled', 'failed')) AS terminal
    FROM pgboss.job
    WHERE name = $1
      AND group_id = $2`,
    [DELIVER_QUEUE, broadcastId],
  );

  const total = parseInt(rows[0].total, 10);
  const terminal = parseInt(rows[0].terminal, 10);

  return { ready: total > 0 && total === terminal, total };
}

async function markAsDelivered(broadcastId: string): Promise<void> {
  await pool.query(
    `UPDATE bot.broadcasts
     SET status = $1, updated_at = now()
     WHERE id = $2`,
    [BroadcastStatus.Delivered, broadcastId],
  );
}

async function gatherDeliveryStats(
  broadcastId: string,
  attempted: number,
): Promise<DeliveryStats> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM bot.broadcast_messages WHERE broadcast_id = $1`,
    [broadcastId],
  );

  return {
    delivered: parseInt(rows[0].count, 10),
    attempted,
  };
}

async function sendDeliveryReport(
  requesterId: string,
  title: string,
  scheduledFor: number,
  stats: DeliveryStats,
  client: WebClient,
  logger: Logger,
): Promise<void> {
  const text = [
    `📊 *Broadcast delivered: "${title}"*`,
    `Scheduled for: ${toReadableDate(scheduledFor)}`,
    ``,
    `• 📨 Delivered to *${stats.delivered} of ${stats.attempted}* recipients`,
  ].join("\n");

  try {
    await sendDM(client, requesterId, text);
    logger.info(`Delivery report sent to requester "${requesterId}".`);
  } catch (error) {
    // Report failures are non-fatal — the broadcast status was already updated.
    logger.error(
      `Failed to send delivery report to requester "${requesterId}".`,
      error,
    );
  }
}

export async function register(
  boss: PgBoss,
  client: WebClient,
  logger: Logger,
): Promise<void> {
  await boss.createQueue(QUEUE);
  await boss.schedule(QUEUE, CRON_EVERY_2_MINUTES, {});

  await boss.work(QUEUE, async ([job]) => {
    logger.info(`Processing mark-delivered job ${job.id}`);

    try {
      const { rows: approvedBroadcasts } = await pool.query<{
        id: string;
        metadata: BroadcastMetadata;
      }>(`SELECT id, metadata FROM bot.broadcasts WHERE status = $1`, [
        BroadcastStatus.Approved,
      ]);

      if (approvedBroadcasts.length === 0) {
        logger.info(
          `Mark-delivered job ${job.id} — no approved broadcasts found.`,
        );
        return;
      }

      logger.info(
        `Mark-delivered job ${job.id} — checking ${approvedBroadcasts.length} approved broadcast(s).`,
      );

      for (const broadcast of approvedBroadcasts) {
        const { id: broadcastId, metadata } = broadcast;
        const { requesterId, title, scheduledFor } = metadata;

        const { ready, total } = await isReadyToDeliver(broadcastId);

        if (!ready) {
          logger.info(
            `Mark-delivered job ${job.id} — broadcastId "${broadcastId}" not ready yet (${total} deliver job(s) pending), skipping.`,
          );
          continue;
        }

        await markAsDelivered(broadcastId);
        logger.info(
          `Mark-delivered job ${job.id} — broadcastId "${broadcastId}" marked as delivered.`,
        );

        const stats = await gatherDeliveryStats(broadcastId, total);
        await sendDeliveryReport(
          requesterId,
          title,
          scheduledFor,
          stats,
          client,
          logger,
        );
      }
    } catch (error) {
      logger.error(`Failed to process mark-delivered job ${job.id}`, error);
      throw error;
    }
  });
}
