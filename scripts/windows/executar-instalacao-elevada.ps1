$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDirectory = Join-Path $ProjectDirectory "logs"
$LogFile = Join-Path $LogDirectory "instalacao-servicos.log"
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
try {
  & (Join-Path $PSScriptRoot "instalar-servicos.ps1") *>&1 | Out-File -LiteralPath $LogFile -Encoding utf8
  "SUCESSO" | Add-Content -LiteralPath $LogFile
} catch {
  ("ERRO: " + $_.Exception.Message) | Add-Content -LiteralPath $LogFile
  exit 1
}
