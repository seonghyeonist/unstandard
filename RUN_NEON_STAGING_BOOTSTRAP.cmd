@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Start-UnstandardNeonStaging.ps1" %*
endlocal
