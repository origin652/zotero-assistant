import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(os.environ.get("PWD", "."))
BUILD_DIR = ROOT / "build"
OUT_FILE = BUILD_DIR / "zotero-assistant.xpi"
INCLUDED = [
    "manifest.json",
    "bootstrap.js",
    "chrome/content/preferences.xhtml",
    "chrome/content/zotero-assistant.js",
]


def main() -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUT_FILE, "w", compression=ZIP_DEFLATED) as archive:
        for relative in INCLUDED:
            source = ROOT / relative
            if not source.is_file():
                raise FileNotFoundError(relative)
            archive.write(source, arcname=relative)
    print(f"Wrote {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
