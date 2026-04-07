import { approvalMessage } from "../views/approvalMessage.js";

export const QUEUE = "broadcast.request-approval";

/**
 * @param {import("pg-boss").default} boss
 * @param {import("@slack/bolt").App["client"]} client
 * @param {import("@slack/bolt").Logger} logger
 */
export async function register(boss, client, logger) {
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

    // Open a single group DM with all approvers and send one approval request.
    const { channel } = await client.conversations.open({
      users: approvers.join(","),
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

    logger.info(
      `Broadcast job ${job.id} processed — notified ${approvers.length} approver(s).`,
    );
  });
}
