@echo off
cd /d "%~dp0"
set "KIMI_NODE=C:\Users\qOuOp\AppData\Local\Programs\kimi-desktop\resources\resources\runtime\node.exe"
if exist "%KIMI_NODE%" goto kimi
where node >nul 2>nul
if %errorlevel%==0 goto sysnode
echo [ERROR] Node runtime not found. Please send a screenshot of this window.
pause
exit /b 1

:kimi
"%KIMI_NODE%" server\start-remote.mjs
goto end

:sysnode
node server\start-remote.mjs

:end
echo.
echo Service stopped. If no public URL was shown above, send a screenshot for help.
pause
