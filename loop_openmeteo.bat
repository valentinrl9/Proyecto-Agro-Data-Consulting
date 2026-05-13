@echo off
cd /d C:\ProyectoIA\

:loop
echo ============================================
echo Ejecutando pipeline OpenMeteo...
echo Hora: %date% %time%
echo ============================================

rem Guardar hora de inicio en segundos
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a start_seconds=%%a*3600 + %%b*60 + %%c
)

echo --- Ejecutando descarga y procesado ---
call C:\ProyectoIA\run_job_openmeteo.bat

echo --- Esperando 30 segundos para asegurar que los CSV están completos ---
timeout /t 30 >nul

echo --- Ejecutando transformación final (etl_openmeteo_final.ktr) ---
call C:\ProyectoIA\data-integration\pan.bat /file:"C:\ProyectoIA\etl_openmeteo_final.ktr"

echo --- Calculando tiempo transcurrido ---
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set /a now_seconds=%%a*3600 + %%b*60 + %%c
)

set /a elapsed=%now_seconds% - %start_seconds%
echo Tiempo transcurrido: %elapsed% segundos

rem 15 minutos = 900 segundos
set /a remaining=900 - %elapsed%
if %remaining% LSS 0 set remaining=0

echo --- Esperando %remaining% segundos hasta completar los 15 minutos ---
timeout /t %remaining% >nul

goto loop
