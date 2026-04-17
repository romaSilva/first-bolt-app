import type { WebClient } from "@slack/web-api";

export async function getChannelMembers(
  client: WebClient,
  channelId: string,
): Promise<string[]> {
  const members: string[] = [];
  let cursor: string | undefined;

  do {
    const result = await client.conversations.members({
      channel: channelId,
      cursor,
      limit: 200,
    });
    members.push(...(result.members ?? []));
    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return members;
}

export async function sendDM(
  client: WebClient,
  userId: string,
  text: string,
): Promise<{ ts: string; channel: string }> {
  const { channel } = await client.conversations.open({ users: userId });
  const result = await client.chat.postMessage({ channel: channel!.id!, text });
  return { ts: result.ts as string, channel: result.channel as string };
}
