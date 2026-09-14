@echo off
setlocal
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
title Control S Gestao - Instalador e Atualizador
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\atualizar-tudo.ps1"
if errorlevel 1 (
  echo.
  echo A atualizacao encontrou um erro. Consulte logs\atualizador.log.
  pause
  exit /b 1
)
echo.
echo Control S Gestao instalado e atualizado com sucesso.
pause
