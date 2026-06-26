@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\Git\cmd;%PATH%"
chcp 65001 > nul

echo =======================================================
echo     SUBIR APLICACION DE REPARTOS A GITHUB
echo =======================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git no esta instalado o no se encuentra en el PATH.
    echo Por favor, descarga e instala Git.
    echo.
    pause
    exit /b
)

if not exist .git (
    echo [+] Inicializando repositorio Git local...
    git init
    git branch -M main
) else (
    echo [i] El repositorio Git ya esta inicializado.
    git branch -M main
)

if not exist .gitignore (
    echo [+] Creando archivo .gitignore...
    echo node_modules/ > .gitignore
    echo dist/ >> .gitignore
    echo .env >> .gitignore
    echo .env.local >> .gitignore
)

echo [+] Anadiendo archivos al commit...
git add .

echo [+] Creando commit...
git commit -m "Configure delivery app"

echo.
echo =======================================================
echo CONFIGURACION DEL REPOSITORIO REMOTO
echo =======================================================
echo.
set "REPO_URL=https://github.com/Topsecret79/Transmaldo.git"
echo [+] Usando el repositorio configurado: %REPO_URL%

git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

echo.
echo [+] Subiendo el codigo a GitHub (rama main)...
echo [i] Es posible que GitHub te pida iniciar sesion en tu navegador para autorizar la subida.
echo.
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo =======================================================
    echo EXITO! Tu aplicacion se ha subido correctamente a GitHub.
    echo Puedes verla en: %REPO_URL%
    echo =======================================================
) else (
    echo.
    echo [ERROR] Hubo un problema al subir los archivos a GitHub.
    echo Asegurate de tener permisos en el repositorio y de haber configurado tus credenciales.
)
echo.
pause
