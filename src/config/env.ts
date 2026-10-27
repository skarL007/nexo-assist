/**
 * Variáveis de ambiente validadas com Zod. É o único lugar que lê process.env.
 * Leitura preguiçosa: o build do Next não quebra se uma chave faltar.
 */
import { z } from "zod";

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OPENAI_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("openai/gpt-4.1-mini"),
  DATABASE_URL: z.string().default("file:local.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  AUTH_SECRET: z.string().min(32).default(DEV_SECRET),
  /** Chance de o "sistema legado" de chamados falhar numa chamada (0 a 1). */
  LEGACY_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.15),
  /** Teto global de respostas do agent por dia — protege o custo no deploy. */
  DAILY_AGENT_TURN_LIMIT: z.coerce.number().int().positive().default(500),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  if (parsed.NODE_ENV === "production" && parsed.AUTH_SECRET === DEV_SECRET) {
    throw new Error("Defina AUTH_SECRET em produção.");
  }
  cached = parsed;
  return parsed;
}
