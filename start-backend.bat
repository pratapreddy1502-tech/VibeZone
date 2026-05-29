@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_CMD="
where py >nul 2>nul
if %errorlevel%==0 set "PYTHON_CMD=py -3"

if "%PYTHON_CMD%"=="" (
  where python >nul 2>nul
  if %errorlevel%==0 set "PYTHON_CMD=python"
)

if "%PYTHON_CMD%"=="" (
  where python3 >nul 2>nul
  if %errorlevel%==0 set "PYTHON_CMD=python3"
)

if "%PYTHON_CMD%"=="" (
  echo Python was not found. Install Python 3, then run this file again.
  echo Download: https://www.python.org/downloads/
  pause
  exit /b 1
)

echo Using: %PYTHON_CMD%
echo Installing/updating backend dependencies...
%PYTHON_CMD% -m pip install -r requirements.txt
if errorlevel 1 (
  echo Failed to install backend dependencies.
  pause
  exit /b 1
)

echo.
echo Starting VibeZone FastAPI backend...
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LAN_IP=%%I"
if "%LAN_IP%"=="" set "LAN_IP=10.110.221.227"
echo PC URL:    http://localhost:8000/reels
echo Phone URL: http://%LAN_IP%:8000/reels
echo.
echo Checking backend imports and PostgreSQL connection...
%PYTHON_CMD% -c "import main; print('Backend import OK')"
if errorlevel 1 (
  echo.
  echo Backend failed before Uvicorn could start.
  echo Check DATABASE_URL in .env and make sure PostgreSQL is running.
  pause
  exit /b 1
)

echo.
echo Uvicorn is listening on all network adapters.
echo Keep this window open while using the mobile app.
%PYTHON_CMD% -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
