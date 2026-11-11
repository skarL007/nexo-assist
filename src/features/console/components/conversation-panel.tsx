"use client";

import { Bot, FileText, Hand, Headset, Loader2, LogOut, Send, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageItem } from "@/components/conversation/message-item";
import { PersonAvatar } from "@/components/nexo/person-avatar";
import { StatusPill, type Tone } from "@/components/nexo/status-pill";
import type { ConsoleConversationDetail } from "@/contracts/chat";
import { HANDOFF_REASON_LABEL, STATUS_LABEL, type ConversationStatus } from "@/domain/conversation";
import { firstName } from "@/domain/employee";
import { formatClock, percent } from "@/lib/format";
import { apiErrorMessage, useConversationActionMutation, useSendAnalystMessageMutation, useSuggestReplyMutation } from "../console-api";
import { ConversationReportPanel } from "./conversation-report-panel";

const STATUS_TONE: Record<ConversationStatus, Tone> = {
  waiting_analyst: "warning",
  with_analyst: "info",
  with_agent: "success",
  closed: "neutral",
};

export function ConversationPanel({ conversation, analystId }: { conversation: ConsoleConversationDetail; analystId: string }) {
  const [act, actState] = useConversationActionMutation();
  const [showReport, setShowReport] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const first = firstName(conversation.employee.name);
  const mine = conversation.status === "with_analyst" && conversation.analyst?.id === analystId;
  const run = (action: "assume" | "release" | "close") => act({ id: conversation.id, action });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [conversation.id, conversation.messages.length]);

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-surface px-6 py-3.5">
        <PersonAvatar name={conversation.employee.name} online={conversation.status !== "closed"} />
        <div className="min-w-40 flex-1">
          <p className="truncate font-serif text-lg leading-tight font-semibold tracking-tight">{conversation.employee.name}</p>
          <div className="flex min-w-0 items-center gap-2">
            <StatusPill tone={STATUS_TONE[conversation.status]}>{STATUS_LABEL[conversation.status]}</StatusPill>
            <p className="truncate text-xs text-muted-foreground">
              {conversation.employee.department}
              {conversation.ticketCode && ` · ${conversation.ticketCode}`}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" aria-pressed={showReport} onClick={() => setShowReport((open) => !open)}>
          <FileText /> Relatório
        </Button>
        {mine && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" disabled={actState.isLoading} onClick={() => run("release")}>
              <Undo2 /> Devolver ao agent
            </Button>
            <Button size="sm" variant="outline" className="text-danger-foreground hover:bg-danger-soft" disabled={actState.isLoading} onClick={() => run("close")}>
              <LogOut /> Encerrar atendimento
            </Button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
          {showReport && <ConversationReportPanel conversation={conversation} onClose={() => setShowReport(false)} />}
          {!showReport && conversation.handoffSummary && (
            <div className="rounded-2xl bg-warning-soft shadow-[0_0_0_1px_oklch(0.72_0.17_60/0.2)] p-4 text-sm leading-relaxed">
              <p className="eyebrow mb-1.5 text-warning-foreground">
                Resumo da transferência · {conversation.handoffReason && HANDOFF_REASON_LABEL[conversation.handoffReason]}
                {conversation.handoffConfidence !== null && ` · confiança ${percent(conversation.handoffConfidence)}`}
              </p>
              <p>{conversation.handoffSummary}</p>
            </div>
          )}
          {conversation.messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              viewer="analyst"
              draftStatuses={conversation.draftStatuses}
              feedback={{ value: conversation.feedback[message.id] }}
            />
          ))}
          <div ref={bottom} />
        </div>
      </div>

      <footer className="border-t bg-surface px-6 py-3.5">
        {actState.isError && <p role="alert" className="mb-2 text-sm text-danger-foreground">{apiErrorMessage(actState.error)}</p>}
        {mine ? (
          <AnalystComposer conversationId={conversation.id} employeeFirstName={first} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <FooterNotice conversation={conversation} />
            {conversation.status === "waiting_analyst" && (
              <Button size="sm" variant="outline" disabled={actState.isLoading} onClick={() => run("release")}>
                <Bot /> Devolver ao agent
              </Button>
            )}
            {(conversation.status === "waiting_analyst" || conversation.status === "with_agent") && (
              <Button size="sm" disabled={actState.isLoading} onClick={() => run("assume")}>
                {actState.isLoading ? <Loader2 className="animate-spin" /> : <Headset />} Assumir atendimento
              </Button>
            )}
          </div>
        )}
      </footer>
    </section>
  );
}

function FooterNotice({ conversation }: { conversation: ConsoleConversationDetail }) {
  const first = firstName(conversation.employee.name);
  const text = {
    waiting_analyst: `${first} espera um atendente · agent pausado${conversation.handoffAt ? ` desde ${formatClock(conversation.handoffAt)}` : ""}`,
    with_agent: "O Farol Desk está atendendo esta conversa.",
    with_analyst: `Em atendimento por ${conversation.analyst?.name ?? "outro analista"}.`,
    closed: "Conversa encerrada.",
  }[conversation.status];

  return (
    <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
      {conversation.status === "waiting_analyst" && <Hand className="size-4 text-warning-foreground" />}
      {text}
    </p>
  );
}

function AnalystComposer({ conversationId, employeeFirstName }: { conversationId: string; employeeFirstName: string }) {
  const [text, setText] = useState("");
  // Texto sugerido que está no campo: ao enviar, o servidor registra se foi usado igual ou editado.
  const [suggested, setSuggested] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [send, { isLoading, isError, error }] = useSendAnalystMessageMutation();
  const [suggest, suggestion] = useSuggestReplyMutation();

  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    const result = await send({ id: conversationId, text: value, suggested: suggested ?? undefined });
    if (!("error" in result)) {
      setText("");
      setSuggested(null);
      setWarnings([]);
    }
  };

  const askSuggestion = async () => {
    const result = await suggest(conversationId);
    if ("data" in result && result.data) {
      setText(result.data.text);
      setSuggested(result.data.text);
      setWarnings(result.data.warnings);
    }
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="xs" variant="ghost" disabled={suggestion.isLoading} onClick={() => void askSuggestion()}>
          {suggestion.isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="text-beam-foreground" />}
          {suggestion.isLoading ? "Escrevendo sugestão…" : "Sugerir resposta"}
        </Button>
        {suggested !== null && <span className="text-xs text-muted-foreground">Sugestão do Farol: revise antes de enviar.</span>}
      </div>
      {warnings.map((warning) => (
        <p key={warning} role="alert" className="text-xs text-warning-foreground">
          {warning}
        </p>
      ))}
      {suggestion.isError && <p className="text-xs text-danger-foreground">{apiErrorMessage(suggestion.error)}</p>}
      <div className="flex items-center gap-2 rounded-xl border bg-background px-2 py-1.5 transition-colors duration-150 focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Responder para ${employeeFirstName}…`}
          aria-label="Resposta do analista"
          className="h-9 flex-1 bg-transparent px-2 text-sm outline-none"
        />
        <Button type="submit" size="icon-sm" disabled={isLoading || !text.trim()} aria-label="Enviar">
          <Send />
        </Button>
      </div>
      {isError && <p className="text-xs text-danger-foreground">{apiErrorMessage(error)}</p>}
    </form>
  );
}
