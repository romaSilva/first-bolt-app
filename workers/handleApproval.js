import { sendDM } from "../lib/slack.js";
import { FANOUT_QUEUE } from "./index.js";

export const QUEUE = "broadcast.handle-approval";

/**
 * @param {import("pg-boss").default} boss
 * @param {import("@slack/bolt").App["client"]} client
 * @param {import("@slack/bolt").Logger} logger
 */
export async function register(boss, client, logger) {
  await boss.createQueue(QUEUE);

  await boss.work(QUEUE, async ([job]) => {
    const { broadcastId, approved, approverId, creatorId, scheduledFor } =
      job.data;

    logger.info(
      `Processing handle-approval job ${job.id} — broadcastId: "${broadcastId}", approved: ${approved}`,
    );

    if (approved) {
      await sendDM(
        client,
        creatorId,
        `✅ Your broadcast \`${broadcastId}\` was *approved* by <@${approverId}>. It’s scheduled to go out on ${scheduledFor}.`,
      );

      await boss.send(FANOUT_QUEUE, { broadcastId });

      logger.info(`Broadcast ${broadcastId} approved — fanout job created.`);
    } else {
      await sendDM(
        client,
        creatorId,
        `❌ Your broadcast \`${broadcastId}\` was *rejected* by <@${approverId}>.`,
      );

      logger.info(`Broadcast ${broadcastId} rejected — no further action.`);
    }
  });
}
