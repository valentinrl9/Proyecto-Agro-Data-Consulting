@echo off
cd /d C:\ProyectoIA\

"C:\Users\Valentin\AppData\Local\Programs\Python\Python312\python.exe" "C:\ProyectoIA\scripts\openmeteo_historico.py"
"C:\Users\Valentin\AppData\Local\Programs\Python\Python312\python.exe" "C:\ProyectoIA\scripts\openmeteo_realtime.py"
"C:\Users\Valentin\AppData\Local\Programs\Python\Python312\python.exe" "C:\ProyectoIA\scripts\openmeteo_unificar.py"

cmd /c ""C:\ProyectoIA\data-integration\kitchen.bat" /file:"C:\ProyectoIA\job_openmeteo.kjb" -norep -level=Basic"

timeout /t 2 >nul
exit /b 0
