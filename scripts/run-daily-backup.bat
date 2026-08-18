@echo off
echo =========================================================
echo RG Maintenance OS - Backup Diario de Ficheiros Excel
echo =========================================================
cd /d "G:\rg-maintenance"
node scripts\daily-excel-backup.js
echo.
echo Backup concluido em: %date% %time%
pause
