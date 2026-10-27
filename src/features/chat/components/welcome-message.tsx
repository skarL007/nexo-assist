import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "Minha VPN dá erro 809",
  "Qual o status do meu chamado?",
  "Preciso de um segundo monitor",
  "Qual o horário do service desk?",
];

/** Primeira tela de uma conversa nova. */
export function WelcomeMessage({ firstName, onPick }: { firstName: string; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <span className="text-xs font-semibold">Nexo Assist</span>
      <div className="rounded-2xl rounded-tl-sm border bg-surface px-4 py-3 text-sm shadow-xs">
        Olá, {firstName}! Me conte o que está acontecendo com as suas palavras. Posso tirar dúvidas, ver seus chamados, abrir
        um novo ou chamar um analista.
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button key={suggestion} size="sm" variant="outline" onClick={() => onPick(suggestion)}>
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
