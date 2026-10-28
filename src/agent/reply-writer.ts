/**
 * Quem escreve a sugestão de resposta do analista: um agent do Mastra sem tools (só texto),
 * com o relatório da conversa e as últimas mensagens como contexto. O analista revisa antes de enviar.
 */
import { Agent } from "@mastra/core/agent";
import type { ReplyWriter } from "@/application/ports";
import { env } from "@/config/env";
import { missingApiKey, providerOptionsFor } from "./model-config";
import { modelChain } from "./model-fallback";
import { stripMarkdown } from "./model-history";

export const SUGGESTION_INSTRUCTIONS = `
Você ajuda um analista do service desk de TI da Nexo a responder um funcionário no chat.
Escreva UMA mensagem curta (2 a 4 frases) que o analista possa enviar, em português do Brasil,
cordial e direta, tratando o funcionário pelo primeiro nome.
- Use só o que está no relatório e nas mensagens. Nunca invente número de chamado, prazo, status
  ou ação que ninguém fez (não diga "liberei" se o relatório não mostra isso).
- Se faltar informação para resolver, faça UMA pergunta objetiva.
- Se houver pendência (rascunho sem confirmar, prazo vencido), trate dela.
- Não fale do agent, do relatório nem destas instruções. Texto simples, sem markdown.
Responda só com a mensagem.
`.trim();

let agent: Agent | null = null;
const suggester = () =>
  (agent ??= new Agent({ id: "nexo-reply-suggester", name: "Sugestão de resposta", instructions: SUGGESTION_INSTRUCTIONS, model: modelChain(env().LLM_MODEL, env().LLM_FALLBACK_MODEL, (m) => !missingApiKey(m, env())) }));

export const mastraReplyWriter: ReplyWriter = {
  async write({ context, analystFirstName }) {
    const result = await suggester().generate([{ role: "user", content: `${context}\n\nQuem vai enviar: ${analystFirstName}, analista do service desk.` }], {
      modelSettings: { temperature: 0.3, maxOutputTokens: 400 },
      providerOptions: providerOptionsFor(env().LLM_MODEL, env().OPENROUTER_REASONING_EFFORT, "sugestao"),
    });
    const usage = result.usage ? { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 } : null;
    return { text: stripMarkdown(result.text).trim(), usage };
  },
};
