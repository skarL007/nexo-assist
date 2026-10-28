"use client"; // limites de erro do Next são componentes de cliente

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/nexo/status-page";

/** Erro inesperado numa tela: mensagem simples e "Tentar de novo", sem detalhes técnicos. */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <StatusPage icon={TriangleAlert} title="Algo deu errado" action={<Button onClick={() => retry()}>Tentar de novo</Button>}>
      Não conseguimos mostrar esta tela agora. Tente de novo; se continuar, fale com o service desk pelo ramal 4000.
    </StatusPage>
  );
}
