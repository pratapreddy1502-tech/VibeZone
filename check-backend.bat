@echo off
setlocal
echo Checking VibeZone production FastAPI backend...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$urls=@('https://vibezone-mwg7.onrender.com/','https://vibezone-mwg7.onrender.com/health');" ^
  "foreach($url in $urls) {" ^
  "  try {" ^
  "    $response=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 60;" ^
  "    Write-Host ('OK   ' + $url + ' -> ' + $response.StatusCode) -ForegroundColor Green" ^
  "  } catch {" ^
  "    Write-Host ('FAIL ' + $url + ' -> ' + $_.Exception.Message) -ForegroundColor Red" ^
  "  }" ^
  "}"
echo.
pause
