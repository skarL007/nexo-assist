import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/nexo/status-page";

/** Endereço que não existe (404), em português e no visual do app. */
export default function NotFound() {
  return (
    <StatusPage
      icon={SearchX}
      title="Página não encontrada"
      action={
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      }
    >
      O endereço não existe ou mudou. Volte ao início para continuar o atendimento.
    </StatusPage>
  );
}
