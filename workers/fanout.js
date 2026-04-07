export const QUEUE = "broadcast.fanout";

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

    // TODO: implement fanout logic
  });
}
