@echo off
:: Script para automatizar la subida del proyecto a GitHub
chcp 65001 > nul
echo =======================================================
echo     SUBIR APLICACIÓN DE REPARTOS A GITHUB
echo =======================================================
echo.

:: Verificar si Git está instalado
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git no está instalado o no se encuentra en el PATH.
    echo Por favor, descarga e instala Git desde: https://git-scm.com/
    echo Una vez instalado, vuelve a ejecutar este script.
    echo.
    pause
    exit /b
)

:: Inicializar git si no está inicializado
if not exist .git (
    echo [+] Inicializando repositorio Git local...
    git init
    git branch -M main
) else (
    echo [i] El repositorio Git ya está inicializado.
)

:: Crear .gitignore básico si no existe
if not exist .gitignore (
    echo [+] Creando archivo .gitignore...
    echo node_modules/ > .gitignore
    echo dist/ >> .gitignore
    echo .env >> .gitignore
    echo .env.local >> .gitignore
)

:: Añadir todos los archivos
echo [+] Añadiendo archivos al commit...
git add .

:: Confirmar cambios
echo [+] Creando commit inicial...
git commit -m "Commit inicial: Aplicación de repartos para furgonetas"

echo.
echo =======================================================
echo CONFIGURACIÓN DEL REPOSITORIO REMOTO
echo =======================================================
echo.
echo Crea un repositorio vacío en tu cuenta de GitHub (ej. "repartos-app").
set /p REPO_URL="Introduce la URL HTTPS de tu repositorio de GitHub: "

if "%REPO_URL%"=="" (
    echo [ERROR] No has introducido ninguna URL. Operación cancelada.
    pause
    exit /b
)

:: Añadir el origen remoto (eliminar si ya existía uno)
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

echo.
echo [+] Subiendo el código a GitHub (rama main)...
echo [i] Es posible que GitHub te pida iniciar sesión en tu navegador para autorizar la subida.
echo.
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo =======================================================
    echo ¡ÉXITO! Tu aplicación se ha subido correctamente a GitHub.
    echo Puedes verla en: %REPO_URL%
    echo =======================================================
) else (
    echo.
    echo [ERROR] Hubo un problema al subir los archivos a GitHub.
    echo Asegúrate de tener permisos en el repositorio y de haber configurado tus credenciales.
)
echo.
pause
