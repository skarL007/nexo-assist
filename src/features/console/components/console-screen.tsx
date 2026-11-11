"use client";

import { AlertCircle, Loader2, MessagesSquare } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLiveUpdates } from "@/lib/use-live-updates";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/store/hooks";
import { consoleApi, useGetConversationQuery, useListConversationsQuery, useListKnownIssuesQuery } from "../console-api";
import { ConsoleMobileBar, ConsoleRail } from "./console-rail";
import { ConversationList } from "./conversation-list";
import { ConversationPanel } from "./conversation-panel";
import { TicketsPanel } from "./tickets-panel";

const LIST_POLL_MS = 4000;
const DETAIL_POLL_MS = 3000;
/** Com o stream aberto, o polling vira só uma rede de segurança. */
const SAFETY_POLL_MS = 30_000;

/**
 * Console do analista: lista de conversas, conversa aberta e chamados do funcionário.
 * Abaixo de 1024 px aparece um painel por vez (a lista ou a conversa), com "voltar" no cabeçalho.
 */
export function ConsoleScreen({ analyst }: { analyst: { id: string; name: string } }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Só vale em tela estreita: qual dos dois painéis está à vista. Em tela larga os dois aparecem sempre.
  const [pane, setPane] = useState<"list" | "detail">("list");
  const dispatch = useAppDispatch();
  // Tempo real: o servidor avisa "mudou" e a lista e a conversa aberta são buscadas de novo.
  const refresh = useCallback(() => dispatch(consoleApi.util.invalidateTags(["Conversation"])), [dispatch]);
  const live = useLiveUpdates("/api/console/stream", refresh) === "live";
  const list = useListConversationsQuery(undefined, { pollingInterval: live ? SAFETY_POLL_MS : LIST_POLL_MS });

  // Sem seleção, abre a primeira da fila — e fixa a escolha, para não pular quando ela sair da fila.
  const fallbackId = list.data?.find((c) => c.status === "waiting_analyst")?.id ?? list.data?.[0]?.id ?? null;
  // Ajuste de estado durante o render (padrão do React para "derivar e fixar" um valor).
  if (!selectedId && fallbackId) setSelectedId(fallbackId);
  const activeId = selectedId ?? fallbackId;
  const detail = useGetConversationQuery(activeId ?? "", { skip: !activeId, pollingInterval: live ? SAFETY_POLL_MS : DETAIL_POLL_MS });
  const knownIssues = useListKnownIssuesQuery(undefined, { pollingInterval: live ? SAFETY_POLL_MS : LIST_POLL_MS });
  const queueSize = list.data?.filter((c) => c.status === "waiting_analyst").length ?? 0;

  const select = (id: string) => {
    setSelectedId(id);
    setPane("detail");
  };
  const backToList = () => setPane("list");

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      <ConsoleMobileBar active="conversas" queueSize={queueSize} />
      <ConsoleRail active="conversas" analystName={analyst.name} queueSize={queueSize} />

      {list.isLoading ? (
        <Centered>
          <Loading>Carregando conversas…</Loading>
        </Centered>
      ) : list.isError ? (
        <Centered>
          <Failure onRetry={() => void list.refetch()}>Não foi possível carregar as conversas.</Failure>
        </Centered>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1">
          <ConversationList
            className={cn(pane === "detail" && "max-lg:hidden")}
            live={live}
            knownIssues={knownIssues.data ?? []}
            conversations={list.data ?? []}
            analystId={analyst.id}
            selectedId={activeId}
            onSelect={select}
          />
          <div className={cn("flex min-w-0 flex-1", pane === "list" && "max-lg:hidden")}>
            {detail.data && detail.data.id === activeId ? (
              <>
                {/* key: trocar de conversa zera o texto digitado e o erro da anterior (senão iriam para outra pessoa). */}
                <ConversationPanel key={detail.data.id} conversation={detail.data} analystId={analyst.id} onBack={backToList} />
                <TicketsPanel employeeName={detail.data.employee.name} tickets={detail.data.tickets} ticketCode={detail.data.ticketCode} slaAlerts={detail.data.slaAlerts} />
              </>
            ) : detail.isError ? (
              <Centered onBack={backToList}>
                <Failure onRetry={() => void detail.refetch()}>Não foi possível abrir esta conversa.</Failure>
              </Centered>
            ) : (
              <Centered onBack={backToList}>
                {activeId ? (
                  <Loading>Carregando conversa…</Loading>
                ) : (
                  <span className="flex flex-col items-center gap-3">
                    <MessagesSquare className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
                    Selecione uma conversa.
                  </span>
                )}
              </Centered>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <Loader2 className="size-4 animate-spin" /> {children}
    </span>
  );
}

/** Falha de carregamento: o que houve e o caminho para tentar de novo, sem detalhe técnico. */
function Failure({ children, onRetry }: { children: React.ReactNode; onRetry: () => void }) {
  return (
    <span role="alert" className="flex max-w-xs flex-col items-center gap-3 text-center text-foreground">
      <span className="grid size-10 place-items-center rounded-full bg-danger-soft text-danger-foreground">
        <AlertCircle className="size-5" strokeWidth={1.75} />
      </span>
      {children}
      <Button size="sm" variant="outline" onClick={onRetry}>
        Tentar de novo
      </Button>
    </span>
  );
}

function Centered({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="relative grid flex-1 place-items-center bg-background px-6 text-sm text-muted-foreground">
      {onBack && (
        <Button size="sm" variant="ghost" className="absolute top-3 left-3 lg:hidden" onClick={onBack}>
          Voltar para as conversas
        </Button>
      )}
      {children}
    </div>
  );
}
