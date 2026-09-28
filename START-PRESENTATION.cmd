@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, then run this launcher again.
  pause
  exit /b 1
)
if not exist .env (
  echo Copy your existing Commecs Project .env into this folder first.
  echo The existing API key and File Search store are required for live answers.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npm run build
if errorlevel 1 (
  pause
  exit /b 1
)
echo Open http://localhost:3000 after the server starts. Keep this window open.
call npm start
pause
