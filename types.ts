export const BroadcastStatus = {
  Draft: "draft",
  PendingApproval: "pending_approval",
  Approved: "approved",
  Rejected: "rejected",
  Delivered: "delivered",
} as const;

export type BroadcastStatus =
  (typeof BroadcastStatus)[keyof typeof BroadcastStatus];

export interface BroadcastMetadata {
  channelId: string;
  title: string;
  scheduledFor: number;
  requesterId: string;
  approvers: string[];
  audience: string[];
  responders?: string[];
}
export interface SlackFile {
  url_private: string;
  name: string;
}
export interface BroadcastContent {
  messageBody: string;
  files: SlackFile[];
}

interface DefaultJobData {
  broadcastId: string;
}

export interface RequestApprovalJobData extends DefaultJobData {}

export interface HandleApprovalJobData extends DefaultJobData {
  approved: boolean;
  approverId: string;
  requesterId: string;
  scheduledFor: number;
}

export interface FanoutJobData extends DefaultJobData {}

export interface DeliverJobData extends DefaultJobData {
  recipientId: string;
  title: string;
  scheduledFor: number;
  messageBody: string;
  files: SlackFile[];
  requesterId: string;
}
