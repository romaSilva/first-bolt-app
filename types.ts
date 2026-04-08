export interface SlackFile {
  url_private: string;
  name: string;
}

export interface RequestApprovalJobData {
  broadcastId: string;
  channelId: string;
  threadTs: string;
  title: string;
  scheduledFor: string;
  requesterId: string;
  messageBody: string;
  files: SlackFile[];
  approvers: string[];
}

export interface HandleApprovalJobData {
  broadcastId: string;
  approved: boolean;
  approverId: string;
  requesterId: string;
  scheduledFor: string;
}

export interface FanoutJobData {
  broadcastId: string;
}

export interface DeliverJobData {
  broadcastId: string;
  recipientId: string;
  title: string;
  scheduledFor: string;
  messageBody: string;
  files: SlackFile[];
  requesterId: string;
}
