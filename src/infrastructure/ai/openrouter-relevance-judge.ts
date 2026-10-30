/**
 * Avaliador de relevância pelo OpenRouter (padrão Corrective RAG): recebe a mensagem e os candidatos
 * da busca e diz qual se aplica, qual talvez se aplique ou nenhum. O critério e o formato foram
 * medidos no eval:busca (docs/validacao/BUSCA.md). Tem tempo máximo: se demorar, vale a regra de margem.
 */
import { articleText } from "@/application/knowledge-service";
import type { RelevanceJudge, RelevanceVerdict } from "@/application/ports";
import { ProviderHttpError } from "@/application/provider-breaker";
import type { Article } from "@/domain/knowledge";

const API = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 4000;

const SYSTEM = [
  "Você confere se algum artigo da central de ajuda de TI se aplica à mensagem de um funcionário.",
  "Um artigo se aplica só quando trata da mesma necessidade e da mesma situação da mensagem:",
  "- pedido de algo novo ou de troca (equipamento, acesso, software) → artigo que explica como pedir, não artigo de conserto;",
  "- algo que funcionava e parou ou falha → artigo do mesmo sintoma; sintoma diferente no mesmo aparelho não serve;",
  "- dúvida de como fazer → artigo que ensina aquilo.",
  "Se um artigo pode servir mas falta informação para ter certeza, diga talvez com esse artigo.",
  'Responda só JSON: {"aplica": "<id>" ou null, "talvez": "<id>" ou null}. No máximo um dos dois preenchido.',
].join("\n");

export class OpenRouterRelevanceJudge implements RelevanceJudge {
  /** Com o prefixo "openrouter/", como o LLM_MODEL; também é a chave do disjuntor. */
  readonly model: string;

  constructor(
    private readonly modelId: string,
    private readonly apiKey: string,
  ) {
    this.model = `openrouter/${modelId}`;
  }

  async judge(query: string, candidates: Article[]): Promise<RelevanceVerdict> {
    const list = candidates.map((a) => `id: ${a.id}\n${articleText(a)}`).join("\n---\n");
    const response = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: this.modelId,
        temperature: 0,
        reasoning: { effort: "minimal" },
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Mensagem: ${query}\n\nArtigos:\n${list}` },
        ],
      }),
    });
    if (!response.ok) throw new ProviderHttpError(response.status, "Avaliador");
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const json = body.choices?.[0]?.message?.content?.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error("Avaliador: resposta sem JSON");
    const parsed = JSON.parse(json) as { aplica?: unknown; talvez?: unknown };
    const id = (value: unknown) => (typeof value === "string" && value ? value : null);
    return { applies: id(parsed.aplica), maybe: id(parsed.talvez) };
  }
}
