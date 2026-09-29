@echo off
setlocal
cd /d "%~dp0"
title Commecs Assistant - Presentation
set "PATH=%ProgramFiles%\nodejs;%PATH%"
echo Commecs Assistant - Presentation
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Install Node.js 22 or newer first.
  goto failed
)
if not exist .env (
  echo ERROR: Restore your project .env file first.
  goto failed
)
if not exist node_modules\typescript\bin\tsc (
  echo Installing project dependencies...
  call npm.cmd ci
  if errorlevel 1 goto failed
)
node --env-file=.env scripts\check-presentation-port.mjs
if errorlevel 1 goto failed
echo Building the complete project...
call npm.cmd run build
if errorlevel 1 goto failed
echo.
echo Checking presentation backups (no internet required)...
node scripts\check-presentation.mjs
if errorlevel 1 goto failed
echo Open http://localhost:3000 manually in your browser.
echo Keep this window open during your presentation. Press Ctrl+C to stop.
echo.
call npm.cmd start
if errorlevel 1 goto failed
goto :eof
:failed
echo.
echo Startup stopped. The error is shown above.
pause
exit /b 1



