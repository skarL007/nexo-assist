"use client";

import { AlertCircle, Hand, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AgentReply, MessageItem } from "@/components/conversation/message-item";
import type { CardActions } from "@/components/conversation/message-cards";
import { StatusPill } from "@/components/nexo/status-pill";
import type { ConversationView } from "@/contracts/chat";
import { PageHeader } from "@/features/shell/page-header";
import { apiFetch } from "@/lib/api-client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  conversationRefreshed,
  dismissError,
  loadConversation,
  resolveDraft,
  sendMessage,
  startNewConversation,
} from "../chat-slice";
import { Composer, type ComposerHandle } from "./composer";
import { WelcomeMessage } from "./welcome-message";

const POLL_MS = 4000;

export function ChatScreen({ firstName }: { firstName: string }) {
  const dispatch = useAppDispatch();
  const { conversation, live, optimisticText, sending, error } = useAppSelector((state) => state.chat);
  const composer = useRef<ComposerHandle>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void dispatch(loadConversation());
  }, [dispatch]);

  // Enquanto um analista cuida da conversa, as respostas dele chegam por polling.
  const paused = conversation !== null && conversation.status !== "with_agent";
  useEffect(() => {
    if (!paused) return;
    const timer = setInterval(async () => {
      const fresh = await apiFetch<ConversationView>("/api/chat").catch(() => null);
      if (fresh) dispatch(conversationRefreshed(fresh));
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [paused, dispatch]);

  const messageCount = conversation?.messages.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageCount, live?.text, live?.steps.length, live?.cards.length, optimisticText]);

  const send = useCallback((text: string) => void dispatch(sendMessage(text)), [dispatch]);
  const shortcutDraftId = useMemo(() => latestPendingDraftId(conversation), [conversation]);

  const actions: CardActions = useMemo(
    () => ({
      onSend: send,
      draftActions: (draftId) => ({
        onConfirm: () => dispatch(resolveDraft({ draftId, action: "confirm" })),
        onCancel: () => dispatch(resolveDraft({ draftId, action: "cancel" })),
        // unwrap: o erro volta para o card mostrar ali mesmo, sem a faixa de erro da página.
        onSave: (fields) => dispatch(resolveDraft({ draftId, action: "edit", fields })).unwrap(),
        shortcut: draftId === shortcutDraftId,
        locked: sending,
      }),
    }),
    [dispatch, send, shortcutDraftId, sending],
  );

  if (!conversation) {
    return (
      <>
        <PageHeader page="Atendimento" />
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
          {error ? <ErrorBanner message={error} onRetry={() => dispatch(loadConversation())} /> : "Carregando conversa…"}
        </div>
      </>
    );
  }

  const lastAgentIndex = conversation.messages.findLastIndex((m) => m.role === "agent");
  const limitReached = conversation.remainingMessages <= 0;

  return (
    <>
      <PageHeader page="Atendimento">
        <div className="flex items-center gap-3">
          <ConversationStatus conversation={conversation} />
          {conversation.id && (
            <Button variant="ghost" size="sm" onClick={() => dispatch(startNewConversation())} disabled={sending}>
              <RotateCcw className="size-3.5" /> Nova conversa
            </Button>
          )}
        </div>
      </PageHeader>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
          {conversation.messages.length === 0 && !optimisticText && <WelcomeMessage firstName={firstName} onPick={send} />}

          {conversation.messages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              viewer="employee"
              draftStatuses={conversation.draftStatuses}
              // Escolhas só valem na última resposta; rascunhos pendentes valem sempre, mas travam enquanto o Nexo responde.
              actions={index === lastAgentIndex && !sending ? actions : { draftActions: actions.draftActions }}
            />
          ))}

          {optimisticText && (
            <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-sm bg-navy px-4 py-2.5 text-sm text-navy-foreground opacity-70">
              {optimisticText}
            </div>
          )}

          {live && <AgentReply viewer="employee" working text={live.text} steps={live.steps} cards={live.cards} />}

          {error && <ErrorBanner message={error} onClose={() => dispatch(dismissError())} />}
          <div ref={bottom} />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-6 pb-5">
        {paused && <PausedNotice conversation={conversation} />}
        <Composer
          ref={composer}
          onSend={send}
          disabled={sending || limitReached}
          placeholder={limitReached ? "Limite desta sessão atingido. Comece uma nova conversa." : "Escreva para o Nexo…"}
          remaining={conversation.remainingMessages}
          limit={conversation.messageLimit}
        />
      </footer>
    </>
  );
}

/** Rascunho pendente mais recente: o único que o atalho de teclado confirma (nunca vários de uma vez). */
function latestPendingDraftId(conversation: ConversationView | null): number | null {
  if (!conversation) return null;
  const pendingIds = conversation.messages
    .flatMap((message) => message.cards)
    .flatMap((card) =>
      card.kind === "draft" && (conversation.draftStatuses[card.draft.id] ?? card.draft.status) === "pending" ? [card.draft.id] : [],
    );
  return pendingIds.at(-1) ?? null;
}

function ConversationStatus({ conversation }: { conversation: ConversationView }) {
  if (conversation.status === "waiting_analyst") return <StatusPill tone="warning">Aguardando atendente</StatusPill>;
  if (conversation.status === "with_analyst") return <StatusPill tone="success">Com {conversation.analystName ?? "analista"}</StatusPill>;
  return <StatusPill tone="success">Assistente online</StatusPill>;
}

function PausedNotice({ conversation }: { conversation: ConversationView }) {
  const text =
    conversation.status === "waiting_analyst"
      ? "Um analista vai continuar por aqui. O Nexo Assist está pausado — pode mandar mais detalhes enquanto isso."
      : `${conversation.analystName ?? "Um analista"} está atendendo você agora.`;
  return (
    <p className="mb-2 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-amber-800">
      <Hand className="size-3.5" /> {text}
    </p>
  );
}

function ErrorBanner({ message, onClose, onRetry }: { message: string; onClose?: () => void; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      <AlertCircle className="size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Fechar aviso">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
