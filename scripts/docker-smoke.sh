#!/usr/bin/env bash
# Prova de fumaça da imagem Docker, sem segredos e sem LLM (usada pelo CircleCI e à mão).
#   bash scripts/docker-smoke.sh nexo-assist:local
# Sobe o contêiner com um AUTH_SECRET descartável e um volume novo e prova que:
# migrou e criou os dados de exemplo no primeiro start, responde GET /login com 200,
# roda sem root, fica healthy, o login real e as rotas protegidas funcionam, e um
# restart não recria os dados (o que mudou continua lá). Tudo via `docker exec`,
# porque no CI o Docker é remoto e a porta publicada não chega ao localhost do job.
set -euo pipefail

IMAGE="${1:?informe a imagem, ex.: nexo-assist:local}"
NAME="nexo-smoke-$$"
VOLUME="${NAME}-data"
PROBE="$(dirname "$0")/docker-smoke.mjs"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "✘ $1"
  echo "── logs do contêiner ──"
  docker logs "$NAME" 2>&1 | tail -50 || true
  exit 1
}

wait_healthy() {
  for _ in $(seq 1 60); do
    case "$(docker inspect -f '{{.State.Health.Status}}' "$NAME")" in
      healthy) echo "  ok  contêiner healthy"; return 0 ;;
      unhealthy) fail "healthcheck ficou unhealthy" ;;
    esac
    [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" = "true" ] || fail "o contêiner parou"
    sleep 2
  done
  fail "o contêiner não ficou healthy em 120 s"
}

probe() {
  docker exec -i "$NAME" node --input-type=module - "$1" < "$PROBE" || fail "sonda ($1)"
}

# Segredo só deste teste: some junto com o contêiner.
SECRET="$(head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n')"

echo "▶ primeiro start ($IMAGE)"
# --health-interval curto só para o teste não esperar 30 s; o comando é o HEALTHCHECK da imagem.
docker run -d --name "$NAME" \
  -e AUTH_SECRET="$SECRET" -e LEGACY_FAILURE_RATE=0 \
  -v "$VOLUME:/data" --health-interval 3s \
  "$IMAGE" >/dev/null
wait_healthy

LOGS="$(docker logs "$NAME" 2>&1)"
grep -q "migrações aplicadas" <<<"$LOGS" || fail "migrações não aparecem no log"
grep -q "seed concluído (banco vazio)" <<<"$LOGS" || fail "seed não rodou no banco vazio"
echo "  ok  migrou e criou os dados de exemplo"

USER_ID="$(docker exec "$NAME" id -u)"
[ "$USER_ID" != "0" ] || fail "o processo roda como root"
echo "  ok  roda sem root (uid $USER_ID)"

probe primeiro-start

echo "▶ restart (mesmo volume)"
docker restart "$NAME" >/dev/null
wait_healthy
LOGS="$(docker logs "$NAME" 2>&1)"
[ "$(grep -c "seed concluído" <<<"$LOGS")" = "1" ] || fail "o seed rodou de novo no restart"
grep -q "seed ignorado (o banco já tem dados)" <<<"$LOGS" || fail "o restart não registrou o seed ignorado"
echo "  ok  restart migrou e não recriou os dados"
probe depois-restart

echo "✔ prova de fumaça da imagem passou"
