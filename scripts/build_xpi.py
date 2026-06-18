import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(os.environ.get("PWD", "."))
BUILD_DIR = ROOT / "build"
OUT_FILE = BUILD_DIR / "zotero-assistant.xpi"
INCLUDED = [
    "manifest.json",
    "bootstrap.js",
    "icons/zotero-assistant-icon-16.png",
    "icons/zotero-assistant-icon-32.png",
    "icons/zotero-assistant-icon-48.png",
    "icons/zotero-assistant-icon-96.png",
    "icons/zotero-assistant-icon-128.png",
    "chrome/content/preferences.xhtml",
    "chrome/content/assistant-constants.js",
    "chrome/content/assistant-util.js",
    "chrome/content/assistant-styles.js",
    "chrome/content/assistant-tool-dispatch.js",
    "chrome/content/assistant-plugin-ui-dom.js",
    "chrome/content/assistant-plugin-sidebar.js",
    "chrome/content/assistant-plugin-approval-ui.js",
    "chrome/content/assistant-plugin-chat.js",
    "chrome/content/assistant-plugin-model.js",
    "chrome/content/assistant-plugin-task.js",
    "chrome/content/assistant-plugin-prefs.js",
    "chrome/content/assistant-plugin-library.js",
    "chrome/content/assistant-plugin-core.js",
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
