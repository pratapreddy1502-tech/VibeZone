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
set "PORT=8000"
echo This starts a local development server only.
echo The Android production APK uses https://vibezone-mwg7.onrender.com.
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
echo Uvicorn is listening on all network adapters for local development.
%PYTHON_CMD% -m uvicorn main:app --host 0.0.0.0 --port %PORT%
pause
