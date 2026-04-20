import type { WebClient } from "@slack/web-api";
import type { SlackFile } from "../types.ts";

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

export async function postContentMessage(
  client: WebClient,
  channelId: string,
  threadTs: string,
  messageBody: string,
  files: SlackFile[],
): Promise<void> {
  if (files.length > 0) {
    const [firstFile] = files;

    const downloadResponse = await fetch(firstFile.url_private, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    });
    const buffer = Buffer.from(await downloadResponse.arrayBuffer());

    await client.files.uploadV2({
      channel_id: channelId,
      thread_ts: threadTs,
      file: buffer,
      filename: firstFile.name,
      initial_comment: messageBody,
    });
  } else {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: messageBody,
    });
  }
}
