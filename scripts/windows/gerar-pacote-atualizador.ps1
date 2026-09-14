param([string]$Destino = "")
$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Version = Get-Date -Format "yyyyMMdd-HHmmss"
$ReleaseRoot = Join-Path $ProjectDirectory "release"
if (-not $Destino) { $Destino = Join-Path $ReleaseRoot "ControlSGestao-Atualizador-$Version" }
$Destino = [IO.Path]::GetFullPath($Destino)
if (-not $Destino.StartsWith([IO.Path]::GetFullPath($ReleaseRoot), [StringComparison]::OrdinalIgnoreCase)) {
  throw "O pacote deve ser criado dentro da pasta release do projeto."
}
New-Item -ItemType Directory -Force -Path $Destino | Out-Null

$Exclude = @(".git", ".env", "node_modules", "release", "logs")
Get-ChildItem -LiteralPath $ProjectDirectory -Force | Where-Object { $Exclude -notcontains $_.Name } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $Destino -Recurse -Force
}
if (Test-Path -LiteralPath (Join-Path $ProjectDirectory ".env")) {
  Copy-Item -LiteralPath (Join-Path $ProjectDirectory ".env") -Destination (Join-Path $Destino ".env.deploy") -Force
}

$SeedDirectory = Join-Path $Destino "database\seed"
New-Item -ItemType Directory -Force -Path $SeedDirectory | Out-Null
$PgDump = Get-ChildItem -LiteralPath "C:\Program Files\PostgreSQL" -Filter "pg_dump.exe" -Recurse -File -ErrorAction Stop |
  Sort-Object FullName -Descending |
  Select-Object -First 1
$env:PGPASSWORD = "controls"
try {
  & $PgDump.FullName -h localhost -p 5432 -U postgres -d control_s_gestao -Fc -f (Join-Path $SeedDirectory "control_s_gestao.backup")
  if ($LASTEXITCODE -ne 0) { throw "Falha ao gerar a cópia do banco atual." }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

$Zip = "$Destino.zip"
Compress-Archive -Path (Join-Path $Destino "*") -DestinationPath $Zip -Force
Write-Host "Pacote pronto: $Zip"
