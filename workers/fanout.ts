import type { PgBoss } from "pg-boss";
import type { WebClient } from "@slack/web-api";
import type { Logger } from "@slack/bolt";
import { sendJob } from "../lib/queue.ts";
import { REQUEST_APPROVAL_QUEUE, DELIVER_QUEUE } from "./index.ts";
import type { FanoutJobData, RequestApprovalJobData } from "../types.ts";

export const QUEUE = "broadcast.fanout";

// Hardcoded recipient list — will be replaced by a real lookup (e.g. channel members) later.
const RECIPIENTS = ["U111AAA", "U222BBB", "U333CCC"];

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

    // Fetch the original request-approval job, which carries the full broadcast payload.
    // broadcastId was set as the pg-boss job ID when the job was enqueued in handlers.js.
    const sourceJob = await boss.findJobs<RequestApprovalJobData>(
      REQUEST_APPROVAL_QUEUE,
      {
        id: broadcastId,
      },
    );

    if (!sourceJob) {
      logger.error(
        `Fanout job ${job.id} — source job not found for broadcastId: "${broadcastId}". Skipping.`,
      );
      return;
    }

    const { title, scheduledFor, messageBody, files, requesterId } =
      sourceJob[0].data;

    await Promise.all(
      RECIPIENTS.map((recipientId) =>
        sendJob(DELIVER_QUEUE, {
          broadcastId,
          recipientId,
          title,
          scheduledFor,
          messageBody,
          files,
          requesterId,
        }),
      ),
    );

    logger.info(
      `Fanout job ${job.id} complete — enqueued ${RECIPIENTS.length} deliver jobs for broadcastId: "${broadcastId}".`,
    );
  });
}
