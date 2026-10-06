@echo off
taskkill /F /IM cloudflared.exe >nul 2>nul
for /f "tokens=2" %%p in ('netstat -ano ^| findstr ":7101" ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>nul
echo Stopped.
timeout /t 2 >nul
