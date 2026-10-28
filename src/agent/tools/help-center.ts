import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { turnFrom } from "../turn-context";

export const searchHelpCenter = createTool({
  id: "searchHelpCenter",
  description:
    "Busca artigos da central de ajuda de TI. Use para dúvidas e antes de abrir chamado, " +
    "para ver se há solução de autoatendimento. Use palavras-chave (ex.: 'vpn erro 809').",
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
      articles: matches.map(({ article }) => ({ id: article.id, title: article.title, body: article.body })),
    };
  },
});
