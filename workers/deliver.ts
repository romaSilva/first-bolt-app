import type { PgBoss } from "pg-boss";
import type { WebClient } from "@slack/web-api";
import type { Logger } from "@slack/bolt";
import type { DeliverJobData } from "../types.ts";

export const QUEUE = "broadcast.deliver";

export async function register(
  boss: PgBoss,
  client: WebClient,
  logger: Logger,
): Promise<void> {
  await boss.createQueue(QUEUE);

  await boss.work<DeliverJobData>(QUEUE, async ([job]) => {
    const { broadcastId } = job.data;

    logger.info(
      `Processing deliver job ${job.id} — broadcastId: "${broadcastId}"`,
    );

    // TODO: implement delivery logic
  });
}
