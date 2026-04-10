import type { PgBoss } from "pg-boss";
import type { WebClient } from "@slack/web-api";
import type { Logger } from "@slack/bolt";
import { pool } from "../db.ts";
import type { DeliverJobData } from "../types.ts";

export const QUEUE = "broadcast.deliver";

export async function register(
  boss: PgBoss,
  client: WebClient,
  logger: Logger,
): Promise<void> {
  await boss.createQueue(QUEUE);

  await boss.work<DeliverJobData>(QUEUE, async ([job]) => {
    const { broadcastId, recipientId, messageBody, files } = job.data;

    logger.info(
      `Processing deliver job ${job.id} — broadcastId: "${broadcastId}", recipientId: "${recipientId}"`,
    );

    try {
      if (files.length > 0) {
        const firstFile = files[0];
        const response = await fetch(firstFile.url_private, {
          headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
        });
        const buffer = Buffer.from(await response.arrayBuffer());
        const { channelId, messageRef: messageTs } = await deliverMessage(
          client,
          recipientId,
          messageBody,
          { buffer, filename: firstFile.name },
        );
        await recordDelivery(
          broadcastId,
          recipientId,
          channelId,
          messageTs,
          logger,
        );
      } else {
        const { channelId, messageRef: messageTs } = await deliverMessage(
          client,
          recipientId,
          messageBody,
        );
        await recordDelivery(
          broadcastId,
          recipientId,
          channelId,
          messageTs,
          logger,
        );
      }

      logger.info(
        `Deliver job ${job.id} complete — broadcastId: "${broadcastId}", recipientId: "${recipientId}"`,
      );
    } catch (error) {
      logger.error(
        `Failed to process deliver job ${job.id} — broadcastId: "${broadcastId}", recipientId: "${recipientId}"`,
        error,
      );
      throw error;
    }
  });
}

async function deliverMessage(
  client: WebClient,
  userId: string,
  text: string,
  file?: { buffer: Buffer; filename: string },
): Promise<{ channelId: string; messageRef?: string }> {
  const { channel } = await client.conversations.open({ users: userId });
  const channelId = channel!.id!;

  if (file) {
    const uploadResult = await client.filesUploadV2({
      channel_id: channelId,
      file: file.buffer,
      filename: file.filename,
      initial_comment: text,
    });

    const fileId = uploadResult.files?.[0]?.files?.[0]?.id;

    return { channelId, messageRef: fileId };
  }

  const result = await client.chat.postMessage({ channel: channelId, text });
  return { channelId, messageRef: result.ts! };
}

async function recordDelivery(
  broadcastId: string,
  recipientId: string,
  channelId: string,
  messageRef: string | undefined,
  logger: Logger,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO bot.broadcast_messages (broadcast_id, recipient_id, channel_id, message_ts)
       VALUES ($1, $2, $3, $4)`,
      [broadcastId, recipientId, channelId, messageRef],
    );
  } catch (error) {
    logger.error(
      `Failed to record delivery — broadcastId: "${broadcastId}", recipientId: "${recipientId}"`,
      error,
    );
  }
}
