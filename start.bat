@echo off
REM Kích hoạt file VBS để chạy Electron không hiện Command Prompt
start wscript //B //nologo "%~dp0start-silent.vbs"
exit
