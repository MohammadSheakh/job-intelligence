@echo off
setlocal
set MODE=%~1
if /I "%MODE%"=="local" goto local
if /I "%MODE%"=="neon" goto neon
echo Usage: switch-db.cmd local^|neon
exit /b 2

:local
echo [db-switch] switching to LOCAL Docker PostgreSQL
docker compose -f compose.yaml down --remove-orphans || exit /b 1
docker compose -f compose.yaml up --build -d --remove-orphans || exit /b 1
echo [db-switch] LOCAL is active: http://localhost:3000
exit /b 0

:neon
findstr /R /C:"^DATABASE_URL=..*" .env >nul
if errorlevel 1 (
  echo [db-switch] DATABASE_URL is empty in .env. Add the Neon connection string first.
  exit /b 1
)
echo [db-switch] switching to NEON
docker compose -f compose.yaml down --remove-orphans || exit /b 1
docker compose -f compose.neon.yaml up --build -d --remove-orphans || exit /b 1
echo [db-switch] NEON is active: http://localhost:3000
exit /b 0
