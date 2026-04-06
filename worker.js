import { sendDM } from "./lib/slack.js";

const QUEUE = "broadcast.request-approval";

/**
 * Registers the PgBoss worker that processes broadcast jobs.
 *
 * @param {import("pg-boss").default} boss - Started PgBoss instance
 * @param {import("@slack/bolt").App["client"]} client - Slack Web API client
 * @param {import("@slack/bolt").Logger} logger - Bolt logger
 */
export async function registerWorker(boss, client, logger) {
  await boss.createQueue(QUEUE);

  await boss.work(QUEUE, async ([job]) => {
    const { channelId, threadTs, title, scheduledFor, approvers } = job.data;

    logger.info(`Processing broadcast job ${job.id} — title: "${title}"`);

    // Notify the requester that the broadcast has been sent for approval.
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: `✅ Your broadcast *${title}* has been sent for approval!`,
    });

    // DM each approver with a pending approval notice.
    for (const approverId of approvers) {
      await sendDM(
        client,
        approverId,
        `👋 You have a pending broadcast approval for *${title}* scheduled for ${scheduledFor}.`,
      );
    }

    logger.info(
      `Broadcast job ${job.id} processed — notified ${approvers.length} approver(s).`,
    );
  });
}

export { QUEUE };
