$ErrorActionPreference = "Stop"
$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Nssm = Join-Path $ProjectDirectory "tools\nssm\nssm-2.24-101-g897c7ad\win64\nssm.exe"
& $Nssm stop ControlSGestaoFrontend confirm
& $Nssm set ControlSGestaoFrontend Application "C:\Program Files\nodejs\node.exe"
& $Nssm set ControlSGestaoFrontend AppDirectory $ProjectDirectory
& $Nssm set ControlSGestaoFrontend AppParameters "node_modules\vite\bin\vite.js preview apps/frontend --host 0.0.0.0 --port 5175"
& $Nssm set ControlSGestaoFrontend AppNoConsole 1
& $Nssm start ControlSGestaoFrontend
