@echo off
REM SaneSim - inicializador para Windows (duplo clique)
REM Na primeira execucao instala as dependencias; depois so abre o programa.
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python nao encontrado. Instale em https://www.python.org/downloads/
    echo e marque a opcao "Add Python to PATH" na instalacao.
    pause
    exit /b 1
)

if not exist ".deps_instaladas" (
    echo Instalando dependencias ^(so na primeira vez^)...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Falha ao instalar dependencias. Verifique sua conexao.
        pause
        exit /b 1
    )
    echo ok > .deps_instaladas
)

start "SaneSim" /b python main.py
