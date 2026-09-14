$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDirectory = Join-Path $ProjectDirectory "logs"
$LogFile = Join-Path $LogDirectory "atualizador.log"
$DatabaseName = "control_s_gestao"
$DatabasePassword = "controls"
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
Start-Transcript -Path $LogFile -Append | Out-Null

function Find-PostgresTool([string]$Tool) {
  $found = Get-ChildItem -LiteralPath "C:\Program Files\PostgreSQL" -Filter "$Tool.exe" -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (-not $found) { throw "$Tool não foi localizado após a instalação do PostgreSQL." }
  return $found.FullName
}

try {
  Write-Host "[1/7] Verificando Node.js..."
  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  }

  Write-Host "[2/7] Verificando PostgreSQL..."
  $Psql = Get-ChildItem -LiteralPath "C:\Program Files\PostgreSQL" -Filter "psql.exe" -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (-not $Psql) {
    winget install --id PostgreSQL.PostgreSQL.18 --exact --silent --accept-package-agreements --accept-source-agreements --override "--mode unattended --unattendedmodeui none --superpassword $DatabasePassword --serverport 5432"
  }
  $Psql = Find-PostgresTool "psql"
  $PgRestore = Find-PostgresTool "pg_restore"
  $env:PGPASSWORD = $DatabasePassword

  Write-Host "[3/7] Preparando banco de dados..."
  $Exists = & $Psql -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DatabaseName'"
  $NewDatabase = $Exists.Trim() -ne "1"
  if ($NewDatabase) {
    & $Psql -h localhost -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DatabaseName"
    $Backup = Join-Path $ProjectDirectory "database\seed\control_s_gestao.backup"
    if (Test-Path -LiteralPath $Backup) {
      & $PgRestore -h localhost -p 5432 -U postgres -d $DatabaseName --no-owner --no-privileges $Backup
      if ($LASTEXITCODE -gt 1) { throw "Não foi possível restaurar os dados iniciais." }
    }
  }

  Write-Host "[4/7] Aplicando estrutura e atualizações do banco..."
  Get-ChildItem -LiteralPath (Join-Path $ProjectDirectory "database\migrations") -Filter "*.sql" -File |
    Sort-Object Name |
    ForEach-Object {
      & $Psql -h localhost -p 5432 -U postgres -d $DatabaseName -v ON_ERROR_STOP=1 -f $_.FullName
      if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar $($_.Name)." }
    }

  Write-Host "[5/7] Preparando configuração..."
  $EnvFile = Join-Path $ProjectDirectory ".env"
  $DeployEnv = Join-Path $ProjectDirectory ".env.deploy"
  if (-not (Test-Path -LiteralPath $EnvFile)) {
    if (Test-Path -LiteralPath $DeployEnv) { Copy-Item -LiteralPath $DeployEnv -Destination $EnvFile }
    else { Copy-Item -LiteralPath (Join-Path $ProjectDirectory ".env.example") -Destination $EnvFile }
  }

  Write-Host "[6/7] Instalando componentes e compilando..."
  Push-Location $ProjectDirectory
  try {
    & npm.cmd ci --omit=optional
    if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar os componentes da aplicação." }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar a aplicação." }
  } finally { Pop-Location }

  Write-Host "[7/7] Instalando e iniciando serviços Windows..."
  & (Join-Path $PSScriptRoot "instalar-servicos.ps1") -SkipBuild
  if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar os serviços Windows." }
  Start-Process "http://localhost:5175"
  Write-Host "Concluído. Acesse http://localhost:5175"
} catch {
  Write-Error $_
  exit 1
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Stop-Transcript -ErrorAction SilentlyContinue | Out-Null
}
