# Imagem do Nexo Assist para rodar fora da Vercel (ex.: Komodo local, ver docs/DEPLOY.md).
# Servidor enxuto do Next (output "standalone"), banco libSQL num volume em /data,
# migrações a cada start e dados de exemplo só no primeiro (banco vazio).

FROM node:24-trixie-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npm run build && npm run build:docker-init
# O server.js não serve public/ nem .next/static sozinho: copia junto (guia "output" do Next 16).
# O binário nativo do libSQL é carregado por um require dinâmico ("@libsql/<plataforma>"),
# que o rastreador de arquivos pode não seguir: copia o da plataforma do build se faltar.
# Nenhum .env entra na imagem: o .dockerignore já barra, e o rm é a segunda trava.
RUN rm -f .next/standalone/.env* \
 && cp -r public .next/standalone/public \
 && mkdir -p .next/standalone/.next \
 && cp -r .next/static .next/standalone/.next/static \
 && cp .next/docker-init.cjs .next/standalone/docker-init.cjs \
 && cp -r drizzle .next/standalone/drizzle \
 && for pkg in node_modules/@libsql/linux-*; do \
      [ -d ".next/standalone/$pkg" ] || cp -r "$pkg" ".next/standalone/$pkg"; \
    done

FROM node:24-trixie-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/nexo.db
COPY --from=build /app/.next/standalone ./
# Falha o build se o driver do libSQL não abrir um banco nesta imagem (binário nativo ausente).
RUN node -e "require('@libsql/client').createClient({ url: 'file::memory:' }).execute('select 1').then(() => console.log('libsql ok'))" \
 && mkdir -p /data .next/cache \
 && chown node:node /data .next/cache
# Usuário sem privilégios que já vem na imagem oficial do Node (uid 1000).
USER node
VOLUME ["/data"]
EXPOSE 3000
# Qualquer status abaixo de 500 conta como vivo: com ACCESS_TOKEN, quem responde sem o link é a porta de acesso.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login', { redirect: 'manual' }).then((r) => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))"]
CMD ["sh", "-c", "node docker-init.cjs && exec node server.js"]
