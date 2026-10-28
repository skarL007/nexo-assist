# Telemetria (OpenTelemetry / Langfuse) e SSO (OpenID Connect)

Os dois vêm **desligados**. Sem as variáveis, nada muda no comportamento (`.env.example` lista todas). Este protótipo não tem conta em Langfuse nem em provedor de identidade, então **não testei contra um serviço real**. Em vez disso, testei contra servidores locais que seguem os mesmos protocolos e falham se o app errar algum passo. O que muda com um serviço real está no fim de cada seção.

## Telemetria dos turnos do agent

**O que faz:** ao fim de cada turno, o trace que o console já mostra vira spans no padrão OpenTelemetry, com as [convenções GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/). O trace leva decisão, tools, tokens e tempo. O envio é OTLP/HTTP em JSON:

- **Span raiz** `invoke_agent nexo-assist`. Leva `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`/`output_tokens`, `gen_ai.conversation.id`, a intenção e a confiança.
- **Um span por tool**, `execute_tool <nome>`, filho da raiz.
- **Langfuse:** as duas chaves configuram o endpoint `/api/public/otel/v1/traces`, o Basic auth e o cabeçalho `x-langfuse-ingestion-version: 4`, conforme a documentação atual do Langfuse. A conversa vira `langfuse.session.id`.
- **Outro backend:** as variáveis padrão `OTEL_EXPORTER_OTLP_TRACES_*` levam os spans a qualquer coletor (Phoenix, Honeycomb, Grafana, um OTel Collector).

**Privacidade por padrão:**

- Sem `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true`, nenhum texto da conversa sai, nem argumentos ou resultados de tools.
- O funcionário vira um pseudônimo, um sha256 curto do id. Isso permite agrupar por pessoa sem dizer quem é.

**Falha não derruba o turno:** o envio espera no máximo 2 s. Erro e demora viram um log `[telemetria]`.

### Provas

| O quê | Como | Resultado |
|---|---|---|
| Mapeamento GenAI | [`telemetry.test.ts`](../../src/infrastructure/telemetry/telemetry.test.ts) | raiz com modelo, tokens e sessão; tools como filhas, em sequência |
| Sem dado pessoal por padrão | mesmo teste: o JSON enviado não contém "VPN caiu", "Ana", "financeiro", o id nem a resposta | ✓ |
| Configuração Langfuse e OTLP | mesmo teste: endpoint, Basic com as chaves, versão de ingestão, cabeçalhos padrão | ✓ |
| Envio de verdade | mesmo teste: **servidor HTTP local** recebe o JSON e confere o content-type, a autorização e os 3 spans | ✓ |
| Coletor com erro ou lento | mesmo teste: 401 vira log; coletor que demora 500 ms com timeout de 100 ms não segura o turno | ✓ |
| **Turno real do agent** | `npm run otel:local` + `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces npm run eval -- consulta` | spans recebidos (abaixo); `grep` por nome e e-mail no arquivo gravado: 0 ocorrências |

Saída do coletor local no turno real (Gemini 3.5 Flash, cenário "Consulta sem número com vários chamados abertos"):

```
● invoke_agent nexo-assist — gemini-3.5-flash · 8885+437 tokens · 12292 ms · intenção ticket_status
   └ execute_tool recordUnderstanding — 1495 ms
   └ execute_tool recordUnderstanding — 1203 ms
   └ execute_tool recordUnderstanding — 846 ms
   └ execute_tool recordUnderstanding — 600 ms
   └ execute_tool recordUnderstanding — 296 ms
   └ execute_tool recordUnderstanding — 55 ms
   └ execute_tool listMyTickets — 20 ms
```

**Achado que a telemetria mostrou:** no passo 0, o modelo é obrigado a chamar `recordUnderstanding`. Nesse turno, ele emitiu **6 chamadas em paralelo** da mesma tool. A resposta saiu certa e o eval passou, mas essas chamadas gastam tokens de saída e tempo. Na tela do console aparecem como uma só, porque a lista de tools é deduplicada; só a visão de spans revelou o problema. É exatamente para isso que serve a observabilidade fora do app. Fica registrado como próximo ajuste: tornar o registro idempotente e medir de novo os tokens por turno no eval.

**Com Langfuse de verdade:** basta definir `LANGFUSE_PUBLIC_KEY` e `LANGFUSE_SECRET_KEY` na Vercel. O formato enviado é o mesmo que o teste recebe. O que não testei é a interpretação do lado do Langfuse, como a tela de sessão e o cálculo de custo a partir de `gen_ai.usage.*`.

## SSO com OpenID Connect

**O que faz:** com `OIDC_ISSUER`, `OIDC_CLIENT_ID` e `OIDC_CLIENT_SECRET` definidos, o login ganha "Entrar com {OIDC_LABEL}". O resto continua igual: e-mail e senha seguem funcionando.

- **Fluxo:** authorization code com **PKCE S256**. O `state` (contra CSRF de login), o `nonce` (contra replay do token) e o verifier ficam num cookie assinado com o `AUTH_SECRET`. Esse cookie é de uso único, vale 10 minutos e é restrito ao caminho `/api/auth/sso`.
- **Validação do `id_token`:**
  - assinatura pelo JWKS do provedor (RS256, ES256 ou PS256);
  - `iss` igual ao emissor configurado, que a descoberta também confere;
  - `aud` igual ao client id;
  - `exp`, com 30 s de tolerância;
  - `nonce`;
  - `email_verified`;
  - domínio (`OIDC_ALLOWED_DOMAIN`).
- **Quem entra:** só quem já é funcionário na base. O SSO não cria conta.
- **Erros na tela:** cada recusa mostra uma mensagem simples no login. O motivo técnico vai só para o log.

### Provas

| O quê | Como | Resultado |
|---|---|---|
| Ataques ao token | [`oidc.test.ts`](../../src/server/oidc.test.ts), com chaves RSA geradas no teste | recusa: assinatura de outra chave, emissor errado, público errado, vencido, nonce trocado, e-mail não verificado ou ausente, outro domínio |
| Pedido de autorização | mesmo teste | `code`, `S256` (challenge = sha256 do verifier), `state`, `nonce`, `redirect_uri`, `scope openid email profile` |
| Descoberta e troca | mesmo teste | documento de outro emissor é recusado; a troca manda o verifier e o segredo; erro do provedor vira "exchange" |
| **Fluxo no navegador** | [`e2e/sso.spec.ts`](../../e2e/sso.spec.ts) contra [`e2e/mock-idp.ts`](../../e2e/mock-idp.ts). O provedor falso confere o PKCE, o segredo, o redirect e o uso único do código | Ana entra e cai no chat; Rafael entra e cai no console; e-mail fora da base volta com o aviso e sem sessão; conta `@gmail.com` é recusada; volta com `state` adulterado é recusada |

**Com um provedor de verdade**, como o Entra ID: cadastre o app com o redirect `https://<domínio>/api/auth/sso/callback`, defina as variáveis e use o e-mail corporativo do funcionário. O que não testei:

- particularidades de cada provedor, por exemplo o Entra, que manda `email` só com o escopo certo e às vezes usa `preferred_username`;
- rotação de chaves no JWKS (o `createRemoteJWKSet` do `jose` busca a chave nova quando aparece um `kid` desconhecido).

## Números depois deste bloco

`npm test`: 245 testes. `npm run test:e2e`: 36 testes, incluindo 5 de SSO e 3 de tempo real.
