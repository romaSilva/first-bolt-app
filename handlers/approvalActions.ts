import type { App, BlockAction, ButtonAction } from "@slack/bolt";
import { pool } from "../db.ts";
import { boss } from "../boss.ts";
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

  // ── Broadcast cancel confirmation actions ─────────────────────────────────
  app.action(
    "confirm_cancel_broadcast",
    async ({ ack, action, respond, logger }) => {
      await ack();

      const { broadcastId } = JSON.parse((action as ButtonAction).value!) as {
        broadcastId: string;
      };

      try {
        const { rows: jobs } = await pool.query<{ id: string; name: string }>(
          `SELECT id, name FROM pgboss.job
           WHERE group_id = $1
             AND state IN ('created', 'retry', 'active')`,
          [broadcastId],
        );

        const byQueue = new Map<string, string[]>();
        for (const job of jobs) {
          const ids = byQueue.get(job.name) ?? [];
          ids.push(job.id);
          byQueue.set(job.name, ids);
        }

        await Promise.all(
          [...byQueue.entries()].map(([name, ids]) => boss.cancel(name, ids)),
        );

        await pool.query(
          `UPDATE bot.broadcasts
           SET status = $1, updated_at = now()
           WHERE id = $2`,
          [BroadcastStatus.Cancelled, broadcastId],
        );

        await respond({
          replace_original: true,
          text: `🚫 Broadcast \`${broadcastId}\` has been cancelled. ${jobs.length} pending job(s) were stopped.`,
        });
      } catch (error) {
        logger.error("confirm_cancel_broadcast: Failed:", error);
        await respond({
          replace_original: true,
          text: "❌ Failed to cancel the broadcast. Please try again.",
        });
      }
    },
  );

  app.action("deny_cancel_broadcast", async ({ ack, respond }) => {
    await ack();

    await respond({
      replace_original: true,
      text: "Cancellation aborted. Your broadcast is still active.",
    });
  });
}
