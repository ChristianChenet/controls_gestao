param([switch]$SkipBuild)
$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Nssm = "C:\nssm\win64\nssm.exe"
$BundledNssm = Join-Path $ProjectDirectory "tools\nssm\nssm-2.24-101-g897c7ad\win64\nssm.exe"
if (-not (Test-Path -LiteralPath $Nssm)) { $Nssm = $BundledNssm }
$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$Node = if ($NodeCommand) { $NodeCommand.Source } else { $null }
$Vite = Join-Path $ProjectDirectory "node_modules\vite\bin\vite.js"
$Logs = Join-Path $ProjectDirectory "logs"
if (-not (Test-Path -LiteralPath $Nssm)) { throw "NSSM não encontrado em $Nssm" }
if (-not $Node -or -not (Test-Path -LiteralPath $Node)) { throw "Node.js não encontrado." }

function Invoke-NssmChecked {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NssmArguments)
  & $Nssm @NssmArguments
  if ($LASTEXITCODE -ne 0) { throw "NSSM falhou: $($NssmArguments -join ' ')" }
}
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
Push-Location $ProjectDirectory
try {
  if (-not $SkipBuild) { throw "Use o instalador principal para preparar a aplicacao." }
  foreach ($ServiceName in @("ControlSGestaoFrontend", "ControlSGestaoBackend")) {
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
      & $Nssm stop $ServiceName confirm
      & $Nssm remove $ServiceName confirm
    }
  }
  Invoke-NssmChecked install ControlSGestaoBackend $Node "apps\backend\dist\server.js"
  Invoke-NssmChecked set ControlSGestaoBackend AppDirectory $ProjectDirectory
  Invoke-NssmChecked set ControlSGestaoBackend AppStdout (Join-Path $Logs "backend.log")
  Invoke-NssmChecked set ControlSGestaoBackend AppStderr (Join-Path $Logs "backend-error.log")
  Invoke-NssmChecked set ControlSGestaoBackend AppExit Default Restart
  Invoke-NssmChecked set ControlSGestaoBackend AppNoConsole 1
  Invoke-NssmChecked set ControlSGestaoBackend Start SERVICE_AUTO_START
  Invoke-NssmChecked install ControlSGestaoFrontend $Node
  Invoke-NssmChecked set ControlSGestaoFrontend AppParameters "node_modules\vite\bin\vite.js preview apps/frontend --host 0.0.0.0 --port 5175"
  Invoke-NssmChecked set ControlSGestaoFrontend AppDirectory $ProjectDirectory
  Invoke-NssmChecked set ControlSGestaoFrontend AppStdout (Join-Path $Logs "frontend.log")
  Invoke-NssmChecked set ControlSGestaoFrontend AppStderr (Join-Path $Logs "frontend-error.log")
  Invoke-NssmChecked set ControlSGestaoFrontend AppExit Default Restart
  Invoke-NssmChecked set ControlSGestaoFrontend AppNoConsole 1
  Invoke-NssmChecked set ControlSGestaoFrontend Start SERVICE_AUTO_START
  Invoke-NssmChecked set ControlSGestaoFrontend DependOnService ControlSGestaoBackend
  Invoke-NssmChecked start ControlSGestaoBackend
  Invoke-NssmChecked start ControlSGestaoFrontend

  $FirewallRule = Get-NetFirewallRule -DisplayName "Control S Gestão - Aplicação" -ErrorAction SilentlyContinue
  if (-not $FirewallRule) {
    New-NetFirewallRule -DisplayName "Control S Gestão - Aplicação" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5175 -Profile Any | Out-Null
  }
} finally { Pop-Location }
Write-Host "Control S Gestão instalado: http://localhost:5175"
