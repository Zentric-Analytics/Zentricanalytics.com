@echo off
setlocal
set "OPERATOR="
for /f "usebackq delims=" %%P in (`wsl.exe -d Ubuntu-24.04 -u root -- wslpath -u "%~dp0track-b-native-operator.mjs"`) do set "OPERATOR=%%P"
if not defined OPERATOR (
    echo Zentric Analytics could not locate the local WSL controller.
    pause
    exit /b 1
)
wsl.exe -d Ubuntu-24.04 -u root -- /root/.cache/zentric-q03/mission13-node/node-v22.23.3-linux-x64/bin/node "%OPERATOR%" local-synthetic-operator confirm
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" echo Track B stopped. Review the result above before trying again.
pause
exit /b %RESULT%
