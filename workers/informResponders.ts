import type { PgBoss } from "pg-boss";
import type { WebClient } from "@slack/web-api";
import type { Logger } from "@slack/bolt";
import { pool } from "../db.ts";
import { postContentMessage } from "../lib/slack.ts";
import { sendJob } from "../lib/queue.ts";
import { REQUEST_APPROVAL_QUEUE } from "./index.ts";
import type {
  InformRespondersJobData,
  BroadcastMetadata,
  BroadcastContent,
} from "../types.ts";
import { toReadableDate } from "../lib/date.ts";

export const QUEUE = "broadcast.inform-responders";

export async function register(
  boss: PgBoss,
  client: WebClient,
  logger: Logger,
): Promise<void> {
  await boss.createQueue(QUEUE);

  await boss.work<InformRespondersJobData>(QUEUE, async ([job]) => {
    const { broadcastId } = job.data;

    logger.info(
      `Processing inform-responders job ${job.id} — broadcastId: "${broadcastId}"`,
    );

    try {
      const { rows } = await pool.query<{
        metadata: BroadcastMetadata;
        content: BroadcastContent;
      }>(`SELECT metadata, content FROM bot.broadcasts WHERE id = $1`, [
        broadcastId,
      ]);

      if (rows.length === 0) {
        logger.error(
          `inform-responders job ${job.id} — broadcast not found for broadcastId: "${broadcastId}". Skipping.`,
        );
        return;
      }

      const { metadata, content } = rows[0];
      const { title, scheduledFor, requesterId, responders } = metadata;
      const { messageBody, files } = content;

      if (responders && responders.length > 0) {
        const { channel } = await client.conversations.open({
          users: responders.join(","),
        });

        const channelId = channel!.id!;

        const intro = await client.chat.postMessage({
          channel: channelId,
          text: `📣 You are the designated responders for the broadcast *${title}*.`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Broadcast Responders Briefing*\n\nYou have been assigned as a responder for the following broadcast.`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Title*: ${title}\n*Scheduled For*: ${toReadableDate(scheduledFor)}\n*Broadcast ID*: \`${broadcastId}\`\n*Requested By*: <@${requesterId}>`,
              },
            },
            { type: "divider" },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "💬 Recipients may reply to the broadcast. Any replies will be forwarded here so you can respond on their behalf. The content to be broadcast is in the thread below.",
                },
              ],
            },
          ],
        });

        await postContentMessage(
          client,
          channelId,
          intro.ts!,
          messageBody,
          files,
        );

        await pool.query(
          `INSERT INTO bot.broadcast_responder_threads (broadcast_id, channel_id, thread_ts)
           VALUES ($1, $2, $3)`,
          [broadcastId, channelId, intro.ts],
        );

        logger.info(
          `inform-responders job ${job.id} — notified ${responders.length} responder(s) for broadcastId: "${broadcastId}".`,
        );
      } else {
        logger.info(
          `inform-responders job ${job.id} — no responders for broadcastId: "${broadcastId}". Skipping group DM.`,
        );
      }

      await sendJob(
        REQUEST_APPROVAL_QUEUE,
        { broadcastId },
        { group: { id: broadcastId } },
      );

      logger.info(
        `inform-responders job ${job.id} — enqueued request-approval job for broadcastId: "${broadcastId}".`,
      );
    } catch (error) {
      logger.error(
        `Failed to process inform-responders job ${job.id} — broadcastId: "${broadcastId}"`,
        error,
      );
      throw error;
    }
  });
}
