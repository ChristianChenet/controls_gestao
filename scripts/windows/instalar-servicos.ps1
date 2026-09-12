$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Nssm = "C:\nssm\win64\nssm.exe"
$BundledNssm = Join-Path $ProjectDirectory "tools\nssm\nssm-2.24-101-g897c7ad\win64\nssm.exe"
if (-not (Test-Path -LiteralPath $Nssm)) { $Nssm = $BundledNssm }
$Node = "C:\Program Files\nodejs\node.exe"
$Npm = "C:\Program Files\nodejs\npm.cmd"
$Vite = Join-Path $ProjectDirectory "node_modules\vite\bin\vite.js"
$Logs = Join-Path $ProjectDirectory "logs"
if (-not (Test-Path -LiteralPath $Nssm)) { throw "NSSM não encontrado em $Nssm" }
if (-not (Test-Path -LiteralPath $Node)) { throw "Node.js não encontrado em $Node" }
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
Push-Location $ProjectDirectory
try {
  & $Npm install
  & $Npm run build
  foreach ($ServiceName in @("ControlSGestaoFrontend", "ControlSGestaoBackend")) {
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
      & $Nssm stop $ServiceName confirm
      & $Nssm remove $ServiceName confirm
    }
  }
  & $Nssm install ControlSGestaoBackend $Node "apps\backend\dist\server.js"
  & $Nssm set ControlSGestaoBackend AppDirectory $ProjectDirectory
  & $Nssm set ControlSGestaoBackend AppStdout (Join-Path $Logs "backend.log")
  & $Nssm set ControlSGestaoBackend AppStderr (Join-Path $Logs "backend-error.log")
  & $Nssm set ControlSGestaoBackend AppExit Default Restart
  & $Nssm set ControlSGestaoBackend AppNoConsole 1
  & $Nssm set ControlSGestaoBackend Start SERVICE_AUTO_START
  & $Nssm install ControlSGestaoFrontend $Node
  & $Nssm set ControlSGestaoFrontend AppParameters "node_modules\vite\bin\vite.js preview apps/frontend --host 0.0.0.0 --port 5175"
  & $Nssm set ControlSGestaoFrontend AppDirectory $ProjectDirectory
  & $Nssm set ControlSGestaoFrontend AppStdout (Join-Path $Logs "frontend.log")
  & $Nssm set ControlSGestaoFrontend AppStderr (Join-Path $Logs "frontend-error.log")
  & $Nssm set ControlSGestaoFrontend AppExit Default Restart
  & $Nssm set ControlSGestaoFrontend AppNoConsole 1
  & $Nssm set ControlSGestaoFrontend Start SERVICE_AUTO_START
  & $Nssm set ControlSGestaoFrontend DependOnService ControlSGestaoBackend
  & $Nssm start ControlSGestaoBackend
  & $Nssm start ControlSGestaoFrontend
} finally { Pop-Location }
Write-Host "Control S Gestão instalado: http://localhost:5175"
