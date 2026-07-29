# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the UAT Text Comparator single-binary bundle.
# Usage (on Mac/Windows, once the frontend has been built):
#   pyinstaller uat_tool.spec --clean -y

from pathlib import Path

ROOT = Path(SPECPATH)
BACKEND = ROOT / "backend"
FRONTEND_BUILD = ROOT / "frontend" / "build"

datas = []
if FRONTEND_BUILD.exists():
    for p in FRONTEND_BUILD.rglob("*"):
        if p.is_file():
            rel = p.parent.relative_to(ROOT)
            datas.append((str(p), str(rel)))

# Ship the default glossary + sample data
datas.append((str(BACKEND / "glossary.json"), "backend"))
if (BACKEND / "samples").exists():
    for p in (BACKEND / "samples").rglob("*"):
        if p.is_file():
            rel = p.parent.relative_to(ROOT)
            datas.append((str(p), str(rel)))

hiddenimports = [
    "pdfplumber",
    "extract_msg",
    "docx",
    "pptx",
    "openpyxl",
    "reportlab",
    "reportlab.pdfbase._fontdata_enc_winansi",
    "reportlab.pdfbase._fontdata_enc_macroman",
    "reportlab.pdfbase._fontdata_widths_helvetica",
    "reportlab.pdfbase._fontdata_widths_helveticaboldoblique",
    "lxml",
    "lxml.etree",
    "lxml._elementpath",
    "soupsieve",
    "bs4",
    "bs4.builder",
    "bs4.builder._lxml",
    "bs4.builder._html5lib",
    "html5lib",
    "email.mime.application",
    "email.mime.multipart",
    "email.mime.text",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "sqlite3",
]

a = Analysis(
    [str(BACKEND / "launcher.py")],
    pathex=[str(BACKEND)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="uat-tool",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
