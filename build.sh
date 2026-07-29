#!/usr/bin/env bash
# One-click build script for macOS / Linux.
# Produces:  dist/uat-tool  (single binary that starts server + opens browser)
set -euo pipefail

cd "$(dirname "$0")"

echo "==> 1/4  Building React frontend"
pushd frontend > /dev/null
[ -d node_modules ] || yarn install --frozen-lockfile
yarn build
popd > /dev/null

echo "==> 2/4  Installing backend deps"
python3 -m venv .venv-build || true
# shellcheck disable=SC1091
source .venv-build/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r backend/requirements.txt
pip install --quiet pyinstaller

echo "==> 3/4  Packaging with PyInstaller"
pyinstaller uat_tool.spec --clean -y

echo "==> 4/4  Done"
echo "Binary:  $(pwd)/dist/uat-tool"
echo "Run it — it will open your browser to http://127.0.0.1:8001"
