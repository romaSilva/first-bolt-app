import type { PgBoss } from "pg-boss";
import type { WebClient } from "@slack/web-api";
import type { Logger } from "@slack/bolt";
import { approvalMessage } from "../views/approvalMessage.ts";
import { pool } from "../db.ts";
import { postContentMessage } from "../lib/slack.ts";
import type {
  RequestApprovalJobData,
  BroadcastMetadata,
  BroadcastContent,
} from "../types.ts";

export const QUEUE = "broadcast.request-approval";

export async function register(
  boss: PgBoss,
  client: WebClient,
  logger: Logger,
): Promise<void> {
  await boss.createQueue(QUEUE);

  await boss.work<RequestApprovalJobData>(QUEUE, async ([job]) => {
    const { broadcastId } = job.data;

    const { rows } = await pool.query<{
      thread_ts: string;
      metadata: BroadcastMetadata;
      content: BroadcastContent;
    }>(
      `SELECT thread_ts, metadata, content FROM bot.broadcasts WHERE id = $1`,
      [broadcastId],
    );

    if (rows.length === 0) {
      logger.error(`Broadcast not found — broadcastId: "${broadcastId}"`);
      return;
    }

    const { thread_ts: threadTs, metadata, content } = rows[0];
    const { channelId, title, scheduledFor, requesterId, approvers, audience } =
      metadata;
    const { messageBody, files } = content;

    logger.info(
      `Processing broadcast job ${job.id} — broadcastId: "${broadcastId}"`,
    );

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
      channel: channel!.id!,
      ...approvalMessage({
        broadcastId,
        title,
        scheduledFor,
        requesterId,
        audience,
      }),
    });

    // Step 2: Reply in thread with the message content (+ file if present).
    await postContentMessage(
      client,
      channel!.id!,
      intro.ts!,
      messageBody,
      files,
    );

    logger.info(
      `Broadcast job ${job.id} processed — notified ${approvers.length} approver(s).`,
    );
  });
}
