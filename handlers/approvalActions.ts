import type { App, BlockAction, ButtonAction } from "@slack/bolt";
import { pool } from "../db.ts";
import { sendJob } from "../lib/queue.ts";
import { HANDLE_APPROVAL_QUEUE } from "../workers/index.ts";
import { BroadcastStatus } from "../types.ts";
import type { ApprovalMessageMetadata } from "../views/approvalMessage.ts";

export function registerApprovalActionHandlers(app: App): void {
  // ── Broadcast approval actions ────────────────────────────────────────────
  app.action(
    "approve_broadcast",
    async ({ ack, action, body, client, logger }) => {
      await ack();

      const { broadcastId, requesterId, scheduledFor } = JSON.parse(
        (action as ButtonAction).value!,
      ) as ApprovalMessageMetadata;

      logger.info(
        `Broadcast approved — broadcastId: ${broadcastId}, approverId: ${body.user.id}.`,
      );

      const blockBody = body as BlockAction;
      const channel = blockBody.channel!.id;
      const messageTs = blockBody.message!.ts!;

      await pool.query(
        `UPDATE bot.broadcasts
         SET status = $1, decided_by = $2, decided_at = now(), updated_at = now()
         WHERE id = $3`,
        [BroadcastStatus.Approved, body.user.id, broadcastId],
      );

      await client.chat.update({
        channel,
        ts: messageTs,
        blocks: blockBody.message!.blocks?.filter(
          (b: { type: string }) => b.type !== "actions",
        ),
      });

      await sendJob(
        HANDLE_APPROVAL_QUEUE,
        {
          broadcastId,
          approved: true,
          approverId: body.user.id,
          requesterId,
          scheduledFor,
        },
        { group: { id: broadcastId } },
      );

      await client.chat.postMessage({
        channel,
        thread_ts: messageTs,
        text: `✅ Answer saved: *Approved* by <@${body.user.id}>.`,
      });
    },
  );

  app.action(
    "reject_broadcast",
    async ({ ack, action, body, client, logger }) => {
      await ack();

      const { broadcastId, requesterId, scheduledFor } = JSON.parse(
        (action as ButtonAction).value!,
      ) as ApprovalMessageMetadata;

      logger.info(
        `Broadcast rejected — broadcastId: ${broadcastId}, approverId: ${body.user.id}`,
      );

      const blockBody = body as BlockAction;
      const channel = blockBody.channel!.id;
      const messageTs = blockBody.message!.ts!;

      await pool.query(
        `UPDATE bot.broadcasts
         SET status = $1, decided_by = $2, decided_at = now(), updated_at = now()
         WHERE id = $3`,
        [BroadcastStatus.Rejected, body.user.id, broadcastId],
      );

      await client.chat.update({
        channel,
        ts: messageTs,
        blocks: blockBody.message!.blocks?.filter(
          (b: { type: string }) => b.type !== "actions",
        ),
      });

      await sendJob(
        HANDLE_APPROVAL_QUEUE,
        {
          broadcastId,
          approved: false,
          approverId: body.user.id,
          requesterId,
          scheduledFor,
        },
        { group: { id: broadcastId } },
      );

      await client.chat.postMessage({
        channel,
        thread_ts: messageTs,
        text: `❌ Answer saved: *Rejected* by <@${body.user.id}>.`,
      });
    },
  );
}
