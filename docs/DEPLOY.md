# Deploy e histórico de segurança

O deploy roda na **Vercel** com o banco no **Turso** (libSQL, compatível com o SQLite local). App: https://nexo-assist-puce.vercel.app, atrás de um link de acesso temporário.

## Como fiz o deploy

1. Criei o projeto na Vercel e instalei o **Turso pelo Marketplace da Vercel**. A integração cria o banco e as variáveis `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` no projeto, e o `env.ts` aceita esses nomes.
   ```bash
   vercel integration add tursocloud --name nexo-assist --meta region=iad1 --billing-plan starter -e production -e preview --no-env-pull
   ```
2. Apliquei as migrations e os dados de exemplo no Turso a partir da minha máquina, com as variáveis de produção num arquivo dentro de `.vercel/`, ignorado pelo git e que o Next não lê (nunca em `.env.local` ou `.env.production.local`, que o Next carrega sozinho):
   ```bash
   vercel env pull .vercel/env.production --environment=production
   npx tsx --env-file=.vercel/env.production scripts/migrate.ts
   npx tsx --env-file=.vercel/env.production scripts/seed.ts
   ```
   O seed também zera o contador do teto total (`usage_counters`).
3. Configurei as variáveis, todas só no servidor:
   - `GOOGLE_GENERATIVE_AI_API_KEY` foi enviada com [`scripts/env-to-vercel.mjs`](../scripts/env-to-vercel.mjs), que lê o `.env` e entrega o valor direto à CLI da Vercel, sem exibi-lo.
   - `AUTH_SECRET` e `ACCESS_TOKEN` foram gerados e enviados pela CLI por pipe, sem passar pela tela:
     ```bash
     node -e "process.stdout.write(require('crypto').randomBytes(36).toString('base64url'))" | vercel env add AUTH_SECRET production --sensitive
     ```
   - Completam a lista `LLM_MODEL`, `DAILY_AGENT_TURN_LIMIT` e `TOTAL_AGENT_TURN_LIMIT=100`.
4. Publiquei pela CLI (`vercel deploy --prod`) a partir de um `git archive` do último commit, para nunca subir arquivo que não está versionado. O [`.vercelignore`](../.vercelignore) também barra `.env` e bancos locais.
5. As funções rodam em `iad1` (Washington), na mesma região do banco. A "Vercel Authentication" protege só os previews; a produção fica atrás do nosso token.

## Links de acesso (só para o autor)

`npm run access-link -- <minutos>` gera um link assinado (5 min por padrão, até 30 dias). Ele lê o segredo de `.env.deploy.local`, que não está no repositório, então só funciona na máquina de quem fez o deploy. O link vale até a data impressa; o cookie de acesso vence junto.

## Histórico das revisões de segurança

1. **Antes do deploy:** auditoria do código inteiro; correções no commit `fix(security): correções da auditoria de segurança`.
2. **Depois do deploy:** revisão independente (código + verificações de fora, contra produção: porta de acesso, CSRF, JWT adulterado, permissões, cabeçalhos, segredos no JS) achou sete pontos de severidade baixa a média. Seis foram corrigidos no commit `fix(security): teto atômico, limites pós-gravação, logs sem dados e porta que fecha`:
   - teto total que pedidos paralelos furavam;
   - limites por pessoa com a mesma corrida;
   - log de erro do banco com dados pessoais (e a detecção de número de chamado repetido, que nunca disparava);
   - porta aberta se faltasse o segredo;
   - `Content-Type` comparado por trecho e `Origin: null` dando erro 500;
   - matcher do proxy sem âncora.

   O sétimo (sair não revoga o JWT) ficou como trade-off, explicado no README.
3. **Auditoria final:** 42 verificações caixa-preta em produção passando, `npm audit --omit=dev` sem vulnerabilidades e revisão com metodologias de terceiros (OWASP / STRIDE).
