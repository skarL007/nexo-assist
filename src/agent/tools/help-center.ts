import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchArticles } from "@/domain/knowledge";
import { turnFrom } from "../turn-context";

export const searchHelpCenter = createTool({
  id: "searchHelpCenter",
  description:
    "Busca artigos da central de ajuda de TI. Use para dúvidas e antes de abrir chamado, " +
    "para ver se há solução de autoatendimento. Use palavras-chave (ex.: 'vpn erro 809').",
  inputSchema: z.object({
    query: z.string().min(2).describe("Palavras-chave do problema ou da dúvida"),
  }),
  execute: async ({ query }, context) => {
    const turn = turnFrom(context);
    const matches = searchArticles(await turn.services.articles.listAll(), query);

    turn.recorder.step(
      "buscou na central de ajuda",
      matches.length ? matches.map((m) => `"${m.article.title}" (termos: ${m.matchedTerms.join(", ")})`).join(" · ") : `Nada encontrado para "${query}"`,
    );
    return {
      articles: matches.map(({ article }) => ({ id: article.id, title: article.title, body: article.body })),
    };
  },
});
