# Deploy de produção (Windows PowerShell 5.1+), na ordem de docs/DEPLOY.md:
#   1. migrações no Turso   2. seed (opcional: APAGA as conversas de produção) ou, sem ele, só os artigos da central
#   3. publica o último commit na Vercel
#
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-prod.ps1           # migra + publica
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-prod.ps1 -Seed     # migra + seed + publica
#
# Precisa de: .vercel\env.production (vercel env pull) e a CLI da Vercel logada (npx vercel login).
# Nenhum segredo é impresso: o AUTH_SECRET abaixo é descartável, só para a validação do env passar.
param([switch]$Seed)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".vercel\env.production")) { throw "Falta .vercel\env.production: rode 'vercel env pull .vercel/env.production --environment=production'." }
$status = git status --porcelain
if ($status) { throw "Há mudanças não commitadas: o deploy publica só o último commit. Commite antes." }

$env:AUTH_SECRET = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))"
try {
  Write-Host "1/3 Migrações no Turso..."
  npx tsx --env-file=.vercel/env.production scripts/migrate.ts
  if ($LASTEXITCODE -ne 0) { throw "migração falhou" }

  if ($Seed) {
    Write-Host "2/3 Seed (apaga e recria os dados de exemplo)..."
    npx tsx --env-file=.vercel/env.production scripts/seed.ts
    if ($LASTEXITCODE -ne 0) { throw "seed falhou" }
  } else {
    # Sem seed, só a central de ajuda acompanha a versão: artigos novos e alterados, nada apagado.
    Write-Host "2/3 Central de ajuda (seed pulado; use -Seed para recriar os dados de exemplo)..."
    npx tsx --env-file=.vercel/env.production scripts/sync-articles.ts
    if ($LASTEXITCODE -ne 0) { throw "sincronização dos artigos falhou" }
  }
} finally {
  Remove-Item Env:AUTH_SECRET -ErrorAction SilentlyContinue
}

Write-Host "3/3 Publicando o último commit ($(git rev-parse --short HEAD)) na Vercel..."
$tmp = Join-Path $env:TEMP "nexo-deploy"
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Path "$tmp\.vercel" | Out-Null
git archive --format=zip -o "$tmp.zip" HEAD
Expand-Archive -Path "$tmp.zip" -DestinationPath $tmp -Force
Remove-Item "$tmp.zip"
Copy-Item ".vercel\project.json" "$tmp\.vercel\project.json"   # só o vínculo do projeto, sem env
Push-Location $tmp
try {
  # npx: funciona com ou sem a CLI global da Vercel no PATH. Ela escreve o progresso no stderr,
  # o que o PowerShell 5.1 com Stop trata como erro: aqui vale só o código de saída.
  $ErrorActionPreference = "Continue"
  npx --yes vercel deploy --prod --yes 2>&1 | Out-Host
  $code = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($code -ne 0) { throw "deploy falhou" }
} finally {
  Pop-Location
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue  # o npx às vezes ainda segura a pasta
}
Write-Host "Pronto. Com PUBLIC_DEMO=1 o app já está aberto; sem ela, gere um link: npm run access-link -- 14400"
