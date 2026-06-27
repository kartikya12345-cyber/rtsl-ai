@echo off
title Sign Language Detection System

cd /d "%~dp0"

echo =====================================
echo Starting Sign Language Detection...
echo =====================================

start http://127.0.0.1:8001/

uvicorn main:app --host 127.0.0.1 --port 8001 --reload

pause