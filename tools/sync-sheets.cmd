@echo off
rem sync-sheets — copy MetaMax-authored sprite sheets into the game.
rem Source: docs\art\sheets\  (where the MetaMax "Sheets" tool saves <name>.png + <name>.json)
rem Target: prototype\test-game\content\sprite-atlas\  (what the game/bench loads)
rem Double-click this file, or run it from anywhere. Overwrites same-named sheets (edit-in-place).
setlocal
set SRC=%~dp0..\docs\art\sheets
set DST=%~dp0..\prototype\test-game\content\sprite-atlas
if not exist "%SRC%" (
  echo No sheets yet: %SRC% does not exist. Save a sheet in MetaMax's Sheets tool first.
  pause
  exit /b 1
)
if not exist "%DST%" mkdir "%DST%"
copy /Y "%SRC%\*.png" "%DST%" >nul 2>&1
copy /Y "%SRC%\*.json" "%DST%" >nul 2>&1
echo Synced sheets from docs\art\sheets to content\sprite-atlas:
dir /b "%SRC%"
pause
