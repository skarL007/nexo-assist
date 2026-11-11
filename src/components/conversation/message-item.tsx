"use client";

import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import type { Card, ChatMessage, DraftStatus, TraceStep, TurnTrace } from "@/domain/message";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AgentSteps } from "./agent-steps";
import { DecisionDetails } from "./decision-details";
import { MessageCards, type CardActions } from "./message-cards";
import { ReplyFeedback, type ReplyFeedbackProps } from "./reply-feedback";

/** Quem está olhando a conversa: muda o lado de cada balão. */
export type Viewer = "employee" | "analyst";

interface MessageItemProps {
  message: ChatMessage;
  viewer: Viewer;
  actions?: CardActions;
  draftStatuses?: Record<number, DraftStatus>;
  /** "Isso resolveu?" (só em respostas do agent). */
  feedback?: ReplyFeedbackProps;
}

export function MessageItem({ message, viewer, actions, draftStatuses, feedback }: MessageItemProps) {
  const time = formatClock(message.createdAt);

  switch (message.role) {
    case "system":
      return <SystemDivider text={message.text} time={time} />;

    case "employee":
      return viewer === "employee" ? (
        <Bubble side="right" className="bg-primary text-primary-foreground" time={time}>
          <AttachedImage message={message} viewer={viewer} />
          {message.text}
        </Bubble>
      ) : (
        <Bubble side="left" className="border bg-surface shadow-xs" time={time}>
          <AttachedImage message={message} viewer={viewer} />
          {message.text}
        </Bubble>
      );

    case "analyst":
      return (
        <Bubble
          side={viewer === "analyst" ? "right" : "left"}
          className="border border-success/25 bg-success-soft"
          label={`${message.authorName ?? "Analista"} · service desk`}
          time={time}
        >
          {message.text}
        </Bubble>
      );

    case "agent":
      return (
        <AgentReply
          text={message.text}
          steps={message.trace?.steps ?? []}
          cards={message.cards}
          trace={message.trace}
          viewer={viewer}
          time={time}
          actions={actions}
          draftStatuses={draftStatuses}
          feedback={feedback}
        />
      );
  }
}

/** Resposta do agent — usada tanto para mensagens salvas quanto para a resposta chegando no stream. */
export function AgentReply({
  text,
  steps,
  cards,
  trace,
  viewer,
  time,
  working = false,
  actions,
  draftStatuses,
  feedback,
}: {
  text: string;
  steps: TraceStep[];
  cards: Card[];
  trace?: TurnTrace | null;
  viewer: Viewer;
  time?: string;
  working?: boolean;
  actions?: CardActions;
  draftStatuses?: Record<number, DraftStatus>;
  feedback?: ReplyFeedbackProps;
}) {
  const [open, setOpen] = useState(false);
  const right = viewer === "analyst";

  return (
    <div className={cn("relative flex max-w-[92%] flex-col gap-3 pl-5", right && "ml-auto")} data-testid="agent-reply">
      {/* Linha do tempo da resposta: o ponto âmbar é o início (a luz acendendo) e a linha fina leva aos passos e aos cartões. */}
      <span aria-hidden="true" className="absolute top-3 bottom-0 left-[3px] w-px bg-border" />
      <span aria-hidden="true" className="absolute top-[3px] left-0 size-[7px] rounded-full bg-beam ring-[3px] ring-background" />
      <AgentSteps steps={steps} working={working} open={open} onToggle={trace ? () => setOpen((v) => !v) : undefined} time={time} />
      {open && trace && (
        <div className="w-full">
          <DecisionDetails trace={trace} />
        </div>
      )}
      {(text || working) && <div className="text-sm leading-relaxed whitespace-pre-wrap">{text || <TypingDots />}</div>}
      <div className="w-full">
        <MessageCards cards={cards} actions={actions} draftStatuses={draftStatuses} />
      </div>
      {feedback && !working && <ReplyFeedback {...feedback} />}
    </div>
  );
}

/**
 * Imagem anexada pelo funcionário, servida pela rota que confere quem pode ver.
 * O analista vê também a leitura automática, que foi o que o agent recebeu no lugar da imagem.
 */
function AttachedImage({ message, viewer }: { message: ChatMessage; viewer: Viewer }) {
  if (!message.screenshot) return null;
  const src = `/api/chat/screenshots/${encodeURIComponent(message.id)}`;
  return (
    <div className="mb-2 space-y-1.5">
      <a href={src} target="_blank" rel="noreferrer" title="Abrir a imagem em tamanho real">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem privada, servida com sessão */}
        <img src={src} alt="Imagem anexada pelo funcionário" className="max-h-48 rounded-lg border border-black/5" loading="lazy" />
      </a>
      {viewer === "analyst" && message.screenshot.status === "read" && message.screenshot.description && (
        <p className="max-w-md rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Leitura automática:</span> {message.screenshot.description}
        </p>
      )}
      {viewer === "analyst" && message.screenshot.status === "failed" && (
        <p className="text-xs text-muted-foreground">Leitura automática falhou: o agent pediu o erro por texto.</p>
      )}
    </div>
  );
}

function Bubble({
  side,
  className,
  label,
  time,
  children,
}: {
  side: "left" | "right";
  className: string;
  label?: string;
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex max-w-[78%] flex-col gap-1", side === "right" ? "ml-auto items-end" : "items-start")}>
      {label && <span className="text-xs font-semibold text-success-foreground">{label}</span>}
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          side === "right" ? "rounded-br-md" : "rounded-bl-md",
          className,
        )}
      >
        {children}
      </div>
      <span className="px-1 font-mono text-[11px] text-muted-foreground tabular-nums">{time}</span>
    </div>
  );
}

function SystemDivider({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground" role="note">
      <span className="h-px flex-1 bg-border" />
      <span className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1">
        <ArrowLeftRight className="size-3 text-primary" />
        <span>{text}</span>
        <span className="font-mono text-[11px] tabular-nums">· {time}</span>
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1.5" aria-label="digitando">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}
