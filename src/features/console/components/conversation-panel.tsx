"use client";

import { Bot, FileText, Hand, Headset, Loader2, LogOut, Send, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageItem } from "@/components/conversation/message-item";
import { PersonAvatar } from "@/components/nexo/person-avatar";
import { StatusPill, type Tone } from "@/components/nexo/status-pill";
import type { ConsoleConversationDetail } from "@/contracts/chat";
import { HANDOFF_REASON_LABEL, STATUS_LABEL, type ConversationStatus } from "@/domain/conversation";
import { firstName } from "@/domain/employee";
import { formatClock, percent } from "@/lib/format";
import { apiErrorMessage, useConversationActionMutation, useSendAnalystMessageMutation } from "../console-api";
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
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-surface px-5 py-3">
        <PersonAvatar name={conversation.employee.name} online={conversation.status !== "closed"} />
        <div className="min-w-40 flex-1">
          <p className="truncate font-semibold">{conversation.employee.name}</p>
          <div className="flex min-w-0 items-center gap-2">
            <StatusPill tone={STATUS_TONE[conversation.status]}>{STATUS_LABEL[conversation.status]}</StatusPill>
            <p className="truncate text-xs text-muted-foreground">
              {conversation.employee.department}
              {conversation.ticketCode && ` · ${conversation.ticketCode}`}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" aria-pressed={showReport} onClick={() => setShowReport((open) => !open)}>
          <FileText className="size-4" /> Relatório
        </Button>
        {mine && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" disabled={actState.isLoading} onClick={() => run("release")}>
              <Undo2 className="size-4" /> Devolver ao agent
            </Button>
            <Button size="sm" variant="outline" className="text-danger" disabled={actState.isLoading} onClick={() => run("close")}>
              <LogOut className="size-4" /> Encerrar atendimento
            </Button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
          {showReport && <ConversationReportPanel conversation={conversation} onClose={() => setShowReport(false)} />}
          {!showReport && conversation.handoffSummary && (
            <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
              <p className="mb-1 text-xs font-semibold text-amber-800">
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

      <footer className="border-t bg-surface px-5 py-3">
        {actState.isError && <p className="mb-2 text-sm text-danger">{apiErrorMessage(actState.error)}</p>}
        {mine ? (
          <AnalystComposer conversationId={conversation.id} employeeFirstName={first} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <FooterNotice conversation={conversation} />
            {conversation.status === "waiting_analyst" && (
              <Button size="sm" variant="outline" disabled={actState.isLoading} onClick={() => run("release")}>
                <Bot className="size-4" /> Devolver ao agent
              </Button>
            )}
            {(conversation.status === "waiting_analyst" || conversation.status === "with_agent") && (
              <Button size="sm" disabled={actState.isLoading} onClick={() => run("assume")}>
                {actState.isLoading ? <Loader2 className="size-4 animate-spin" /> : <Headset className="size-4" />} Assumir atendimento
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
    with_agent: "O Nexo Assist está atendendo esta conversa.",
    with_analyst: `Em atendimento por ${conversation.analyst?.name ?? "outro analista"}.`,
    closed: "Conversa encerrada.",
  }[conversation.status];

  return (
    <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
      {conversation.status === "waiting_analyst" && <Hand className="size-4 text-warning" />}
      {text}
    </p>
  );
}

function AnalystComposer({ conversationId, employeeFirstName }: { conversationId: string; employeeFirstName: string }) {
  const [text, setText] = useState("");
  const [send, { isLoading, isError, error }] = useSendAnalystMessageMutation();

  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    const result = await send({ id: conversationId, text: value });
    if (!("error" in result)) setText("");
  };

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center gap-2 rounded-xl border px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/30">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Responder para ${employeeFirstName}…`}
          aria-label="Resposta do analista"
          className="h-9 flex-1 bg-transparent px-2 text-sm outline-none"
        />
        <Button type="submit" size="icon-sm" disabled={isLoading || !text.trim()} aria-label="Enviar">
          <Send className="size-4" />
        </Button>
      </div>
      {isError && <p className="text-xs text-danger">{apiErrorMessage(error)}</p>}
    </form>
  );
}
