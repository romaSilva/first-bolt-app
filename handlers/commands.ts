import type { App } from "@slack/bolt";
import { pool } from "../db.ts";
import { broadcastModal } from "../views/broadcastModal.ts";

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

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: broadcastModal,
      });
    } catch (error) {
      logger.error("Failed to open broadcast modal:", error);
    }
  });
}
