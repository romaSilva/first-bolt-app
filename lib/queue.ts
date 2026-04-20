import type { PgBoss } from "pg-boss";
import { boss } from "../boss.ts";
import type {
  HandleApprovalJobData,
  FanoutJobData,
  DeliverJobData,
  RequestApprovalJobData,
  InformRespondersJobData,
} from "../types.ts";

type SendOptions = NonNullable<Parameters<PgBoss["send"]>[2]>;

/**
 * Maps each queue name to the payload type it expects.
 * Add a new entry here whenever a new queue is introduced.
 */
type QueuePayloadMap = {
  "broadcast.inform-responders": InformRespondersJobData;
  "broadcast.request-approval": RequestApprovalJobData;
  "broadcast.handle-approval": HandleApprovalJobData;
  "broadcast.fanout": FanoutJobData;
  "broadcast.deliver": DeliverJobData;
};

/**
 * Type-safe wrapper around boss.send.
 * TypeScript infers the required payload shape from the queue argument.
 */
export function sendJob<Q extends keyof QueuePayloadMap>(
  queue: Q,
  data: QueuePayloadMap[Q],
  options?: SendOptions,
): Promise<string | null> {
  return boss.send(queue, data as object, { retryLimit: 0, ...options });
}
