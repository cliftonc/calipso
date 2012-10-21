@echo off
SET DIR=%~dp0%
@IF EXIST "%DIR%..\lib\calipso-cli.js" (
  REM This is when the calipso source is the current directory
  SET NODE_PATH=%DIR%/..
  node "%DIR%..\lib\calipso-cli.js" %*
) else (
  REM This is when calipso is installed with npm install -g
  SET NODE_PATH=%DIR%/..
  node "%DIR%..\lib\node_modules\calipso\lib\calipso-cli.js" %*
)