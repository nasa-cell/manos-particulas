@echo off
title Particulas por gestos
cd /d "%~dp0pagina"

where python >nul 2>nul
if errorlevel 1 (
  echo No se encontro Python en esta PC.
  echo Instala Python desde https://www.python.org y vuelve a abrir este archivo.
  pause
  exit /b
)

set PUERTO=8000
:buscar
netstat -ano | findstr /r /c:":%PUERTO% .*LISTENING" >nul
if not errorlevel 1 (
  set /a PUERTO+=1
  if %PUERTO% GTR 8020 (
    echo No hay un puerto libre entre 8000 y 8020.
    pause
    exit /b
  )
  goto buscar
)

echo.
echo  Particulas por gestos en http://localhost:%PUERTO%
echo  Cierra esta ventana para apagar.
echo.
start "" "http://localhost:%PUERTO%"
python -m http.server %PUERTO% --bind 127.0.0.1
