/**
 * Variáveis de ambiente validadas com Zod. É o único lugar que lê process.env.
 * Leitura preguiçosa: o build do Next não quebra se uma chave faltar.
 */
import { z } from "zod";
import { REASONING_EFFORTS } from "@/agent/model-config";

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Chave do Gemini (Google AI Studio). O Mastra lê esta variável sozinho. */
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  /** Chave do OpenRouter: benchmark de modelos e LLM_MODEL="openrouter/<fornecedor>/<modelo>". */
  OPENROUTER_API_KEY: z.string().optional(),
  /** Raciocínio pedido aos modelos via OpenRouter ("minimal" = mesmo nível do Gemini direto). */
  OPENROUTER_REASONING_EFFORT: z.enum(REASONING_EFFORTS).default("minimal"),
  /** Formato "provedor/modelo" do roteador de modelos do Mastra. */
  LLM_MODEL: z.string().default("google/gemini-3.5-flash"),
  /** Modelo de embeddings do Gemini para a busca híbrida na central (usa a mesma chave do Google). */
  EMBEDDING_MODEL: z.string().default("gemini-embedding-2"),
  DATABASE_URL: z.string().default("file:local.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  AUTH_SECRET: z.string().min(32).default(DEV_SECRET),
  /** Chance de o "sistema legado" de chamados falhar numa chamada (0 a 1). */
  LEGACY_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.15),
  /** Teto global de respostas do agent por dia — protege o custo no deploy. */
  DAILY_AGENT_TURN_LIMIT: z.coerce.number().int().positive().default(500),
  /** Teto total de respostas do modelo (gasto fixo da demonstração). Vazio = sem teto. */
  TOTAL_AGENT_TURN_LIMIT: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  // Variável vazia no .env (ex.: "AUTH_SECRET=") conta como não definida.
  const defined = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));
  // A integração do Turso no Marketplace da Vercel cria as variáveis com o prefixo TURSO_.
  defined.DATABASE_URL ??= defined.TURSO_DATABASE_URL;
  defined.DATABASE_AUTH_TOKEN ??= defined.TURSO_AUTH_TOKEN;
  const parsed = schema.parse(defined);
  if (parsed.NODE_ENV === "production" && parsed.AUTH_SECRET === DEV_SECRET) {
    throw new Error("Defina AUTH_SECRET em produção.");
  }
  // Na Vercel o disco é temporário: sem DATABASE_URL os dados sumiriam a cada deploy.
  if (parsed.NODE_ENV === "production" && !defined.DATABASE_URL) {
    throw new Error("Defina DATABASE_URL em produção.");
  }
  cached = parsed;
  return parsed;
}
