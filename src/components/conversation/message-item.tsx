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
        <Bubble side="right" className="bg-navy text-navy-foreground" time={time}>
          {message.text}
        </Bubble>
      ) : (
        <Bubble side="left" className="border bg-surface" time={time}>
          {message.text}
        </Bubble>
      );

    case "analyst":
      return (
        <Bubble
          side={viewer === "analyst" ? "right" : "left"}
          className="border border-success/20 bg-success-soft"
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
    <div className={cn("flex max-w-[85%] flex-col gap-2", right ? "ml-auto items-end" : "items-start")} data-testid="agent-reply">
      <AgentSteps steps={steps} working={working} open={open} onToggle={trace ? () => setOpen((v) => !v) : undefined} />
      {open && trace && (
        <div className="w-full">
          <DecisionDetails trace={trace} />
        </div>
      )}
      {(text || working) && (
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
            right ? "rounded-tr-sm bg-info-soft" : "rounded-tl-sm border bg-surface shadow-xs",
          )}
        >
          {text || <TypingDots />}
          {time && <span className="ml-2 text-[11px] text-muted-foreground">{time}</span>}
        </div>
      )}
      <div className="w-full">
        <MessageCards cards={cards} actions={actions} draftStatuses={draftStatuses} />
      </div>
      {feedback && !working && <ReplyFeedback {...feedback} />}
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
    <div className={cn("flex max-w-[75%] flex-col gap-1", side === "right" ? "ml-auto items-end" : "items-start")}>
      {label && <span className="text-xs font-semibold">{label}</span>}
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          side === "right" ? "rounded-tr-sm" : "rounded-tl-sm",
          className,
        )}
      >
        {children}
        <span className="ml-2 text-[11px] opacity-60">{time}</span>
      </div>
    </div>
  );
}

function SystemDivider({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground" role="note">
      <span className="h-px flex-1 bg-border" />
      <ArrowLeftRight className="size-3.5" />
      <span>
        {text} · {time}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="digitando">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}
