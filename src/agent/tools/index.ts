import { offerQuickReplies, transferToAnalyst } from "./conversation";
import { cancelDraft, confirmDraft, draftNewTicket, draftTicketUpdate } from "./drafts";
import { searchHelpCenter } from "./help-center";
import { getTicket, listMyTickets } from "./tickets";
import { recordUnderstanding } from "./understanding";

export const nexoTools = {
  recordUnderstanding,
  searchHelpCenter,
  listMyTickets,
  getTicket,
  draftNewTicket,
  draftTicketUpdate,
  confirmDraft,
  cancelDraft,
  offerQuickReplies,
  transferToAnalyst,
};

export type NexoToolName = keyof typeof nexoTools;
