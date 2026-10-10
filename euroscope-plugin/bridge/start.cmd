@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is required to run the EuroScope bridge. Install it and reopen this launcher.
    pause
    exit /b 1
)
echo Starting the EuroScope bridge for shared ESSA AMAN.
echo Keep this window open and use the AMAN on vatiris.se.
echo This launcher does not start a separate local arrival sequence.
node "%~dp0server.mjs" --output "%~dp0..\MAESTROTiming.json"
pause
