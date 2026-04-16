import type { PlainTextOption, View } from "@slack/web-api";

export const BROADCAST_MODAL_CALLBACK_ID = "broadcast_modal";

export function buildBroadcastModal(approverOptions: PlainTextOption[]): View {
  return {
    type: "modal",
    callback_id: BROADCAST_MODAL_CALLBACK_ID,
    title: {
      type: "plain_text",
      text: "Broadcast",
      emoji: true,
    },
    submit: {
      type: "plain_text",
      text: "Submit",
      emoji: true,
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true,
    },
    blocks: [
      {
        type: "input",
        block_id: "broadcast_title",
        label: {
          type: "plain_text",
          text: "Title",
        },
        element: {
          type: "plain_text_input",
          action_id: "title_input",
          placeholder: {
            type: "plain_text",
            text: "Enter broadcast title...",
          },
        },
      },
      {
        type: "input",
        block_id: "broadcast_schedule",
        label: {
          type: "plain_text",
          text: "Schedule",
        },
        element: {
          type: "datetimepicker",
          action_id: "schedule_input",
        },
      },
      {
        type: "input",
        block_id: "broadcast_approvers",
        element: {
          type: "multi_static_select",
          placeholder: {
            type: "plain_text",
            text: "Select approvers",
            emoji: true,
          },
          action_id: "approvers_select",
          options: approverOptions,
        },
        label: {
          type: "plain_text",
          text: "Approvers",
          emoji: true,
        },
        hint: {
          type: "plain_text",
          text: "Only pre-authorized users can approve or reject broadcasts. Contact an admin to update this list.",
          emoji: false,
        },
        optional: false,
      },
      {
        type: "input",
        block_id: "broadcast_responders",
        element: {
          type: "multi_users_select",
          placeholder: {
            type: "plain_text",
            text: "Select responders",
            emoji: true,
          },
          action_id: "responders_select",
        },
        label: {
          type: "plain_text",
          text: "Responders",
          emoji: true,
        },
        hint: {
          type: "plain_text",
          text: "These users will be notified when someone replies to the broadcast.",
          emoji: false,
        },
        optional: true,
      },
      {
        type: "input",
        block_id: "broadcast_channels",
        label: {
          type: "plain_text",
          text: "Audience",
          emoji: true,
        },
        hint: {
          type: "plain_text",
          text: "Members of the selected channels will each receive a Direct Message with the broadcast content.",
          emoji: false,
        },
        element: {
          type: "multi_conversations_select",
          action_id: "channels_select",
          placeholder: {
            type: "plain_text",
            text: "Select channels",
            emoji: true,
          },
          default_to_current_conversation: false,
          filter: {
            include: ["public", "private"],
            exclude_bot_users: true,
          },
        },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: " " },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "📝 *After submitting*, you'll receive a DM from this bot. Reply to that message with the content you want to broadcast.",
          },
        ],
      },
    ],
  };
}
