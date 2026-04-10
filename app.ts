import "dotenv/config";
import { App } from "@slack/bolt";
import { boss } from "./boss.ts";
import { registerHandlers } from "./handlers/index.ts";
import { registerAllWorkers } from "./workers/index.ts";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

registerHandlers(app);

(async () => {
  // Start PgBoss — creates the pgboss schema on first run
  await boss.start();

  await registerAllWorkers(boss, app.client, app.logger);

  app.logger.info("PgBoss started and all broadcast workers registered.");

  await app.start(process.env.PORT || 3000);

  app.logger.info("⚡️ Bolt app is running!");
})();
