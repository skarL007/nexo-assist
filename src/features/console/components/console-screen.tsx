"use client";

import { MessagesSquare } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/nexo/brand";
import { PersonAvatar } from "@/components/nexo/person-avatar";
import { LogoutButton } from "@/features/shell/employee-sidebar";
import { useGetConversationQuery, useListConversationsQuery } from "../console-api";
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
      <nav className="flex w-14 shrink-0 flex-col items-center gap-4 border-r bg-surface py-4">
        <BrandMark />
        <span className="relative grid size-9 place-items-center rounded-md bg-accent text-accent-foreground" title="Conversas">
          <MessagesSquare className="size-4" />
          {queueSize > 0 && (
            <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {queueSize}
            </span>
          )}
        </span>
        <div className="mt-auto flex flex-col items-center gap-2">
          <PersonAvatar name={analyst.name} className="size-8" online />
          <LogoutButton className="px-2" />
        </div>
      </nav>

      {list.isLoading ? (
        <Centered>Carregando conversas…</Centered>
      ) : list.isError ? (
        <Centered>Não foi possível carregar as conversas.</Centered>
      ) : (
        <>
          <ConversationList conversations={list.data ?? []} analystId={analyst.id} selectedId={activeId} onSelect={setSelectedId} />
          {detail.data && detail.data.id === activeId ? (
            <>
              <ConversationPanel conversation={detail.data} analystId={analyst.id} />
              <TicketsPanel employeeName={detail.data.employee.name} tickets={detail.data.tickets} ticketCode={detail.data.ticketCode} />
            </>
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
