"use client";

import { useState } from "react";
import { BrandMark } from "@/components/nexo/brand";
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
        <Bubble side="left" className="bg-surface shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)]" time={time}>
          <AttachedImage message={message} viewer={viewer} />
          {message.text}
        </Bubble>
      );

    case "analyst":
      return (
        <Bubble
          side={viewer === "analyst" ? "right" : "left"}
          className="bg-success-soft text-foreground shadow-[0_0_0_1px_oklch(0.6_0.15_152/0.18)]"
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
    <div className={cn("flex w-full gap-3 sm:max-w-[88%]", right && "ml-auto")} data-testid="agent-reply">
      {/* O farol como avatar: identifica o agent em qualquer lado da conversa. No celular ele sobe para a linha do nome, e os cartões ganham a largura toda. */}
      <BrandMark className="mt-0.5 size-7 rounded-[8px] max-sm:hidden" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
        <AgentSteps steps={steps} working={working} open={open} onToggle={trace ? () => setOpen((v) => !v) : undefined} time={time} />
        {open && trace && (
          <div className="reveal w-full">
            <DecisionDetails trace={trace} />
          </div>
        )}
        {(text || working) && (
          <div className="max-w-full rounded-[20px] rounded-tl-md bg-surface px-4 py-2.5 text-[15px] leading-[1.55] break-words whitespace-pre-wrap shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.04)]">
            {text || <TypingDots />}
          </div>
        )}
        {cards.length > 0 && (
          <div className="w-full">
            <MessageCards cards={cards} actions={actions} draftStatuses={draftStatuses} />
          </div>
        )}
        {feedback && !working && <ReplyFeedback {...feedback} />}
      </div>
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
        <p className="max-w-md rounded-lg bg-muted px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
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
    <div className={cn("flex max-w-[85%] flex-col gap-1 sm:max-w-[78%]", side === "right" ? "ml-auto items-end" : "items-start")}>
      {label && <span className="px-1.5 text-[12px] font-semibold text-success-foreground">{label}</span>}
      <div
        className={cn(
          "rounded-[20px] px-4 py-2.5 text-[15px] leading-[1.5] break-words whitespace-pre-wrap",
          side === "right" ? "rounded-br-md" : "rounded-bl-md",
          className,
        )}
      >
        {children}
      </div>
      <span className="px-1.5 text-[11px] text-muted-foreground tabular-nums">{time}</span>
    </div>
  );
}

function SystemDivider({ text, time }: { text: string; time: string }) {
  return (
    <p className="mx-auto max-w-md py-2 text-center text-[12px] leading-relaxed text-pretty text-muted-foreground" role="note">
      <span className="font-medium">{text}</span>
      <span className="tabular-nums"> · {time}</span>
    </p>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1.5" aria-label="digitando">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}
