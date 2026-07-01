@echo off
cd /d "%~dp0"

:loop
echo ============================================
echo ETL Open-Meteo (Python)
echo Hora: %date% %time%
echo ============================================

for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a start_seconds=%%a*3600 + %%b*60 + %%c
)

python scripts\etl_pipeline.py
if errorlevel 1 (
    echo ERROR en ETL. Reintentando en 5 minutos...
    timeout /t 300 >nul
    goto loop
)

for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a now_seconds=%%a*3600 + %%b*60 + %%c
)

set /a elapsed=%now_seconds% - %start_seconds%
if %elapsed% LSS 0 set /a elapsed+=86400
set /a remaining=900 - %elapsed%
if %remaining% LSS 0 set remaining=0

echo Esperando %remaining% segundos hasta el proximo ciclo (15 min)...
timeout /t %remaining% >nul
goto loop
