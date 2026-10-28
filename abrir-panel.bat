@echo off
REM Windows: doble clic para abrir el panel del Taller editorial
cd /d "%~dp0"
python panel\servidor.py
pause
