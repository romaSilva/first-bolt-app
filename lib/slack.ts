import type { WebClient } from "@slack/web-api";

export async function sendDM(
  client: WebClient,
  userId: string,
  text: string,
): Promise<{ ts: string; channel: string }> {
  const { channel } = await client.conversations.open({ users: userId });
  const result = await client.chat.postMessage({ channel: channel!.id!, text });
  return { ts: result.ts as string, channel: result.channel as string };
}
