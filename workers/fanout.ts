import type { PgBoss } from "pg-boss";
import type { WebClient } from "@slack/web-api";
import type { Logger } from "@slack/bolt";
import { pool } from "../db.ts";
import { sendDM, getChannelMembers } from "../lib/slack.ts";
import { sendJob } from "../lib/queue.ts";
import { DELIVER_QUEUE } from "./index.ts";
import type {
  FanoutJobData,
  BroadcastMetadata,
  BroadcastContent,
} from "../types.ts";
import { toDate } from "../lib/date.ts";

export const QUEUE = "broadcast.fanout";

export async function register(
  boss: PgBoss,
  client: WebClient,
  logger: Logger,
): Promise<void> {
  await boss.createQueue(QUEUE);

  await boss.work<FanoutJobData>(QUEUE, async ([job]) => {
    const { broadcastId } = job.data;

    logger.info(
      `Processing fanout job ${job.id} — broadcastId: "${broadcastId}"`,
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
          `Fanout job ${job.id} — broadcast not found for broadcastId: "${broadcastId}". Skipping.`,
        );
        return;
      }

      const { metadata, content } = rows[0];
      const { title, scheduledFor, requesterId, audience } = metadata;
      const { messageBody, files } = content;

      const memberLists = await Promise.all(
        audience.map((channelId) => getChannelMembers(client, channelId)),
      );

      const recipients = [...new Set(memberLists.flat())];

      // ⚠️ LOAD TEST ONLY — remove before deploying
      // const LOAD_TEST_MULTIPLIER = 10;
      // const uniqueRecipients = [...new Set(memberLists.flat())];
      // const recipients = uniqueRecipients.flatMap((id) =>
      //   Array.from({ length: LOAD_TEST_MULTIPLIER }, () => id),
      // );
      // END LOAD TEST

      await sendDM(
        client,
        requesterId,
        `🔔 Your broadcast \`${broadcastId}\` is being delivered now. ${recipients.length} recipient(s) will receive it shortly.`,
      );

      await Promise.all(
        recipients.map((recipientId) =>
          sendJob(
            DELIVER_QUEUE,
            {
              broadcastId,
              recipientId,
              title,
              scheduledFor,
              messageBody,
              files,
              requesterId,
            },
            { group: { id: broadcastId }, startAfter: toDate(scheduledFor) },
          ),
        ),
      );

      logger.info(
        `Fanout job ${job.id} complete — enqueued ${recipients.length} deliver jobs for broadcastId: "${broadcastId}".`,
      );
    } catch (error) {
      logger.error(
        `Failed to process fanout job ${job.id} — broadcastId: "${broadcastId}"`,
        error,
      );
      throw error;
    }
  });
}
