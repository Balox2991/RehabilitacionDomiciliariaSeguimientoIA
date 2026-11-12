@echo off
rem Doble clic para levantar todo el sistema de demostración (ver iniciar-demo.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-demo.ps1" %*
pause
