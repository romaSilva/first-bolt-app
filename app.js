import "dotenv/config";
import { App } from "@slack/bolt";
import { boss } from "./boss.js";
import { registerHandlers } from "./handlers.js";
import { registerWorker } from "./worker.js";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

registerHandlers(app);

(async () => {
  // Start PgBoss — creates the pgboss schema on first run
  await boss.start();

  await registerWorker(boss, app.client, app.logger);

  app.logger.info("PgBoss started and broadcast worker registered.");

  await app.start(process.env.PORT || 3000);

  app.logger.info("⚡️ Bolt app is running!");
})();
