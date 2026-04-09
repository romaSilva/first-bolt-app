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
    const { broadcastId, recipientId, messageBody, files } = job.data;

    logger.info(
      `Processing deliver job ${job.id} — broadcastId: "${broadcastId}", recipientId: "${recipientId}"`,
    );

    if (files.length > 0) {
      const firstFile = files[0];
      const response = await fetch(firstFile.url_private, {
        headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      await deliverMessage(client, recipientId, messageBody, {
        buffer,
        filename: firstFile.name,
      });
    } else {
      await deliverMessage(client, recipientId, messageBody);
    }
  });
}

async function deliverMessage(
  client: WebClient,
  userId: string,
  text: string,
  file?: {
    buffer: Buffer;
    filename: string;
  },
): Promise<void> {
  const { channel } = await client.conversations.open({ users: userId });
  const channelId = channel!.id!;

  if (file) {
    await client.files.uploadV2({
      channel_id: channelId,
      file: file.buffer,
      filename: file.filename,
      initial_comment: text,
    });
    return;
  }

  await client.chat.postMessage({
    channel: channelId,
    text,
  });
}
