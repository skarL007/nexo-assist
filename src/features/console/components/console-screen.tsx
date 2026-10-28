"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useGetConversationQuery, useListConversationsQuery } from "../console-api";
import { ConsoleRail } from "./console-rail";
import { ConversationList } from "./conversation-list";
import { ConversationPanel } from "./conversation-panel";
import { TicketsPanel } from "./tickets-panel";

const LIST_POLL_MS = 4000;
const DETAIL_POLL_MS = 3000;

/** Console do analista: lista de conversas, conversa aberta e chamados do funcionário. */
export function ConsoleScreen({ analyst }: { analyst: { id: string; name: string } }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useListConversationsQuery(undefined, { pollingInterval: LIST_POLL_MS });

  // Sem seleção, abre a primeira da fila — e fixa a escolha, para não pular quando ela sair da fila.
  const fallbackId = list.data?.find((c) => c.status === "waiting_analyst")?.id ?? list.data?.[0]?.id ?? null;
  // Ajuste de estado durante o render (padrão do React para "derivar e fixar" um valor).
  if (!selectedId && fallbackId) setSelectedId(fallbackId);
  const activeId = selectedId ?? fallbackId;
  const detail = useGetConversationQuery(activeId ?? "", { skip: !activeId, pollingInterval: DETAIL_POLL_MS });
  const queueSize = list.data?.filter((c) => c.status === "waiting_analyst").length ?? 0;

  return (
    <div className="flex h-screen">
      <ConsoleRail active="conversas" analystName={analyst.name} queueSize={queueSize} />

      {list.isLoading ? (
        <Centered>Carregando conversas…</Centered>
      ) : list.isError ? (
        <Centered>
          <span role="alert" className="flex flex-col items-center gap-3">
            Não foi possível carregar as conversas.
            <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
              Tentar de novo
            </Button>
          </span>
        </Centered>
      ) : (
        <>
          <ConversationList conversations={list.data ?? []} analystId={analyst.id} selectedId={activeId} onSelect={setSelectedId} />
          {detail.data && detail.data.id === activeId ? (
            <>
              {/* key: trocar de conversa zera o texto digitado e o erro da anterior (senão iriam para outra pessoa). */}
              <ConversationPanel key={detail.data.id} conversation={detail.data} analystId={analyst.id} />
              <TicketsPanel employeeName={detail.data.employee.name} tickets={detail.data.tickets} ticketCode={detail.data.ticketCode} />
            </>
          ) : detail.isError ? (
            <Centered>
              <span role="alert" className="flex flex-col items-center gap-3">
                Não foi possível abrir esta conversa.
                <Button size="sm" variant="outline" onClick={() => void detail.refetch()}>
                  Tentar de novo
                </Button>
              </span>
            </Centered>
          ) : (
            <Centered>{activeId ? "Carregando conversa…" : "Selecione uma conversa."}</Centered>
          )}
        </>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid flex-1 place-items-center text-sm text-muted-foreground">{children}</div>;
}
