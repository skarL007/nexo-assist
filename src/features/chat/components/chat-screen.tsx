"use client";

import { AlertCircle, Hand, Headset, Loader2, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AgentReply, MessageItem } from "@/components/conversation/message-item";
import type { CardActions } from "@/components/conversation/message-cards";
import { StatusPill } from "@/components/nexo/status-pill";
import type { ConversationView } from "@/contracts/chat";
import { firstName as firstNameOf } from "@/domain/employee";
import { PageHeader } from "@/features/shell/page-header";
import { apiFetch } from "@/lib/api-client";
import { useLiveUpdates } from "@/lib/use-live-updates";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  conversationRefreshed,
  dismissError,
  loadConversation,
  rateReply,
  resolveDraft,
  sendMessage,
  startNewConversation,
  unsentRestored,
  type PendingImage,
} from "../chat-slice";
import { Composer, type ComposerHandle } from "./composer";
import { SlaBanner } from "./sla-banner";
import { WelcomeMessage } from "./welcome-message";

const POLL_MS = 4000;

export function ChatScreen({ firstName }: { firstName: string }) {
  const dispatch = useAppDispatch();
  const { conversation, live, optimisticText, optimisticImage, sending, error, unsentText, unsentImage } = useAppSelector((state) => state.chat);
  const composer = useRef<ComposerHandle>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void dispatch(loadConversation());
  }, [dispatch]);

  // Com uma conversa aberta, o stream fica ligado: um analista que assume (ou responde) aparece na hora,
  // mesmo quando a conversa estava com o agent. Se o stream cair, polling só enquanto um analista atende.
  const paused = conversation !== null && conversation.status !== "with_agent";
  const watching = conversation?.id != null;
  const refresh = useCallback(async () => {
    const fresh = await apiFetch<ConversationView>("/api/chat").catch(() => null);
    if (fresh) dispatch(conversationRefreshed(fresh));
  }, [dispatch]);
  const streaming = useLiveUpdates("/api/chat/stream", () => void refresh(), watching) === "live";
  useEffect(() => {
    if (!paused || streaming) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [paused, streaming, refresh]);

  // Envio que falhou antes de gravar: o texto volta para o campo, pronto para tentar de novo.
  useEffect(() => {
    if (unsentText === null) return;
    composer.current?.prefill(unsentText, unsentImage);
    dispatch(unsentRestored());
  }, [unsentText, unsentImage, dispatch]);

  const messageCount = conversation?.messages.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageCount, live?.text, live?.steps.length, live?.cards.length, optimisticText, error]);

  const send = useCallback(
    (text: string, image?: PendingImage) => void dispatch(sendMessage(image ? { text, image } : text)),
    [dispatch],
  );
  const shortcutDraftId = useMemo(() => latestPendingDraftId(conversation), [conversation]);

  const actions: CardActions = useMemo(
    () => ({
      onSend: send,
      draftActions: (draftId) => ({
        // unwrap: o erro volta para o card mostrar ali mesmo.
        onConfirm: () => dispatch(resolveDraft({ draftId, action: "confirm" })).unwrap(),
        onCancel: () => dispatch(resolveDraft({ draftId, action: "cancel" })).unwrap(),
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
        <div className="grid flex-1 place-items-center px-4 text-sm text-muted-foreground">
          {error ? (
            <div className="w-full max-w-md">
              <ErrorBanner message={error} onRetry={() => dispatch(loadConversation())} />
            </div>
          ) : (
            <span className="inline-flex items-center gap-2" role="status">
              <Loader2 className="size-4 animate-spin" /> Carregando conversa…
            </span>
          )}
        </div>
      </>
    );
  }

  const lastAgentIndex = conversation.messages.findLastIndex((m) => m.role === "agent");
  const limitReached = conversation.remainingMessages <= 0;

  return (
    <>
      <PageHeader page="Atendimento">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* No celular o estado já aparece no aviso acima do campo; a pílula só disputaria espaço com o título. */}
          <span className="max-[420px]:hidden">
            <ConversationStatus conversation={conversation} />
          </span>
          {conversation.id && (
            <Button variant="outline" size="sm" onClick={() => dispatch(startNewConversation())} disabled={sending}>
              <RotateCcw /> <span className="max-sm:sr-only">Nova conversa</span>
            </Button>
          )}
        </div>
      </PageHeader>

      <main className="fade-bottom scrollbar-quiet flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 pt-6 pb-8 sm:px-6 md:pt-8">
          {conversation.status === "with_agent" && (
            <SlaBanner
              disabled={sending}
              onAskAnalyst={(alert) =>
                send(`Quero falar com um analista sobre o ${alert.code}, que ${alert.level === "overdue" ? "já venceu o prazo" : "está perto de vencer o prazo"}.`)
              }
            />
          )}
          {conversation.messages.length === 0 && !optimisticText && <WelcomeMessage firstName={firstName} onPick={send} />}

          {conversation.messages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              viewer="employee"
              draftStatuses={conversation.draftStatuses}
              // Escolhas só valem na última resposta; rascunhos pendentes valem sempre, mas travam enquanto o Farol responde.
              actions={index === lastAgentIndex && !sending ? actions : { draftActions: actions.draftActions }}
              // "Isso resolveu?" só na última resposta de verdade do agent (com trace), enquanto ele atende.
              feedback={
                index === lastAgentIndex && message.trace && !sending && conversation.status === "with_agent"
                  ? {
                      value: conversation.feedback[message.id],
                      onRate: (helpful) => void dispatch(rateReply({ messageId: message.id, helpful })),
                      onEscalate: () => send("Quero falar com um analista"),
                    }
                  : undefined
              }
            />
          ))}

          {optimisticText && (
            <div className="ml-auto max-w-[85%] rounded-[20px] rounded-br-md bg-[color-mix(in_oklch,var(--primary),white_10%)] px-4 py-2.5 text-[15px] leading-[1.5] break-words whitespace-pre-wrap text-primary-foreground sm:max-w-[78%]">
              {optimisticImage && (
                // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:)
                <img src={optimisticImage} alt="Imagem anexada" className="mb-2 max-h-48 rounded-lg" />
              )}
              {optimisticText}
            </div>
          )}

          {live && <AgentReply viewer="employee" working text={live.text} steps={live.steps} cards={live.cards} />}
          {/* Entre o envio e a primeira linha do servidor, o Farol já aparece pensando (sem isso, a tela parece parada). */}
          {!live && optimisticText && conversation.status === "with_agent" && <AgentReply viewer="employee" working text="" steps={[]} cards={[]} />}

          {error && <ErrorBanner message={error} onClose={() => dispatch(dismissError())} />}
          <div ref={bottom} />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pt-2 pb-4 sm:px-6 sm:pb-5">
        {paused && <PausedNotice conversation={conversation} />}
        <Composer
          ref={composer}
          onSend={send}
          disabled={sending || limitReached}
          placeholder={limitReached ? "Limite desta sessão atingido. Comece uma nova conversa." : composerPlaceholder(conversation)}
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

/** Com um analista na conversa, o campo diz para quem a mensagem vai. */
function composerPlaceholder(conversation: ConversationView): string {
  if (conversation.status === "waiting_analyst") return "Escreva para o analista…";
  if (conversation.status === "with_analyst") return `Escreva para ${conversation.analystName ? firstNameOf(conversation.analystName) : "o analista"}…`;
  return "Escreva para o Farol…";
}

function PausedNotice({ conversation }: { conversation: ConversationView }) {
  const waiting = conversation.status === "waiting_analyst";
  const text = waiting
    ? "Um analista vai continuar por aqui. O Farol Desk está pausado — pode mandar mais detalhes enquanto isso."
    : `${conversation.analystName ?? "Um analista"} está atendendo você agora.`;
  const Icon = waiting ? Hand : Headset;
  return (
    <p
      role="status"
      className={
        waiting
          ? "mb-2.5 flex items-start gap-2.5 rounded-2xl bg-warning-soft px-4 py-2.5 text-[13px] leading-relaxed text-warning-foreground shadow-[0_0_0_1px_oklch(0.72_0.17_60/0.2)]"
          : "mb-2.5 flex items-start gap-2.5 rounded-2xl bg-success-soft px-4 py-2.5 text-[13px] leading-relaxed text-success-foreground shadow-[0_0_0_1px_oklch(0.6_0.15_152/0.2)]"
      }
    >
      <Icon className="mt-[3px] size-3.5 shrink-0" /> {text}
    </p>
  );
}

function ErrorBanner({ message, onClose, onRetry }: { message: string; onClose?: () => void; onRetry?: () => void }) {
  return (
    <div role="alert" className="reveal flex items-center gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger-foreground shadow-[0_0_0_1px_oklch(0.6_0.21_27/0.16)]">
      <AlertCircle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
      {onClose && (
        <Button type="button" size="icon-xs" variant="ghost" onClick={onClose} aria-label="Fechar aviso" className="text-danger-foreground hover:bg-danger/10">
          <X />
        </Button>
      )}
    </div>
  );
}
