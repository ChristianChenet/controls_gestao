$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDirectory = Join-Path $ProjectDirectory "logs"
$LogFile = Join-Path $LogDirectory "atualizador.log"
$DatabaseName = "control_s_gestao"
$DatabasePassword = "controls"
$DatabasePort = 5436
$PortablePostgresRuntime = Join-Path $env:ProgramData "ControlSGestao\PostgreSQL\runtime"
$InstallerDataDirectory = Join-Path $env:ProgramData "ControlSGestao\Installer"
$NodeInstallerHash = "F0F66C2A80C08A30A5AB5179EE9EA9E45F9B46289436A8CC87FF833B852DB351"
$RuntimeInstallerHash = "CC0FF0EB1DC3F5188AE6300FAEF32BF5BEEBA4BDD6E8E445A9184072096B713B"
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
Start-Transcript -Path $LogFile -Append | Out-Null

function Find-PostgresTool([string]$Tool) {
  $found = Get-ChildItem -LiteralPath $PortablePostgresRuntime -Filter "$Tool.exe" -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($found) { return $found.FullName }
  throw "$Tool não foi localizado após a instalação do PostgreSQL."
}

try {
  Write-Host "[1/7] Verificando Node.js..."
  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    $NodeInstaller = Get-ChildItem -LiteralPath (Join-Path $ProjectDirectory "tools\installers") -Filter "*.msi" -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($NodeInstaller) {
      if ((Get-FileHash -LiteralPath $NodeInstaller.FullName -Algorithm SHA256).Hash -ne $NodeInstallerHash) {
        throw "O instalador offline do Node.js esta corrompido."
      }
      $NodeInstall = Start-Process msiexec.exe -Wait -PassThru -ArgumentList "/i", ('"' + $NodeInstaller.FullName + '"'), "/qn", "/norestart"
      if ($NodeInstall.ExitCode -notin @(0, 1641, 3010)) { throw "Falha ao instalar o Node.js (codigo $($NodeInstall.ExitCode))." }
    } else { throw "Instalador offline do Node.js nao encontrado." }
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  }
  $NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  $NodeExecutable = @(
    $(if ($NodeCommand) { $NodeCommand.Path }),
    $(if ($NodeCommand) { $NodeCommand.Source }),
    $(if ($NodeCommand) { $NodeCommand.Definition }),
    "C:\Program Files\nodejs\node.exe"
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
  if (-not $NodeExecutable) {
    throw "Node.js nao foi localizado depois da verificacao."
  }

  Write-Host "[2/7] Verificando PostgreSQL..."
  $PortablePostgresSource = Join-Path $ProjectDirectory "tools\postgresql-portable"
  if (-not (Test-Path -LiteralPath (Join-Path $PortablePostgresSource "bin\initdb.exe"))) {
    throw "O PostgreSQL portatil nao foi encontrado no pacote."
  }
  New-Item -ItemType Directory -Force -Path $PortablePostgresRuntime | Out-Null
  Copy-Item -Path (Join-Path $PortablePostgresSource "*") -Destination $PortablePostgresRuntime -Recurse -Force
  $PortablePostgres = $PortablePostgresRuntime
  $PostgresExecutable = Join-Path $PortablePostgres "bin\postgres.exe"
  $PostgresRuntimeOk = $false
  try {
    & $PostgresExecutable --version | Out-Null
    $PostgresRuntimeOk = $LASTEXITCODE -eq 0
  } catch { $PostgresRuntimeOk = $false }
  if (-not $PostgresRuntimeOk) {
    $RuntimeInstaller = Join-Path $ProjectDirectory "tools\installers\vc_redist.x64.exe"
    if (-not (Test-Path -LiteralPath $RuntimeInstaller)) { throw "Componentes necessarios do Windows nao foram encontrados." }
    if ((Get-FileHash -LiteralPath $RuntimeInstaller -Algorithm SHA256).Hash -ne $RuntimeInstallerHash) {
      throw "O instalador dos componentes do Windows esta corrompido."
    }
    $RuntimeInstall = Start-Process $RuntimeInstaller -Wait -PassThru -ArgumentList "/install", "/quiet", "/norestart"
    if ($RuntimeInstall.ExitCode -notin @(0, 1638, 1641, 3010)) {
      throw "Falha ao instalar os componentes do Windows (codigo $($RuntimeInstall.ExitCode))."
    }
    & $PostgresExecutable --version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "O PostgreSQL nao e compativel com este Windows Server." }
  }
  $PostgresData = Join-Path $env:ProgramData "ControlSGestao\PostgreSQL\data"
  New-Item -ItemType Directory -Force -Path $PostgresData | Out-Null
  if (-not (Test-Path -LiteralPath (Join-Path $PostgresData "PG_VERSION"))) {
    $PasswordFile = Join-Path $env:TEMP "control-s-gestao-pg-password.txt"
    [IO.File]::WriteAllText($PasswordFile, $DatabasePassword, (New-Object System.Text.UTF8Encoding($false)))
    try {
      & (Join-Path $PortablePostgres "bin\initdb.exe") -D $PostgresData -U postgres --encoding=UTF8 --locale=C --auth=scram-sha-256 --pwfile=$PasswordFile
      if ($LASTEXITCODE -ne 0) { throw "Falha ao inicializar o PostgreSQL portatil." }
    } finally { Remove-Item -LiteralPath $PasswordFile -Force -ErrorAction SilentlyContinue }
  }
  $PgCtl = Join-Path $PortablePostgres "bin\pg_ctl.exe"
  if (Get-Service -Name ControlSGestaoPostgreSQL -ErrorAction SilentlyContinue) {
    Stop-Service ControlSGestaoPostgreSQL -Force -ErrorAction SilentlyContinue
    & $PgCtl unregister -N ControlSGestaoPostgreSQL
    if ($LASTEXITCODE -ne 0) { throw "Falha ao reconfigurar o servico PostgreSQL." }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      if (-not (Get-Service -Name ControlSGestaoPostgreSQL -ErrorAction SilentlyContinue)) { break }
      Start-Sleep -Milliseconds 500
    }
    if (Get-Service -Name ControlSGestaoPostgreSQL -ErrorAction SilentlyContinue) {
      throw "O servico PostgreSQL anterior nao foi removido completamente. Execute o atualizador novamente."
    }
  }
  & $PgCtl register -N ControlSGestaoPostgreSQL -D $PostgresData -S auto -o ('"-p ' + $DatabasePort + '"')
  if ($LASTEXITCODE -ne 0) { throw "Falha ao registrar o servico PostgreSQL." }
  Start-Service ControlSGestaoPostgreSQL
  $Psql = Find-PostgresTool "psql"
  $PgRestore = Find-PostgresTool "pg_restore"
  $env:PGPASSWORD = $DatabasePassword
  $PostgresReady = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & $Psql -h 127.0.0.1 -p $DatabasePort -U postgres -d postgres -tAc "SELECT 1" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $PostgresReady = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $PostgresReady) { throw "O PostgreSQL exclusivo nao respondeu na porta $DatabasePort." }

  Write-Host "[3/7] Preparando banco de dados..."
  $Exists = & $Psql -h 127.0.0.1 -p $DatabasePort -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DatabaseName'"
  if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel acessar o PostgreSQL com a senha configurada." }
  $NewDatabase = (($Exists -join "").Trim()) -ne "1"
  if ($NewDatabase) {
    & $Psql -h 127.0.0.1 -p $DatabasePort -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DatabaseName"
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel criar o banco de dados da aplicacao." }
    $Backup = Join-Path $ProjectDirectory "database\seed\control_s_gestao.backup"
    if (Test-Path -LiteralPath $Backup) {
      New-Item -ItemType Directory -Force -Path $InstallerDataDirectory | Out-Null
      $LocalBackup = Join-Path $InstallerDataDirectory "control_s_gestao.backup"
      Copy-Item -LiteralPath $Backup -Destination $LocalBackup -Force
      & $PgRestore -h 127.0.0.1 -p $DatabasePort -U postgres -d $DatabaseName --no-owner --no-privileges $LocalBackup
      if ($LASTEXITCODE -gt 1) { throw "Não foi possível restaurar os dados iniciais." }
    }
  }

  Write-Host "[4/7] Aplicando estrutura e atualizações do banco..."
  $LocalMigrations = Join-Path $InstallerDataDirectory "migrations"
  New-Item -ItemType Directory -Force -Path $LocalMigrations | Out-Null
  Copy-Item -Path (Join-Path $ProjectDirectory "database\migrations\*.sql") -Destination $LocalMigrations -Force
  Get-ChildItem -LiteralPath $LocalMigrations -Filter "*.sql" -File |
    Sort-Object Name |
    ForEach-Object {
      & $Psql -h 127.0.0.1 -p $DatabasePort -U postgres -d $DatabaseName -v ON_ERROR_STOP=1 -f $_.FullName
      if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar $($_.Name)." }
    }

  Write-Host "[5/7] Preparando configuração..."
  $EnvFile = Join-Path $ProjectDirectory ".env"
  $DeployEnv = Join-Path $ProjectDirectory ".env.deploy"
  if (-not (Test-Path -LiteralPath $EnvFile)) {
    if (Test-Path -LiteralPath $DeployEnv) { Copy-Item -LiteralPath $DeployEnv -Destination $EnvFile }
    else { Copy-Item -LiteralPath (Join-Path $ProjectDirectory ".env.example") -Destination $EnvFile }
  }
  $EnvContent = [IO.File]::ReadAllText($EnvFile)
  $DatabaseUrl = "postgres://postgres:$DatabasePassword@127.0.0.1:$DatabasePort/$DatabaseName"
  if ($EnvContent -match '(?m)^DATABASE_URL=') {
    $EnvContent = [Text.RegularExpressions.Regex]::Replace($EnvContent, '(?m)^DATABASE_URL=.*$', "DATABASE_URL=$DatabaseUrl")
  } else {
    $EnvContent = $EnvContent.TrimEnd() + [Environment]::NewLine + "DATABASE_URL=$DatabaseUrl" + [Environment]::NewLine
  }
  [IO.File]::WriteAllText($EnvFile, $EnvContent, (New-Object Text.UTF8Encoding($false)))

  Write-Host "[6/7] Verificando arquivos da aplicacao..."
  foreach ($RequiredPath in @("node_modules\vite\bin\vite.js", "apps\backend\dist\server.js", "apps\frontend\dist\index.html")) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectDirectory $RequiredPath))) {
      throw "Arquivo obrigatorio ausente no pacote: $RequiredPath"
    }
  }

  Write-Host "[7/7] Instalando e iniciando serviços Windows..."
  & (Join-Path $PSScriptRoot "instalar-servicos.ps1") -SkipBuild -NodePath $NodeExecutable
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
  try {
    $LoginBody = @{ email = "christian@controlsconsultoria.com.br"; senha = "Christian2024@" } | ConvertTo-Json
    $LoginTest = Invoke-RestMethod -Uri "http://127.0.0.1:5175/api/auth/login" -Method Post -ContentType "application/json" -Body $LoginBody -TimeoutSec 10
    if (-not $LoginTest.sucesso -or -not $LoginTest.dados.token) { throw "Resposta de login invalida." }
  } catch {
    throw "A validacao automatica do login falhou. Consulte logs\backend-error.log. Detalhe: $($_.Exception.Message)"
  }
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
