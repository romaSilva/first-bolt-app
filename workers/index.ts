import type { PgBoss } from "pg-boss";
import type { WebClient } from "@slack/web-api";
import type { Logger } from "@slack/bolt";
import {
  register as registerRequestApproval,
  QUEUE as REQUEST_APPROVAL_QUEUE,
} from "./requestApproval.ts";
import {
  register as registerHandleApproval,
  QUEUE as HANDLE_APPROVAL_QUEUE,
} from "./handleApproval.ts";
import { register as registerFanout, QUEUE as FANOUT_QUEUE } from "./fanout.ts";
import {
  register as registerDeliver,
  QUEUE as DELIVER_QUEUE,
} from "./deliver.ts";

export const QUEUES = {
  REQUEST_APPROVAL: REQUEST_APPROVAL_QUEUE,
  HANDLE_APPROVAL: HANDLE_APPROVAL_QUEUE,
  FANOUT: FANOUT_QUEUE,
  DELIVER: DELIVER_QUEUE,
} as const;

// Re-export individual queue names for consumers that reference them directly.
export {
  REQUEST_APPROVAL_QUEUE,
  HANDLE_APPROVAL_QUEUE,
  FANOUT_QUEUE,
  DELIVER_QUEUE,
};

export async function registerAllWorkers(
  boss: PgBoss,
  client: WebClient,
  logger: Logger,
): Promise<void> {
  await registerRequestApproval(boss, client, logger);
  await registerHandleApproval(boss, client, logger);
  await registerFanout(boss, client, logger);
  await registerDeliver(boss, client, logger);
}
