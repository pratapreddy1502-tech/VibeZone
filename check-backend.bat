@echo off
setlocal
echo Checking VibeZone FastAPI backend...
echo.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LAN_IP=%%I"
if "%LAN_IP%"=="" set "LAN_IP=10.110.221.227"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lan='%LAN_IP%'; $urls=@('http://localhost:8000/health','http://localhost:8000/reels','http://127.0.0.1:8000/health','http://127.0.0.1:8000/reels',('http://' + $lan + ':8000/health'),('http://' + $lan + ':8000/reels'));" ^
  "foreach($url in $urls) {" ^
  "  try {" ^
  "    $response=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5;" ^
  "    Write-Host ('OK   ' + $url + ' -> ' + $response.StatusCode) -ForegroundColor Green" ^
  "  } catch {" ^
  "    Write-Host ('FAIL ' + $url + ' -> ' + $_.Exception.Message) -ForegroundColor Red" ^
  "  }" ^
  "}"
echo.
pause
