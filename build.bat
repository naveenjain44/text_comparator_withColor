@echo off
REM One-click build script for Windows.
REM Produces:  dist\uat-tool.exe
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==^> 1/4  Building React frontend
pushd frontend
if not exist node_modules ( call yarn install --frozen-lockfile )
call yarn build
popd

echo ==^> 2/4  Installing backend deps
if not exist .venv-build ( python -m venv .venv-build )
call .venv-build\Scripts\activate.bat
python -m pip install --quiet --upgrade pip
pip install --quiet -r backend\requirements.txt
pip install --quiet pyinstaller

echo ==^> 3/4  Packaging with PyInstaller
pyinstaller uat_tool.spec --clean -y

echo ==^> 4/4  Done
echo Binary:  %cd%\dist\uat-tool.exe
echo Double-click it - your browser will open at http://127.0.0.1:8001
