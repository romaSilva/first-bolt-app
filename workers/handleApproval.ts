import type { PgBoss } from "pg-boss";
import type { WebClient } from "@slack/web-api";
import type { Logger } from "@slack/bolt";
import { sendDM } from "../lib/slack.ts";
import { sendJob } from "../lib/queue.ts";
import { FANOUT_QUEUE } from "./index.ts";
import type { HandleApprovalJobData } from "../types.ts";
import { toReadableDate } from "../lib/date.ts";

export const QUEUE = "broadcast.handle-approval";

export async function register(
  boss: PgBoss,
  client: WebClient,
  logger: Logger,
): Promise<void> {
  await boss.createQueue(QUEUE);

  await boss.work<HandleApprovalJobData>(QUEUE, async ([job]) => {
    logger.info(`Received handle-approval job ${JSON.stringify(job.data)}`);
    const { broadcastId, approved, approverId, requesterId, scheduledFor } =
      job.data;

    logger.info(
      `Processing handle-approval job ${job.id} — broadcastId: "${broadcastId}", approved: ${approved}`,
    );

    try {
      if (approved) {
        await sendDM(
          client,
          requesterId,
          `✅ Your broadcast \`${broadcastId}\` was *approved* by <@${approverId}>. It's scheduled to go out on ${toReadableDate(scheduledFor)}.`,
        );

        await sendJob(
          FANOUT_QUEUE,
          { broadcastId },
          { group: { id: broadcastId } },
        );

        logger.info(`Broadcast ${broadcastId} approved — fanout job created.`);
      } else {
        await sendDM(
          client,
          requesterId,
          `❌ Your broadcast \`${broadcastId}\` was *rejected* by <@${approverId}>.`,
        );

        logger.info(`Broadcast ${broadcastId} rejected — no further action.`);
      }
    } catch (error) {
      logger.error(
        `Failed to process handle-approval job ${job.id} — broadcastId: "${broadcastId}", approved: ${approved}`,
        error,
      );
      throw error;
    }
  });
}
