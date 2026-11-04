/**
 * Variáveis de ambiente validadas com Zod. É o único lugar que lê process.env.
 * Leitura preguiçosa: o build do Next não quebra se uma chave faltar.
 */
import { z } from "zod";
import { REASONING_EFFORTS } from "@/agent/model-config";
import { DEFAULT_FALLBACK_MODEL } from "@/agent/model-fallback";

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Chave do Gemini (Google AI Studio). O Mastra lê esta variável sozinho. */
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  /** Chave do OpenRouter: benchmark de modelos e LLM_MODEL="openrouter/<fornecedor>/<modelo>". */
  OPENROUTER_API_KEY: z.string().optional(),
  /** Chave da DeepInfra (API no formato da OpenAI): LLM_MODEL="deepinfra/<fornecedor>/<modelo>", embeddings e avaliador. */
  DEEPINFRA_API_KEY: z.string().optional(),
  /** Embeddings pela DeepInfra, 1º provedor da busca híbrida quando há a chave. "off" desliga. Outro modelo pede nova margem. */
  DEEPINFRA_EMBEDDING_MODEL: z.string().default("Qwen/Qwen3-Embedding-8B"),
  /** Leitura de imagens anexadas (captura de tela ou foto), "deepinfra/<fornecedor>/<modelo>". "off" desliga. */
  VISION_MODEL: z.string().default("deepinfra/mistralai/Mistral-Small-3.1-24B-Instruct-2503"),
  /** Teto de gasto com LLM por dia (UTC) e no total, em US$ (livro-caixa em usage_counters ou em SPEND_LEDGER_FILE). */
  LLM_DAILY_BUDGET_USD: z.coerce.number().positive().optional(),
  LLM_TOTAL_BUDGET_USD: z.coerce.number().positive().optional(),
  /** Livro-caixa num arquivo (evals locais, que recriam o banco a cada execução). */
  SPEND_LEDGER_FILE: z.string().optional(),
  /** Raciocínio pedido aos modelos via OpenRouter ("minimal" = mesmo nível do Gemini direto). */
  OPENROUTER_REASONING_EFFORT: z.enum(REASONING_EFFORTS).default("minimal"),
  /** Formato "provedor/modelo" do roteador de modelos do Mastra. */
  LLM_MODEL: z.string().default("google/gemini-3.5-flash"),
  /** Modelo reserva quando o principal falha (ex.: 503 "alta demanda"). "off" desliga. */
  LLM_FALLBACK_MODEL: z.string().default(DEFAULT_FALLBACK_MODEL),
  /** Embeddings pelo OpenRouter, 1º provedor da busca híbrida (usa a OPENROUTER_API_KEY). "off" desliga. Outro modelo pede nova margem: `npm run eval:busca`. */
  OPENROUTER_EMBEDDING_MODEL: z.string().default("google/gemini-embedding-2"),
  /** Avaliador de relevância da busca (OpenRouter, usa a OPENROUTER_API_KEY): diz qual candidato se aplica. "off" desliga. */
  RELEVANCE_JUDGE_MODEL: z.string().default("google/gemini-3.5-flash-lite"),
  /** Modelo de embeddings do Gemini direto, 2º provedor da busca híbrida (usa a mesma chave do Google). */
  EMBEDDING_MODEL: z.string().default("gemini-embedding-2"),
  DATABASE_URL: z.string().default("file:local.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  PUBLIC_DEMO: z.enum(["0", "1"]).default("0"),
  AUTH_SECRET: z.string().min(32).default(DEV_SECRET),
  /** Chance de o "sistema legado" de chamados falhar numa chamada (0 a 1). */
  LEGACY_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.15),
  /** Teto global de respostas do agent por dia — protege o custo no deploy. */
  DAILY_AGENT_TURN_LIMIT: z.coerce.number().int().positive().default(500),
  /** Teto total de respostas do modelo (gasto fixo da demonstração). Vazio = sem teto. */
  TOTAL_AGENT_TURN_LIMIT: z.coerce.number().int().positive().optional(),
  /** Telemetria opcional (OpenTelemetry GenAI). Langfuse: as duas chaves bastam. */
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.url().optional(),
  /** Qualquer coletor OTLP/HTTP (variáveis padrão do OpenTelemetry). */
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.url().optional(),
  OTEL_EXPORTER_OTLP_TRACES_HEADERS: z.string().optional(),
  /** Token do Prometheus para ler /api/metrics (Authorization: Bearer). Sem ele, a rota responde 404. */
  METRICS_TOKEN: z.string().min(16).optional(),
  /** "true" manda também o texto da conversa e os argumentos das tools (dado pessoal: desligado por padrão). */
  /**
   * Login de demonstração: só o e-mail de um funcionário do seed, sem conferir senha (regra do desafio).
   * Sem definir, vale quando não há SSO e desliga com SSO configurado (src/server/auth-mode.ts).
   */
  DEMO_LOGIN: z.enum(["0", "1"]).optional(),
  /** SSO opcional (OpenID Connect). Com as três primeiras, o login de demonstração desliga (salvo DEMO_LOGIN=1). */
  OIDC_ISSUER: z.url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_LABEL: z.string().default("SSO corporativo"),
  OIDC_ALLOWED_DOMAIN: z.string().optional(),
  OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
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
