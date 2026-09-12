$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Nssm = "C:\nssm\win64\nssm.exe"
$Node = "C:\Program Files\nodejs\node.exe"
$Npm = "C:\Program Files\nodejs\npm.cmd"
$Logs = Join-Path $ProjectDirectory "logs"
if (-not (Test-Path -LiteralPath $Nssm)) { throw "NSSM não encontrado em $Nssm" }
if (-not (Test-Path -LiteralPath $Node)) { throw "Node.js não encontrado em $Node" }
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
Push-Location $ProjectDirectory
try {
  & $Npm install
  & $Npm run build
  foreach ($ServiceName in @("ControlSGestaoBackend", "ControlSGestaoFrontend")) {
    & $Nssm stop $ServiceName confirm 2>$null
    & $Nssm remove $ServiceName confirm 2>$null
  }
  & $Nssm install ControlSGestaoBackend $Node "apps\backend\dist\server.js"
  & $Nssm set ControlSGestaoBackend AppDirectory $ProjectDirectory
  & $Nssm set ControlSGestaoBackend AppStdout (Join-Path $Logs "backend.log")
  & $Nssm set ControlSGestaoBackend AppStderr (Join-Path $Logs "backend-error.log")
  & $Nssm set ControlSGestaoBackend AppExit Default Restart
  & $Nssm set ControlSGestaoBackend Start SERVICE_AUTO_START
  & $Nssm install ControlSGestaoFrontend $Npm "--workspace apps/frontend run preview"
  & $Nssm set ControlSGestaoFrontend AppDirectory $ProjectDirectory
  & $Nssm set ControlSGestaoFrontend AppStdout (Join-Path $Logs "frontend.log")
  & $Nssm set ControlSGestaoFrontend AppStderr (Join-Path $Logs "frontend-error.log")
  & $Nssm set ControlSGestaoFrontend AppExit Default Restart
  & $Nssm set ControlSGestaoFrontend Start SERVICE_AUTO_START
  & $Nssm set ControlSGestaoFrontend DependOnService ControlSGestaoBackend
  & $Nssm start ControlSGestaoBackend
  & $Nssm start ControlSGestaoFrontend
} finally { Pop-Location }
Write-Host "Control S Gestão instalado: http://localhost:5175"
