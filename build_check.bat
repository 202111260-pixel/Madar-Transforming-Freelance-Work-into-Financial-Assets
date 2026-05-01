@echo off
cd /d C:\ai-smart-preview
call npx tsc --noEmit 2>&1
if %errorlevel% == 0 (
  echo TSC_PASS
) else (
  echo TSC_FAIL
)
