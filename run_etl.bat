@echo off
cd /d "%~dp0"

if not exist ".env" (
    echo.
    echo [AVISO] No existe .env — copiando desde .env.example...
    copy /Y ".env.example" ".env" >nul
    echo Edita .env y pon tu MYSQL_PASSWORD antes de continuar.
    echo.
    pause
    exit /b 1
)

python scripts\etl_pipeline.py
exit /b %ERRORLEVEL%
