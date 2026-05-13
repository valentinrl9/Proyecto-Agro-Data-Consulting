@echo off
title Sistema Agronómico Inteligente
color 0A

echo ============================================
echo   INICIANDO SISTEMA AGRONOMICO INTELIGENTE
echo ============================================
echo.

echo 1) Cerrando procesos anteriores...
taskkill /IM python.exe /F >nul 2>&1
taskkill /IM uvicorn.exe /F >nul 2>&1
taskkill /IM chrome.exe /F >nul 2>&1

echo Procesos limpiados.
echo.

echo 2) Iniciando API en segundo plano...
start "" /min cmd /c "cd /d C:\ProyectoIA\scripts && uvicorn api_prediccion:app --port 8000"

echo Esperando a que la API arranque...
timeout /t 3 >nul

echo 3) Abriendo dashboard en modo APP...
start chrome --app="C:\ProyectoIA\frontend\index.html"

echo.
echo ============================================
echo   SISTEMA INICIADO CORRECTAMENTE
echo ============================================
echo.
pause

