import type { App } from "@slack/bolt";
import { registerCommandHandlers } from "./commands.ts";
import { registerApprovalActionHandlers } from "./approvalActions.ts";
import { registerBroadcastCreationHandlers } from "./broadcastCreation.ts";
import { registerEngagementEventHandlers } from "./engagementEvents.ts";

export function registerHandlers(app: App): void {
  registerBroadcastCreationHandlers(app);
  registerCommandHandlers(app);
  registerApprovalActionHandlers(app);
  registerEngagementEventHandlers(app);
}
