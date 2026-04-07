import { approvalMessage } from "./views/approvalMessage.js";

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
    const {
      broadcastId,
      channelId,
      threadTs,
      title,
      scheduledFor,
      userId,
      messageBody,
      files,
      approvers,
    } = job.data;

    logger.info(`Processing broadcast job ${job.id} — title: "${title}"`);

    // Notify the requester that the broadcast has been sent for approval.
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: `✅ Your broadcast *${title}* has been sent for approval!`,
    });

    // DM each approver with the approval message and the broadcast content in a thread.
    for (const approverId of approvers) {
      const { channel } = await client.conversations.open({
        users: approverId,
      });

      // Step 1: Intro message with broadcast metadata and approve/reject buttons.
      const intro = await client.chat.postMessage({
        channel: channel.id,
        ...approvalMessage({ broadcastId, title, scheduledFor, userId }),
      });

      // Step 2: Reply in thread with the message content (+ file if present).
      if (files.length > 0) {
        const [firstFile] = files;

        const downloadResponse = await fetch(firstFile.url_private, {
          headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
        });
        const buffer = Buffer.from(await downloadResponse.arrayBuffer());

        await client.files.uploadV2({
          channel_id: channel.id,
          thread_ts: intro.ts,
          file: buffer,
          filename: firstFile.name,
          initial_comment: messageBody,
        });
      } else {
        await client.chat.postMessage({
          channel: channel.id,
          thread_ts: intro.ts,
          text: messageBody,
        });
      }
    }

    logger.info(
      `Broadcast job ${job.id} processed — notified ${approvers.length} approver(s).`,
    );
  });
}

export { QUEUE };
