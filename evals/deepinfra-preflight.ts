/**
 * Pré-voo dos modelos da DeepInfra (frações de centavo): antes de rodar evals caros, confere em
 * cada candidato se chama a ferramenta certa em português, quanto demora, quanto custa (o
 * `usage.estimated_cost` da própria DeepInfra) e se devolve logprobs (a G-Eval precisa).
 *
 *   npx tsx --env-file=.env evals/deepinfra-preflight.ts
 */
const BASE = "https://api.deepinfra.com/v1/openai";
const key = process.env.DEEPINFRA_API_KEY;
if (!key) throw new Error("Defina DEEPINFRA_API_KEY no .env.");

const CHAT = (
  process.argv.find((a) => a.startsWith("--modelos="))?.split("=")[1] ??
  "deepseek-ai/DeepSeek-V4-Flash,Qwen/Qwen3.8-Flash,zai-org/GLM-5.3-Flash,openai/gpt-oss-120b"
).split(",");
const EMBEDDINGS = ["Qwen/Qwen3-Embedding-8B", "BAAI/bge-m3"];

const tool = {
  type: "function",
  function: {
    name: "searchHelpCenter",
    description:
      "Busca artigos da central de ajuda de TI. Use para dúvidas e antes de abrir chamado.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Palavras-chave do problema" },
      },
      required: ["query"],
    },
  },
};

async function post(path: string, body: unknown) {
  const started = Date.now();
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  // Resposta crua da API: só lida aqui, para imprimir.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await response.json().catch(() => ({}))) as Record<string, any>;
  return { status: response.status, ms: Date.now() - started, json };
}

let total = 0;
const cost = (json: { usage?: { estimated_cost?: number } }) => {
  const usd = Number(json.usage?.estimated_cost ?? 0);
  total += usd;
  return usd;
};

async function main() {
  for (const model of CHAT) {
    const call = await post("/chat/completions", {
      model,
      temperature: 0,
      max_tokens: 300,
      tools: [tool],
      messages: [
        {
          role: "system",
          content:
            "Você é o assistente de TI da Nexo. Responda em português do Brasil. Use as ferramentas.",
        },
        {
          role: "user",
          content: "minha vpn dá erro 809 desde ontem, tem algum artigo?",
        },
      ],
    });
    const toolCall = call.json.choices?.[0]?.message?.tool_calls?.[0]?.function;
    const probe = await post("/chat/completions", {
      model,
      temperature: 1,
      max_tokens: 5,
      logprobs: true,
      top_logprobs: 5,
      messages: [
        {
          role: "user",
          content:
            "Dê uma nota de 1 a 5 para a frase 'Seu chamado foi aberto.' Responda só com o dígito.",
        },
      ],
    });
    const logprobs =
      probe.json.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs?.length ??
      0;
    console.log(
      `${model.padEnd(36)} tool: ${call.status === 200 ? (toolCall ? `${toolCall.name}(${toolCall.arguments})` : "NÃO CHAMOU") : `HTTP ${call.status} ${JSON.stringify(call.json).slice(0, 120)}`}` +
        ` · ${call.ms} ms · US$ ${cost(call.json).toFixed(6)} · logprobs: ${probe.status === 200 ? `${logprobs} alternativas` : `HTTP ${probe.status}`} (US$ ${cost(probe.json).toFixed(6)})`,
    );
  }

  for (const model of EMBEDDINGS) {
    const texts = [
      "minha vpn não conecta de casa",
      "VPN com erro 809: reinstale o cliente de VPN",
      "Impressora não imprime",
    ];
    const result = await post("/embeddings", {
      model,
      input: texts,
      dimensions: 768,
      encoding_format: "float",
    });
    const vectors: number[][] =
      result.json.data?.map((d: { embedding: number[] }) => d.embedding) ?? [];
    const cosine = (a: number[], b: number[]) =>
      a.reduce((s, v, i) => s + v * b[i], 0) /
      Math.sqrt(
        a.reduce((s, v) => s + v * v, 0) * b.reduce((s, v) => s + v * v, 0),
      );
    console.log(
      `${model.padEnd(36)} embeddings: HTTP ${result.status} · ${vectors[0]?.length ?? 0} dimensões · ${result.ms} ms` +
        (vectors.length === 3
          ? ` · cos(vpn, artigo VPN) ${cosine(vectors[0], vectors[1]).toFixed(3)} × cos(vpn, impressora) ${cosine(vectors[0], vectors[2]).toFixed(3)}`
          : ` ${JSON.stringify(result.json).slice(0, 160)}`) +
        ` · US$ ${cost(result.json).toFixed(6)}`,
    );
  }
  console.log(`\nCusto do pré-voo: US$ ${total.toFixed(5)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
