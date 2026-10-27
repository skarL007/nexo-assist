import type { Card, DraftStatus } from "@/domain/message";
import { DraftCard, type DraftActions } from "./cards/draft-card";
import { QuickReplies } from "./cards/quick-replies";
import { TicketCard } from "./cards/ticket-card";
import { TicketChoiceCard } from "./cards/ticket-choice-card";

/** O que o funcionário pode fazer nos cards. Sem isso, os cards ficam só para leitura. */
export interface CardActions {
  /** Ausente nas mensagens antigas: escolhas e respostas rápidas ficam desabilitadas. */
  onSend?: (text: string) => void;
  draftActions: (draftId: number) => DraftActions;
}

export function MessageCards({
  cards,
  actions,
  draftStatuses = {},
}: {
  cards: Card[];
  actions?: CardActions;
  draftStatuses?: Record<number, DraftStatus>;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="space-y-3">
      {cards.map((card, index) => {
        switch (card.kind) {
          case "ticket":
            return <TicketCard key={index} ticket={card.ticket} />;
          case "ticket_choice":
            return <TicketChoiceCard key={index} tickets={card.tickets} onChoose={actions?.onSend} />;
          case "draft":
            return (
              <DraftCard
                key={index}
                draft={card.draft}
                status={draftStatuses[card.draft.id] ?? card.draft.status}
                actions={actions?.draftActions(card.draft.id)}
              />
            );
          case "quick_replies":
            return <QuickReplies key={index} options={card.options} onChoose={actions?.onSend} />;
          case "handoff":
            return null; // aparece como divisória de sistema
        }
      })}
    </div>
  );
}
