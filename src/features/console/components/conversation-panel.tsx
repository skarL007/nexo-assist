"use client";

import { ArrowUp, Bot, ChevronLeft, FileText, Hand, Headset, Loader2, LogOut, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
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

export function ConversationPanel({ conversation, analystId, onBack }: { conversation: ConsoleConversationDetail; analystId: string; onBack?: () => void }) {
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
    <section className="flex min-w-0 flex-1 flex-col bg-background" aria-label={`Conversa com ${conversation.employee.name}`}>
      <header className="flex min-h-[72px] flex-wrap items-center gap-x-3 gap-y-2.5 border-b bg-surface px-3 py-2.5 sm:px-6">
        {onBack && (
          <Button size="icon" variant="ghost" className="-mr-1 lg:hidden" aria-label="Voltar para as conversas" onClick={onBack}>
            <ChevronLeft className="size-5" />
          </Button>
        )}
        <PersonAvatar name={conversation.employee.name} online={conversation.status !== "closed"} />
        <div className="min-w-32 flex-1 space-y-1">
          <h2 className="truncate font-serif text-lg leading-tight font-semibold tracking-tight">{conversation.employee.name}</h2>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <StatusPill tone={STATUS_TONE[conversation.status]}>{STATUS_LABEL[conversation.status]}</StatusPill>
            <p className="text-xs text-muted-foreground sm:truncate">
              {conversation.employee.department}
              {conversation.ticketCode && (
                <>
                  {" · "}
                  <span className="font-mono text-[11px] tracking-tight">{conversation.ticketCode}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:basis-full">
          <Button size="sm" variant="outline" aria-pressed={showReport} onClick={() => setShowReport((open) => !open)}>
            <FileText /> Relatório
          </Button>
          {mine && (
            <>
              {/* No celular os três botões cabem numa linha: o complemento do rótulo fica só para o leitor de tela. */}
              <Button size="sm" variant="outline" disabled={actState.isLoading} onClick={() => run("release")}>
                <Undo2 />
                <span>
                  Devolver<span className="max-sm:sr-only"> ao agent</span>
                </span>
              </Button>
              <Button size="sm" variant="outline" className="text-danger-foreground hover:border-danger/30 hover:bg-danger-soft" disabled={actState.isLoading} onClick={() => run("close")}>
                <LogOut />
                <span>
                  Encerrar<span className="max-sm:sr-only"> atendimento</span>
                </span>
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="scrollbar-quiet flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
          {showReport && <ConversationReportPanel conversation={conversation} onClose={() => setShowReport(false)} />}
          {!showReport && conversation.handoffSummary && (
            <div className="rounded-2xl bg-warning-soft p-4 text-sm leading-relaxed shadow-[0_0_0_1px_oklch(0.72_0.17_60/0.2)]">
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

      <footer className="border-t bg-surface px-4 py-3 sm:px-6">
        {actState.isError && (
          <p role="alert" className="reveal mb-2 text-sm text-danger-foreground">
            {apiErrorMessage(actState.error)}
          </p>
        )}
        {mine ? (
          <AnalystComposer conversationId={conversation.id} employeeFirstName={first} />
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <FooterNotice conversation={conversation} />
            <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>button]:h-10 max-sm:[&>button]:flex-1">
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
    <p className="flex min-h-8 min-w-48 flex-1 items-center gap-2 text-[13px] leading-snug text-pretty text-muted-foreground">
      {conversation.status === "waiting_analyst" && <Hand className="size-4 shrink-0 text-warning-foreground" />}
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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Button type="button" size="xs" variant="ghost" className="-ml-1.5" disabled={suggestion.isLoading} onClick={() => void askSuggestion()}>
          {suggestion.isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="text-primary" />}
          {suggestion.isLoading ? "Escrevendo sugestão…" : "Sugerir resposta"}
        </Button>
        {suggested !== null && <span className="text-xs text-muted-foreground">Sugestão do Farol: revise antes de enviar.</span>}
      </div>
      {warnings.map((warning) => (
        <p key={warning} role="alert" className="reveal flex gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs leading-relaxed text-warning-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {warning}
        </p>
      ))}
      {suggestion.isError && (
        <p role="alert" className="text-xs text-danger-foreground">
          {apiErrorMessage(suggestion.error)}
        </p>
      )}
      {/* Campo que cresce com o texto: a sugestão inteira fica à vista para o analista revisar. Enter envia; Shift+Enter quebra a linha. */}
      <div className="flex items-end gap-1 rounded-[22px] bg-background p-1.5 pl-2 max-md:rounded-[26px] max-md:p-1 max-md:pl-2 shadow-[0_0_0_1px_rgba(0,0,0,0.07)] transition-shadow duration-150 focus-within:bg-surface focus-within:shadow-[0_0_0_1px_var(--ring),0_0_0_4px_oklch(0.6_0.1_214/0.14)]">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={`Responder para ${employeeFirstName}…`}
          aria-label="Resposta do analista"
          className="scrollbar-quiet field-sizing-content max-h-40 min-h-8 flex-1 resize-none bg-transparent px-2 py-[5px] text-sm leading-[22px] outline-none placeholder:text-muted-foreground max-md:min-h-11 max-md:py-[11px] max-md:text-base"
        />
        <Button
          type="submit"
          size="icon-sm"
          className="disabled:bg-black/[0.08] disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none max-md:size-11"
          disabled={isLoading || !text.trim()}
          aria-label="Enviar"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <ArrowUp className="size-4" strokeWidth={2.5} />}
        </Button>
      </div>
      {isError && (
        <p role="alert" className="text-xs text-danger-foreground">
          {apiErrorMessage(error)}
        </p>
      )}
    </form>
  );
}
