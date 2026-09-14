$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDirectory = Join-Path $ProjectDirectory "logs"
$LogFile = Join-Path $LogDirectory "atualizador.log"
$DatabaseName = "control_s_gestao"
$DatabasePassword = "controls"
$PortablePostgresRuntime = Join-Path $env:ProgramData "ControlSGestao\PostgreSQL\runtime"
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
Start-Transcript -Path $LogFile -Append | Out-Null

function Find-PostgresTool([string]$Tool) {
  foreach ($root in @("C:\Program Files\PostgreSQL", $PortablePostgresRuntime)) {
    $found = Get-ChildItem -LiteralPath $root -Filter "$Tool.exe" -Recurse -File -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  throw "$Tool não foi localizado após a instalação do PostgreSQL."
}

try {
  Write-Host "[1/7] Verificando Node.js..."
  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    $NodeInstaller = Get-ChildItem -LiteralPath (Join-Path $ProjectDirectory "tools\installers") -Filter "*.msi" -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($NodeInstaller) {
      $NodeInstall = Start-Process msiexec.exe -Wait -PassThru -ArgumentList "/i", ('"' + $NodeInstaller.FullName + '"'), "/qn", "/norestart"
      if ($NodeInstall.ExitCode -notin @(0, 3010)) { throw "Falha ao instalar o Node.js (código $($NodeInstall.ExitCode))." }
    } elseif (Get-Command winget.exe -ErrorAction SilentlyContinue) {
      winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
    } else { throw "Instalador offline do Node.js não encontrado." }
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  }

  Write-Host "[2/7] Verificando PostgreSQL..."
  $Psql = Get-ChildItem -Path @("C:\Program Files\PostgreSQL", $PortablePostgresRuntime) -Filter "psql.exe" -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (-not $Psql) {
    $RuntimeInstaller = Join-Path $ProjectDirectory "tools\installers\vc_redist.x64.exe"
    if (Test-Path -LiteralPath $RuntimeInstaller) {
      $RuntimeSignature = Get-AuthenticodeSignature -LiteralPath $RuntimeInstaller
      if ($RuntimeSignature.Status -ne "Valid") { throw "O instalador dos componentes do Windows está corrompido." }
      $RuntimeInstall = Start-Process $RuntimeInstaller -Wait -PassThru -ArgumentList "/install", "/quiet", "/norestart"
      if ($RuntimeInstall.ExitCode -notin @(0, 1638, 3010)) {
        throw "Falha ao instalar os componentes do Windows (código $($RuntimeInstall.ExitCode))."
      }
    }
    $PortablePostgresSource = Join-Path $ProjectDirectory "tools\postgresql-portable"
    if (-not (Test-Path -LiteralPath (Join-Path $PortablePostgresSource "bin\initdb.exe"))) {
      throw "PostgreSQL não está instalado e o pacote portátil não foi encontrado."
    }
    New-Item -ItemType Directory -Force -Path $PortablePostgresRuntime | Out-Null
    Copy-Item -Path (Join-Path $PortablePostgresSource "*") -Destination $PortablePostgresRuntime -Recurse -Force
    $PortablePostgres = $PortablePostgresRuntime
    $PostgresData = Join-Path $env:ProgramData "ControlSGestao\PostgreSQL\data"
    New-Item -ItemType Directory -Force -Path $PostgresData | Out-Null
    if (-not (Test-Path -LiteralPath (Join-Path $PostgresData "PG_VERSION"))) {
      $PasswordFile = Join-Path $env:TEMP "control-s-gestao-pg-password.txt"
      [IO.File]::WriteAllText($PasswordFile, $DatabasePassword, (New-Object System.Text.UTF8Encoding($false)))
      try {
        & (Join-Path $PortablePostgres "bin\initdb.exe") -D $PostgresData -U postgres --encoding=UTF8 --locale=C --auth=scram-sha-256 --pwfile=$PasswordFile
        if ($LASTEXITCODE -ne 0) { throw "Falha ao inicializar o PostgreSQL portátil." }
      } finally { Remove-Item -LiteralPath $PasswordFile -Force -ErrorAction SilentlyContinue }
    }
    if (-not (Get-Service -Name ControlSGestaoPostgreSQL -ErrorAction SilentlyContinue)) {
      & (Join-Path $PortablePostgres "bin\pg_ctl.exe") register -N ControlSGestaoPostgreSQL -D $PostgresData -S auto -o '"-p 5432"'
      if ($LASTEXITCODE -ne 0) { throw "Falha ao registrar o serviço PostgreSQL." }
    }
    Start-Service ControlSGestaoPostgreSQL
    $ready = Join-Path $PortablePostgres "bin\pg_isready.exe"
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      & $ready -h localhost -p 5432 | Out-Null
      if ($LASTEXITCODE -eq 0) { break }
      Start-Sleep -Seconds 1
    }
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
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectDirectory "node_modules"))) {
      & npm.cmd ci --omit=optional
      if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar os componentes da aplicação." }
    }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar a aplicação." }
  } finally { Pop-Location }

  Write-Host "[7/7] Instalando e iniciando serviços Windows..."
  & (Join-Path $PSScriptRoot "instalar-servicos.ps1") -SkipBuild
  if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar os serviços Windows." }

  $BackendReady = $false
  $FrontendReady = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $Health = Invoke-RestMethod -Uri "http://127.0.0.1:3340/saude" -TimeoutSec 2
      $BackendReady = $Health.status -eq "ok"
    } catch { $BackendReady = $false }
    try {
      $Page = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:5175/" -TimeoutSec 2
      $FrontendReady = $Page.StatusCode -eq 200
    } catch { $FrontendReady = $false }
    if ($BackendReady -and $FrontendReady) { break }
    Start-Sleep -Seconds 1
  }
  if (-not $BackendReady) { throw "O serviço interno de login não iniciou. Consulte logs\backend-error.log." }
  if (-not $FrontendReady) { throw "A interface não iniciou. Consulte logs\frontend-error.log." }
  Start-Process "http://localhost:5175"
  Write-Host "Concluído. Acesse http://localhost:5175"
} catch {
  $Failure = $_
  [Console]::Error.WriteLine("ERRO: $($Failure.Exception.Message)")
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Stop-Transcript -ErrorAction SilentlyContinue | Out-Null
}
if ($Failure) { exit 1 }
