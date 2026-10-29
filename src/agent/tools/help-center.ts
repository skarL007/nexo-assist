import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { CHECK_OPTIONS, checksAsked, MAX_CHECKS } from "@/domain/diagnostics";
import { turnFrom } from "../turn-context";

export const searchHelpCenter = createTool({
  id: "searchHelpCenter",
  description:
    "Busca artigos da central de ajuda de TI. Use para dúvidas e antes de abrir chamado, " +
    "para ver se há solução de autoatendimento. Use palavras-chave (ex.: 'vpn erro 809'). " +
    "Artigo com checks traz verificações que o funcionário faz sozinho: peça uma por vez com askDiagnosticCheck.",
  inputSchema: z.object({
    query: z.string().min(2).max(200).describe("Palavras-chave do problema ou da dúvida"),
  }),
  execute: async ({ query }, context) => {
    const turn = turnFrom(context);
    const { matches, mode } = await turn.services.knowledge.search(query);

    // O trace mostra por que cada artigo veio: termos em comum e/ou proximidade de sentido.
    const why = (m: (typeof matches)[number]) =>
      [m.matchedTerms.length ? `termos: ${m.matchedTerms.join(", ")}` : null, m.similarity !== null ? `sentido ${m.similarity.toFixed(2).replace(".", ",")}` : null]
        .filter(Boolean)
        .join("; ");
    const found = matches.length ? matches.map((m) => `"${m.article.title}" (${why(m)})`).join(" · ") : `Nada encontrado para "${query}"`;
    turn.recorder.step("buscou na central de ajuda", mode === "hybrid" ? found : `${found} · busca só por palavras (embeddings indisponíveis)`);
    return {
      articles: matches.map(({ article }) => ({
        id: article.id,
        title: article.title,
        body: article.body,
        ...(article.checks?.length ? { checks: article.checks } : {}),
      })),
    };
  },
});

export const askDiagnosticCheck = createTool({
  id: "askDiagnosticCheck",
  description:
    "Pede ao funcionário UMA verificação de um artigo da central (id de checks devolvido por searchHelpCenter) e mostra os botões " +
    `${CHECK_OPTIONS.map((o) => `"${o}"`).join(" / ")}. O sistema guarda o resultado e o escreve no chamado se nada resolver. ` +
    `No máximo ${MAX_CHECKS} por conversa.`,
  inputSchema: z.object({
    checkId: z.string().min(2).max(60).describe("id da verificação no artigo (ex.: energia-cabo)"),
  }),
  execute: async ({ checkId }, context) => {
    const turn = turnFrom(context);
    // Limite de código: depois de 3 verificações, insistir só atrasa o chamado.
    const asked = checksAsked(await turn.services.messages.listRecent(turn.conversationId, 20));
    if (asked >= MAX_CHECKS) {
      turn.recorder.guardrail(`Já foram pedidas ${asked} verificações: o agent segue para o chamado em vez de pedir mais.`);
      return { asked: false, instruction: "Chega de verificações: monte o rascunho com draftNewTicket usando o que o funcionário já disse." };
    }
    const found = await turn.services.knowledge.findCheck(checkId);
    if (!found) {
      turn.recorder.guardrail(`Verificação "${checkId}" não existe na central: nada foi pedido.`);
      return { asked: false, instruction: "Esse id não existe. Use um id de checks devolvido por searchHelpCenter, ou siga para o chamado." };
    }
    turn.recorder.step("pediu uma verificação", found.check.label);
    turn.recorder.card({ kind: "quick_replies", options: [...CHECK_OPTIONS] });
    return {
      asked: true,
      check: found.check,
      instruction: "Em uma ou duas frases, peça para conferir o label e diga o que fazer (fix). Os botões já aparecem: não chame offerQuickReplies.",
    };
  },
});
