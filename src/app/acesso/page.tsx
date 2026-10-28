import { Lock } from "lucide-react";
import { StatusPage } from "@/components/nexo/status-page";

/** Mostrada pelo proxy quando falta o token de acesso do deploy. */
export default function RestrictedAccessPage() {
  return (
    <StatusPage icon={Lock} title="Acesso restrito">
      Esta demonstração usa um modelo de IA pago. Abra pelo link de acesso que você recebeu. Os links expiram: se este
      parou de funcionar, peça um novo.
    </StatusPage>
  );
}
