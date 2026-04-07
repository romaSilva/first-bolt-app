import {
  register as registerRequestApproval,
  QUEUE as REQUEST_APPROVAL_QUEUE,
} from "./requestApproval.js";
import {
  register as registerHandleApproval,
  QUEUE as HANDLE_APPROVAL_QUEUE,
} from "./handleApproval.js";
import { register as registerFanout, QUEUE as FANOUT_QUEUE } from "./fanout.js";
import {
  register as registerDeliver,
  QUEUE as DELIVER_QUEUE,
} from "./deliver.js";

export const QUEUES = {
  REQUEST_APPROVAL: REQUEST_APPROVAL_QUEUE,
  HANDLE_APPROVAL: HANDLE_APPROVAL_QUEUE,
  FANOUT: FANOUT_QUEUE,
  DELIVER: DELIVER_QUEUE,
};

// Re-export individual queue names for consumers that reference them directly.
export {
  REQUEST_APPROVAL_QUEUE,
  HANDLE_APPROVAL_QUEUE,
  FANOUT_QUEUE,
  DELIVER_QUEUE,
};

/**
 * Registers all PgBoss workers.
 *
 * @param {import("pg-boss").default} boss - Started PgBoss instance
 * @param {import("@slack/bolt").App["client"]} client - Slack Web API client
 * @param {import("@slack/bolt").Logger} logger - Bolt logger
 */
export async function registerAllWorkers(boss, client, logger) {
  await registerRequestApproval(boss, client, logger);
  await registerHandleApproval(boss, client, logger);
  await registerFanout(boss, client, logger);
  await registerDeliver(boss, client, logger);
}
