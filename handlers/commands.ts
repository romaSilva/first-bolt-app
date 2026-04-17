import type { App } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import type { PlainTextOption } from "@slack/web-api";
import { pool } from "../db.ts";
import { buildBroadcastModal } from "../views/broadcastModal.ts";
import { getChannelMembers } from "../lib/slack.ts";

async function fetchApproverOptions(
  client: WebClient,
  channelId: string,
): Promise<PlainTextOption[]> {
  const memberIds = await getChannelMembers(client, channelId);

  const options: PlainTextOption[] = [];

  await Promise.all(
    memberIds.map(async (userId) => {
      const { user } = await client.users.info({ user: userId });
      if (!user || user.deleted || user.is_bot) return;
      const name =
        user.profile?.display_name_normalized ||
        user.profile?.real_name_normalized ||
        user.name ||
        userId;
      options.push({
        text: { type: "plain_text", text: name, emoji: false },
        value: userId,
      });
    }),
  );

  return options.sort((a, b) =>
    (a.text as { text: string }).text.localeCompare(
      (b.text as { text: string }).text,
    ),
  );
}

export function registerCommandHandlers(app: App): void {
  // ── /ping ─────────────────────────────────────────────────────────────────
  app.command("/ping", async ({ ack, say, command, logger }) => {
    await ack();

    const { rows } = await pool.query("SELECT version()");
    logger.info(`/ping: DB version: ${rows[0].version}`);

    await say(`Hello, <@${command.user_id}>! DB connected: ${rows[0].version}`);
  });

  // ── /broadcast ────────────────────────────────────────────────────────────
  app.command("/broadcast", async ({ ack, client, body, logger }) => {
    await ack();

    const approversChannelId = process.env.APPROVERS_CHANNEL_ID;
    if (!approversChannelId) {
      logger.error(
        "APPROVERS_CHANNEL_ID is not set. Cannot open broadcast modal.",
      );
      return;
    }

    try {
      const approverOptions = await fetchApproverOptions(
        client,
        approversChannelId,
      );
      await client.views.open({
        trigger_id: body.trigger_id,
        view: buildBroadcastModal(approverOptions),
      });
    } catch (error) {
      logger.error("Failed to open broadcast modal:", error);
    }
  });
}
