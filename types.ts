export interface SlackFile {
  url_private: string;
  name: string;
}

export interface RequestApprovalJobData {
  broadcastId: string;
  channelId: string;
  threadTs: string;
  title: string;
  scheduledFor: number;
  requesterId: string;
  messageBody: string;
  files: SlackFile[];
  approvers: string[];
  audience: string[];
}

export interface HandleApprovalJobData {
  broadcastId: string;
  approved: boolean;
  approverId: string;
  requesterId: string;
  scheduledFor: number;
}

export interface FanoutJobData {
  broadcastId: string;
}

export interface DeliverJobData {
  broadcastId: string;
  recipientId: string;
  title: string;
  scheduledFor: number;
  messageBody: string;
  files: SlackFile[];
  requesterId: string;
}
