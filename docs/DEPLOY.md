# Deploy e histórico de segurança

O deploy roda na **Vercel** com o banco no **Turso** (libSQL, compatível com o SQLite local). App: https://nexo-assist-puce.vercel.app, **aberto ao público desde 29/10/2026** (`PUBLIC_DEMO=1`), com teto de **100 mensagens em 24 horas** somando todos os visitantes (`DAILY_AGENT_TURN_LIMIT=100`), além dos limites por pessoa e do teto total (`TOTAL_AGENT_TURN_LIMIT`). Atingido o teto, o chat avisa que o limite de hoje acabou e nada chama o modelo. Para voltar a exigir o link de acesso, apague `PUBLIC_DEMO` na Vercel e publique de novo.

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
   - Completam a lista `LLM_MODEL`, `DAILY_AGENT_TURN_LIMIT=100` (mensagens em 24 horas, somando todo mundo) e `TOTAL_AGENT_TURN_LIMIT` (trava final). Desde 30/10/2026: `LLM_MODEL=openrouter/openai/gpt-6-luna`, `LLM_FALLBACK_MODEL=openrouter/google/gemini-3.5-flash-lite`, `OPENROUTER_API_KEY` (colada pelo dono) e `TOTAL_AGENT_TURN_LIMIT=2000`, que com o Luna fica abaixo de US$ 1. A CLI da Vercel criou essas variáveis como `Secret`: o valor não aparece no `vercel env pull`.
4. Publiquei pela CLI (`vercel deploy --prod`) a partir de um `git archive` do último commit, para nunca subir arquivo que não está versionado. O [`.vercelignore`](../.vercelignore) também barra `.env` e bancos locais.
5. As funções rodam em `iad1` (Washington), na mesma região do banco. A "Vercel Authentication" protege só os previews; a produção fica atrás do nosso token.

## Atualizar a produção

`scripts/deploy-prod.ps1` faz os passos 2 e 4 em ordem: migrações, seed opcional e publicação do último commit por `git archive`. Sem `-Seed`, ele roda `scripts/sync-articles.ts`, que insere os artigos novos da central e reescreve os existentes sem apagar nada (conversas, chamados e contadores ficam como estão). Ele recusa rodar com mudanças não commitadas e não imprime segredo.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-prod.ps1 -Seed   # sem -Seed, mantém as conversas de produção
```

Para conferir se a demo está no ar sem gastar o teto do modelo, `node scripts/checar-demo.mjs` abre a tela de login, entra como Ana, lê a conversa pela API (passa pelo banco) e confere o estudo de caso no portfólio. Sai com código 1 se algo falhar. Rodo depois de cada deploy e de tempos em tempos enquanto a demo está com avaliadores.

## Docker, CircleCI e Komodo

Além da Vercel, o app roda numa imagem Docker no Komodo da minha máquina. A produção continua na Vercel, publicada à mão com `scripts/deploy-prod.ps1`; o CI nunca publica na Vercel. O `output: "standalone"` do Next só é ligado quando o build recebe `NEXT_OUTPUT=standalone`, o que só o `Dockerfile` faz, então o `npm run build` da Vercel não muda.

### Como funciona

1. A cada push, o CircleCI roda `checks` (tipos, lint, testes) e `e2e`. Em paralelo, fora do `main`, o job `image-smoke` builda a imagem e roda a prova de fumaça, sem segredo nenhum (PRs de fork, se habilitados no CircleCI, também rodam sem segredo).
2. No `main`, o job `image-publish` só começa depois de `checks` e `e2e`. Ele builda, roda a mesma prova de fumaça e publica `docker.io/<usuário em minúsculas>/nexo-assist` com duas tags: o sha curto do commit (7 caracteres) e `latest`. O sha sobe primeiro, então toda `latest` tem uma versão fixa para onde voltar. As credenciais vêm do contexto `dockerhub` do CircleCI. O job usa `serial-group`: dois merges seguidos não publicam ao mesmo tempo, e o CircleCI descarta a publicação mais antiga que ainda espera, então a `latest` não volta para uma versão velha.
3. No Komodo, a stack `nexo-assist` tem `auto_update = true`. O procedure `ci-auto-update` roda a cada 10 minutos, compara o digest da `latest` no Docker Hub com o do contêiner e, se mudou, faz pull e redeploy. O Komodo guarda o digest em cache por 10 minutos, então a checagem seguinte pode ainda usar o valor antigo: na prática a stack leva de **10 a 20 minutos** para atualizar depois que o `image-publish` fica verde. O CircleCI nunca fala com o Komodo: não há túnel, webhook público nem runner. O app fica só em `127.0.0.1:3300`.

A imagem (`Dockerfile`) usa Node 24 em Debian slim, roda como o usuário `node` (sem root) e guarda o banco libSQL em `/data/nexo.db`, num volume. A cada start, `scripts/docker-init.ts` (empacotado com o esbuild, porque a imagem não tem `tsx`) aplica as migrações e cria os dados de exemplo só se a tabela `employees` estiver vazia; num banco que já existia, só atualiza os artigos da central (`syncArticles`). `SEED_IF_EMPTY=0` desliga o seed. Depois disso, `server.js` assume o processo. O `HEALTHCHECK` consulta `/login` e aceita qualquer status abaixo de 500, porque com `ACCESS_TOKEN` quem responde sem o link é a porta de acesso. Como `/login` não toca no banco, quem prova que o banco funciona é a prova de fumaça do CI, não o healthcheck.

Validação local em 28/10/2026, com o `main` buildado a partir de um `git archive` (Docker 29): a imagem tem **486 MB** e `scripts/docker-smoke.sh` passou nas **25 checagens**.

- No primeiro start: migração e seed, contêiner healthy, sem root, `/login` 200, API do console 401 sem sessão, login real de funcionária e de analista, 403 da funcionária no console, e o analista assumindo uma conversa.
- Depois de um restart: nada é recriado e a conversa assumida continua com o analista.

**Primeira execução real (28/10/2026).** O CircleCI rodou pela primeira vez e pegou dois problemas que a máquina local escondia:

1. **`checks` falhou com `TS2304: Cannot find name 'LayoutProps'`.** O Next 16 gera esse tipo global em `.next/types`, que existe na minha máquina, mas não num clone limpo. Reproduzi num clone limpo e corrigi com `"typecheck": "next typegen && tsc --noEmit"` (commit `bb5575b`). O `npm run verify` local nunca teria pego isso.
2. **`image-publish` falhou com `DOCKERHUB_USERNAME: unbound variable`**, porque o contexto `dockerhub` ainda não existia. Criei o contexto com a restrição de branch e o dono colocou o token.

Na nova execução do pipeline #2, todos os jobs passaram: `checks`, `e2e`, build, prova de fumaça e publicação. O Docker Hub tem `skarl007/nexo-assist` com as tags `latest` e a do SHA do commit daquela execução (115,5 MB comprimida).

**Primeiro Deploy no Komodo (29/10/2026).** Fluxo completo: Variables criadas, sync `circleci` executado (criou a stack e o procedure), Deploy pela interface. O contêiner ficou `healthy` em 11 segundos. O log mostrou as migrações aplicadas e o seed no banco vazio. Em http://localhost:3300, o login da funcionária de exemplo funcionou, e o agent respondeu pela central de ajuda com o Gemini, com o painel "por quê?".

### O que o CI prova

`scripts/docker-smoke.sh` sobe a imagem com um `AUTH_SECRET` descartável e um volume novo. Como o Docker do CircleCI é remoto, tudo roda por `docker exec`. O script confere, nesta ordem:

- o log mostra as migrações aplicadas e o seed no banco vazio;
- o contêiner fica `healthy` e o processo não é root;
- `GET /login` responde 200, e a API do console responde 401 sem sessão;
- o login pela rota real (`POST /api/auth/login`) funciona para uma funcionária (`GET /api/chat` 200, console 403) e para um analista (console 200, com as conversas do seed);
- o analista assume a conversa da Carla e, depois de `docker restart`, o seed é ignorado e a conversa continua assumida.

Nada disso chama o LLM. Para rodar o mesmo teste localmente: `docker build -t nexo-assist:local . && bash scripts/docker-smoke.sh nexo-assist:local`.

### Passos do dono (uma vez, nesta ordem)

Exigem login e criam credenciais, por isso ficam com o dono da conta. A ordem importa: o primeiro Deploy no Komodo só funciona depois que a imagem existe no Docker Hub.

1. **CircleCI:** entrar com o GitHub e, em *Projects*, conectar o repositório `skarL007/nexo-assist` usando o `.circleci/config.yml` que já está no `main`.
2. **Docker Hub:** criar a conta, o repositório `nexo-assist` como **Public** (o Komodo puxa a imagem e confere o digest sem login) e um *Personal Access Token* com permissão *Read & Write*. Um token pessoal vale para a conta toda (não dá para limitá-lo a um repositório), por isso ele fica só no CircleCI.
3. **Contexto `dockerhub`** no CircleCI (*Organization Settings > Contexts*), com `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN`. No mesmo contexto, adicione a restrição por expressão `pipeline.git.branch == "main"`: assim nenhuma outra branch recebe o token, mesmo que alguém acrescente `context: dockerhub` ao config. Em *Project Settings > Advanced*, deixe desligado *Pass secrets to builds from forked pull requests*.
4. **Primeira imagem:** faça um push no `main` e espere o job `image-publish` ficar verde no CircleCI. Confira no Docker Hub que `nexo-assist` tem as tags `latest` e o sha curto. Sem isso, o primeiro Deploy no Komodo falha porque a imagem ainda não existe.
5. **Variables do Komodo** (*Settings > Variables*): `DOCKERHUB_USERNAME` (em minúsculas, não é segredo), `NEXO_AUTH_SECRET` (32+ caracteres; gere com o comando do `.env.example`) e `GOOGLE_GENERATIVE_AI_API_KEY`, as duas últimas marcadas como secret. **As três precisam existir, mesmo que uma fique com valor vazio**: quando falta uma Variable, o Komodo não dá erro; ele deixa o texto `[[NOME]]` como valor no `.env` da stack. Sem a `GOOGLE_GENERATIVE_AI_API_KEY`, o app tentaria usar esse texto como chave do modelo e as chamadas falhariam, em vez de o agent responder "indisponível". Para ligar a porta de acesso, crie também `NEXO_ACCESS_TOKEN` e acrescente `ACCESS_TOKEN = [[NEXO_ACCESS_TOKEN]]` ao `environment` da stack.
6. **Resource sync `circleci`** no Komodo. Se ainda não existir: *Resource Syncs > New Sync*, nome `circleci`, modo *Files On Server*, *Resource Paths* `nexo-assist.toml` e `ci-auto-update.toml` (no Komodo v2.3 o caminho é relativo a `/syncs/<nome do sync>`, que no Core é a pasta `sync/` do host), com *Delete Unmatched Resources* e *Managed* desligados (o sync só cria e atualiza, nunca apaga recurso). Depois: conferir na aba *Execute* o diff (criar a stack `nexo-assist` e o procedure `ci-auto-update`) e *Execute Sync*.
7. **Primeiro Deploy** da stack pela interface do Komodo, à mão. Abra http://localhost:3300. A partir daí, cada push no `main` com o CircleCI verde atualiza a stack sozinha em 10 a 20 minutos.

O primeiro Deploy pela interface é obrigatório. O compose monta o nome da imagem com `${DOCKERHUB_USERNAME}`. No código do Komodo v2.3.4, a checagem de atualização usa a imagem já interpolada do último deploy, obtida por `docker compose config`. Antes do primeiro deploy, ela só tem o texto cru do compose e não acha atualização. Um erro silencioso comum é deixar o repositório do Docker Hub como *Private*: o Komodo só registra um aviso e nunca atualiza.

Os arquivos da stack (`compose.yaml` e `README.md`) e o TOML do sync (`nexo-assist.toml`) ficam fora deste repositório, na pasta de stacks do Komodo no host. O `.env` dessa pasta é gerado pelo Komodo a cada Deploy, com os segredos em texto puro: não edite nem copie esse arquivo.

### Rollback

1. Pegue o sha curto da última versão boa no Docker Hub ou no job `image-publish` do CircleCI.
2. No `compose.yaml` da stack, troque `:latest` por `:<sha>` e desligue `auto_update` no TOML. Com a tag fixa, o digest dela não muda e a stack não sai sozinha da versão boa; desligar o `auto_update` só deixa explícito que ela está fixada.
3. Aplique o sync e faça *Deploy*. O volume com o banco não muda. **Atenção:** as migrações só andam para frente. Se a versão ruim trouxe uma migração nova, o banco continua no esquema novo e a imagem antiga passa a rodar sobre ele. Isso só é seguro quando a migração foi aditiva (coluna ou tabela nova); se não foi, restaure uma cópia do volume ou recomece com os dados de exemplo.
4. Quando a correção chegar ao `main` e a nova `latest` estiver boa, volte para `:latest` e religue `auto_update`.

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
4. **Skills de auditoria de terceiros** (security-specialist, o `secure-phase` do GSD e as de segurança do Synapse): nenhum achado alto ou médio. Os baixos foram corrigidos:
   - a confirmação de caso crítico passou a transferir antes de marcar o chamado, e o comentário só é gravado depois de atualizar o chamado;
   - sem a chave do modelo no deploy, o funcionário vê só "indisponível" (o nome da variável vai para o log);
   - o turno de esclarecimento só libera a tool de botões, em código, não só no prompt;
   - "Alterar detalhes" tem teto de 20 rascunhos por conversa, já que não passa pelos limites de mensagens.

   Ficou como trade-off: uma pessoa com o link pode gastar as 100 mensagens do dia sozinha (o link só vai para quem avalia; no dia seguinte a cota volta).
