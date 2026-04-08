export const broadcastModal = {
  type: "modal",
  callback_id: "broadcast_modal",
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
        type: "multi_users_select",
        placeholder: {
          type: "plain_text",
          text: "Select users",
          emoji: true,
        },
        action_id: "multi_users_select-action",
      },
      label: {
        type: "plain_text",
        text: "Approvers",
        emoji: true,
      },
      optional: false,
    },
    {
      type: "input",
      block_id: "broadcast_channels",
      label: {
        type: "plain_text",
        text: "Channels",
        emoji: true,
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
  ],
};
