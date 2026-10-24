@echo off
setlocal EnableDelayedExpansion
title Meowvie — Stop Server
cd /d "%~dp0"

:: ── Colour helpers (works on Win10+) ──────────────────────────────────────
for /f %%i in ('echo prompt $E^| cmd') do set "ESC=%%i"
set "RESET=%ESC%[0m"
set "BOLD=%ESC%[1m"
set "DIM=%ESC%[2m"
set "CYAN=%ESC%[96m"
set "YELLOW=%ESC%[93m"
set "GREEN=%ESC%[92m"
set "RED=%ESC%[91m"
set "WHITE=%ESC%[97m"
set "PURPLE=%ESC%[95m"

echo.
echo  %PURPLE%%BOLD%╔═══════════════════════════════════════════════════╗%RESET%
echo  %PURPLE%%BOLD%║%RESET%   %YELLOW%🛑  Meowvie  —  Stop Server%RESET%                  %PURPLE%%BOLD%║%RESET%
echo  %PURPLE%%BOLD%╚═══════════════════════════════════════════════════╝%RESET%
echo.

set "STOPPED=0"

:: ── Stop processes listening on server ports (3001, 3002, 5173, 3000) ────
echo  %WHITE%Scanning for active Meowvie server ports (3001, 3002, 5173)...%RESET%

for %%P in (3001 3002 5173 3000) do (
    for /f "tokens=5" %%a in ('netstat -a -n -o 2^>nul ^| findstr /r /c:":%%P .*LISTENING"') do (
        set "PID=%%a"
        if defined PID (
            if not "!PID!"=="0" (
                echo  %YELLOW%[→]%RESET% Terminating process on port %CYAN%%%P%RESET% ^(PID: %RED%!PID!%RESET%^)...
                taskkill /F /T /PID !PID! >nul 2>&1
                if !errorlevel! equ 0 (
                    set "STOPPED=1"
                )
            )
        )
    )
)

:: ── Stop any running node.exe instances of host.js or server/index.js ─────
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -like '*host.js*' -or $_.CommandLine -like '*server\index.js*' -or $_.CommandLine -like '*server/index.js*') } | Select-Object -ExpandProperty ProcessId" 2^>nul`) do (
    set "NODE_PID=%%i"
    if defined NODE_PID (
        echo  %YELLOW%[→]%RESET% Terminating Meowvie host process ^(PID: %RED%!NODE_PID!%RESET%^)...
        taskkill /F /T /PID !NODE_PID! >nul 2>&1
        if !errorlevel! equ 0 (
            set "STOPPED=1"
        )
    )
)

echo.
if "!STOPPED!"=="1" (
    echo  %GREEN%%BOLD%[✓] Meowvie server stopped successfully!%RESET%
) else (
    echo  %DIM%[i] No active Meowvie server was found running.%RESET%
)
echo.

:: ── Short pause if run by double-clicking ──────────────────────────────────
timeout /t 3 >nul 2>&1
if %errorlevel% neq 0 (
    ping 127.0.0.1 -n 3 >nul 2>&1
)
