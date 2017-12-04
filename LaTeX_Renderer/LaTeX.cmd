@echo off

SET NAME=PRESETED_NAME_CF6D2F413FA16B724A1AAB1B2BD37CCF

:ask
if "%1"=="" (
    set /p NAME=?LaTeX::Filename=
    if "%NAME%"=="PRESETED_NAME_CF6D2F413FA16B724A1AAB1B2BD37CCF" (
        echo. && echo [WARNING] Latex::Filename should not be empty. && echo.
        goto ask
    )
) else (
    set NAME=%1
)

start "latex.js" "C:\Program Files\nodejs\node.exe" C:\Users\Administrator\Desktop\Work\Code\node.js\LaTeX_Renderer\latex.js "%NAME%"
