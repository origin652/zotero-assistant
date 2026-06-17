import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "chrome/content/zotero-assistant.js"
t = p.read_text(encoding="utf-8")

# Split shared flex-column rule that broke sidebar vs chat launcher layout
t = re.sub(
    r"\t#zotero-assistant-sidebar,\n"
    r"\t#zotero-assistant-chat-panel,\n"
    r"\t#zotero-assistant-chat-launcher \{\n"
    r"\t  flex-direction: column;\n"
    r"\t  min-width: 0;\n"
    r"\t  --za-bg:",
    "\t#zotero-assistant-ui-root,\n"
    "\t#zotero-assistant-ui-root * {\n"
    "\t  box-sizing: border-box;\n"
    "\t}\n"
    "\t#zotero-assistant-ui-root {\n"
    "\t  --za-bg:",
    t,
    count=1,
)

t = t.replace(
    "\t  font-family: var(--za-font) !important;\n"
    "\t  background: var(--za-bg) !important;\n"
    "\t  color: var(--za-text) !important;\n"
    "\t}\n"
    "\t#zotero-assistant-sidebar {\n"
    "\t  border-left-color: var(--za-border-strong) !important;\n"
    "\t  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.10) !important;\n"
    "\t}",
    "\t}\n"
    "\t#zotero-assistant-sidebar {\n"
    "\t  display: flex !important;\n"
    "\t  flex-direction: column !important;\n"
    "\t  min-width: 0 !important;\n"
    "\t  font-family: var(--za-font) !important;\n"
    "\t  background: var(--za-bg) !important;\n"
    "\t  color: var(--za-text) !important;\n"
    "\t  border-left: 1px solid var(--za-border-strong) !important;\n"
    "\t  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.10) !important;\n"
    "\t}",
    1,
)

# Chat launcher + panel: fixed -> absolute (relative to #zotero-assistant-ui-root)
t = t.replace(
    "\t#zotero-assistant-chat-launcher {\n\t  position: fixed !important;",
    "\t#zotero-assistant-chat-launcher {\n\t  position: absolute !important;",
    1,
)
t = t.replace(
    "\t#zotero-assistant-chat-panel {\n\t  position: fixed !important;",
    "\t#zotero-assistant-chat-panel {\n\t  position: absolute !important;",
    1,
)

t = t.replace("\t  z-index: 9997 !important;", "\t  z-index: 4 !important;\n\t  pointer-events: auto !important;", 1)
t = t.replace("\t  z-index: 10006 !important;", "\t  z-index: 5 !important;", 1)

t = t.replace(
    "\t  box-sizing: border-box !important;\n"
    "\t  border: 1px solid rgba(15, 23, 42, 0.12) !important;",
    "\t  box-sizing: border-box !important;\n"
    "\t  margin: 0 !important;\n"
    "\t  padding: 0 !important;\n"
    "\t  min-width: 0 !important;\n"
    "\t  min-height: 0 !important;\n"
    "\t  font-family: var(--za-font) !important;\n"
    "\t  color: var(--za-text) !important;\n"
    "\t  border: 1px solid rgba(15, 23, 42, 0.12) !important;",
    1,
)

t = t.replace(
    "\t  display: flex !important;\n"
    "\t  align-items: center !important;\n"
    "\t  justify-content: center !important;\n"
    "\t}\n"
    "\t#zotero-assistant-chat-launcher:hover {",
    "\t  display: flex !important;\n"
    "\t  flex-direction: row !important;\n"
    "\t  align-items: center !important;\n"
    "\t  justify-content: center !important;\n"
    "\t}\n"
    "\t#zotero-assistant-chat-launcher:hover {",
    1,
)

if "\t#zotero-assistant-launcher {\n\t  font-family:" in t:
    t = t.replace(
        "\t#zotero-assistant-launcher {\n\t  font-family:",
        "\t#zotero-assistant-launcher {\n\t  position: absolute !important;\n\t  pointer-events: auto !important;\n\t  font-family:",
        1,
    )

p.write_text(t, encoding="utf-8")
print("done")