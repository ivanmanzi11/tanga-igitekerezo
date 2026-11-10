# Starts the backend and the frontend, each in its own window, ready for phones and tablets
# on the same Wi-Fi. Run from the project folder:   .\start-dev.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# The computer's address on the local network (e.g. 192.168.1.25)
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -match '^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|VirtualBox|VMware' } |
       Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "localhost" }

$activate = Join-Path $root "backend\venv\Scripts\Activate.ps1"
$backendCmd = "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; " +
              $(if (Test-Path $activate) { "& '$activate'; " } else { "" }) +
              "cd '$root\backend'; python manage.py migrate; python manage.py runserver 0.0.0.0:8000"
$frontendCmd = "cd '$root\frontend'; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host ""
Write-Host "On this computer:  http://localhost:5173"
Write-Host "On a phone/tablet (same Wi-Fi):  http://$($ip):5173"
Write-Host "Staff sign-in: admin / ChangeMe123!  (change it after the first login)"
