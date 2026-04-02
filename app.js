import { App } from "@slack/bolt";

/**
 * This sample Slack application uses Socket Mode.
 * For the companion getting started setup guide, see:
 * https://docs.slack.dev/tools/bolt-js/getting-started/
 */

// Initializes your app with your bot token and app token
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

app.command("/ping", async ({ command, ack, say }) => {
  // Acknowledge command request
  await ack();

  // Send a message to the channel where the command was triggered
  await say(`Hello, <@${command.user_id}>!`);
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  app.logger.info("⚡️ Bolt app is running!");
})();
