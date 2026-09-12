$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Nssm = Join-Path $ProjectDirectory "tools\nssm\nssm-2.24-101-g897c7ad\win64\nssm.exe"
& $Nssm stop ControlSGestaoFrontend confirm
& $Nssm restart ControlSGestaoBackend
& $Nssm start ControlSGestaoFrontend
