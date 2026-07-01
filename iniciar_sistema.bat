@echo off
title Agro Data Consulting - Dashboard Climatico
color 0A
cd /d "%~dp0"

echo ============================================
echo   INICIANDO SISTEMA CLIMATICO
echo ============================================
echo.

echo 1) Ejecutando ETL inicial...
python scripts\etl_pipeline.py
if errorlevel 1 (
    echo AVISO: ETL fallo. Comprueba MySQL y el archivo .env
)

echo.
echo 2) Reiniciando API...
taskkill /IM uvicorn.exe /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
start "" /min cmd /c "cd /d "%~dp0scripts" && uvicorn api_prediccion:app --port 8000"

echo Esperando a que la API arranque...
timeout /t 3 >nul

echo 3) Abriendo dashboard...
start chrome --app="http://127.0.0.1:8000/"

echo.
echo ============================================
echo   SISTEMA INICIADO
echo   ETL continuo: ejecutar loop_etl.bat
echo ============================================
echo.
pause
