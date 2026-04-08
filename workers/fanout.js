import { QUEUE as DELIVER_QUEUE } from "./deliver.js";

export const QUEUE = "broadcast.fanout";

// Hardcoded recipient list — will be replaced by a real lookup (e.g. channel members) later.
const RECIPIENTS = ["U111AAA", "U222BBB", "U333CCC"];

/**
 * @param {import("pg-boss").default} boss
 * @param {import("@slack/bolt").App["client"]} client
 * @param {import("@slack/bolt").Logger} logger
 */
export async function register(boss, client, logger) {
  await boss.createQueue(QUEUE);

  await boss.work(QUEUE, async ([job]) => {
    const { broadcastId } = job.data;

    logger.info(
      `Processing fanout job ${job.id} — broadcastId: "${broadcastId}"`,
    );

    // Fetch the original request-approval job, which carries the full broadcast payload.
    // broadcastId was set as the pg-boss job ID when the job was enqueued in handlers.js.
    const sourceJob = await boss.getJobById(broadcastId);

    if (!sourceJob) {
      logger.error(
        `Fanout job ${job.id} — source job not found for broadcastId: "${broadcastId}". Skipping.`,
      );
      return;
    }

    const { title, scheduledFor, messageBody, files, userId } = sourceJob.data;

    await Promise.all(
      RECIPIENTS.map((recipientId) =>
        boss.send(DELIVER_QUEUE, {
          broadcastId,
          recipientId,
          title,
          scheduledFor,
          messageBody,
          files,
          userId,
        }),
      ),
    );

    logger.info(
      `Fanout job ${job.id} complete — enqueued ${RECIPIENTS.length} deliver jobs for broadcastId: "${broadcastId}".`,
    );
  });
}
