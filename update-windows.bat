@echo off
setlocal
REM Gets the latest ABRAH Recruitment code into this folder, then starts the app.
REM Your database (backend\hr_services.db) and installed packages are kept.
REM Any files you edited here are set aside first (see "git stash list"), never deleted.
cd /d "%~dp0"
set "REPO=https://github.com/veeravairamnivya/HR-Services.git"
set "BRANCH=claude/hr-recruitment-app-7gnvcl"

where git >nul 2>nul || (echo Git is required. Install it from https://git-scm.com/download/win and run this file again. & pause & exit /b 1)
if not exist .git (echo This folder was not downloaded with Git. Run install-HR-to-D-ABRAH.bat once instead. & pause & exit /b 1)

echo Checking for local edits...
set "DIRTY="
for /f %%i in ('git status --porcelain') do set "DIRTY=1"
if defined DIRTY (
  git stash push -u -m "Local edits saved before update" >nul || (echo Could not set your edits aside. Send a screenshot of this window. & pause & exit /b 1)
  echo Your local edits were set aside with "git stash" - restore them with: git stash pop
)

echo Downloading the latest code...
git fetch %REPO% %BRANCH% || (echo Download failed. Check your internet connection or GitHub sign-in. & pause & exit /b 1)
git checkout -q -B %BRANCH% FETCH_HEAD || (echo Update failed. Send a screenshot of this window. & pause & exit /b 1)

echo.
echo Updated to the latest version. Starting the app...
call "%~dp0start-windows.bat"
