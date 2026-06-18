# -*- coding: utf-8 -*-
"""Split chrome/content/zotero-assistant.js into smaller loadSubScript modules."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "chrome" / "content" / "zotero-assistant.js"
CONTENT = ROOT / "chrome" / "content"


def slice_lines(path: Path, start: int, end: int) -> str:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    return "".join(lines[start - 1 : end])


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)

    const_body = "".join(lines[1:566])

    const_names = []
    for line in const_body.splitlines():
        s = line.strip()
        if s.startswith("const "):
            name = s[6:].split("=")[0].split("[")[0].strip()
            if name:
                const_names.append(name)

    const_file = f"""var ZoteroAssistantConstants = (() => {{
{const_body}
  return {{
    {", ".join(const_names)}
  }};
}})();
"""
    (CONTENT / "assistant-constants.js").write_text(const_file, encoding="utf-8")

    style_inner = slice_lines(SRC, 1450, 2031).strip()
    style_file = f"""var ZoteroAssistantStyles = (() => {{
  const STYLE_ID = "zotero-assistant-global-styles";
  const STYLE_REV = "za-chat-ui-md-resize-20260617";
  function getGlobalStylesText() {{
    return `
{style_inner}
`;
  }}
  return {{ STYLE_ID, STYLE_REV, getGlobalStylesText }};
}})();
"""
    (CONTENT / "assistant-styles.js").write_text(style_file, encoding="utf-8")

    util_body = "".join(lines[8511:8698])
    util_names = []
    for line in util_body.splitlines():
        s = line.strip()
        if s.startswith("function "):
            util_names.append(s[9:].split("(")[0].strip())

    util_file = f"""var ZoteroAssistantUtil = (() => {{
{util_body}
  return {{
    {", ".join(util_names)}
  }};
}})();
"""
    (CONTENT / "assistant-util.js").write_text(util_file, encoding="utf-8")

    dispatch_file = """var ZoteroAssistantToolDispatch = (() => {
  function buildDispatchTable() {
    return {
      request_clarification: (ctx, args) => ctx.toolRequestClarification(args),
      search_items: (ctx, args) => ctx.toolSearchItems(args),
      read_current_context: (ctx) => ctx.readCurrentContext(ctx.currentTaskLibraryID()),
      read_item_fields: (ctx, args) => ctx.toolReadItemFields(args),
      read_current_reader_pages: (ctx) => ctx.toolReadCurrentReaderPages(),
      request_expanded_context: (ctx, args) => ctx.toolExpandedContext(args),
      read_library_overview: (ctx, args) => ctx.toolReadLibraryOverview(args),
      browse_library_items: (ctx, args) => ctx.toolBrowseLibraryItems(args),
      read_fulltext_page: (ctx, args) => ctx.toolReadFulltextPage(args),
      read_fulltext: (ctx, args) => ctx.toolReadFulltextPage(args),
      live_search: (ctx, args) => ctx.toolLiveSearch(args),
      web_search: () =>
        Promise.resolve({
          ok: false,
          error:
            "工具已更名为 live_search。请勿调用 web_search，请改用 live_search 并传入相同参数（如 query）。"
        }),
      web_fetch: (ctx, args) => ctx.toolWebFetch(args),
      create_collection: (ctx, args) => ctx.toolCreateCollection(args),
      add_items_to_collection: (ctx, args) => ctx.toolAddItemsToCollection(args),
      add_tags: (ctx, args) => ctx.toolAddTags(args),
      create_note: (ctx, args) => ctx.toolCreateNote(args),
      append_note: (ctx, args) => ctx.toolCreateNote(args),
      create_parent_item: (ctx, args) => ctx.toolCreateParentItem(args),
      update_metadata: (ctx, args) => ctx.toolUpdateMetadata(args),
      browse_preferences: (ctx, args) => ctx.toolBrowsePreferences(args),
      search_preferences: (ctx, args) => ctx.toolSearchPreferences(args),
      read_preferences: (ctx, args) => ctx.toolReadPreferences(args),
      list_preference_panes: (ctx, args) => ctx.toolListPreferencePanes(args),
      open_zotero_preferences: (ctx, args) => ctx.toolOpenZoteroPreferences(args),
      set_preference: (ctx, args) => ctx.toolSetPreference(args),
      request_zotero_restart: (ctx, args) => ctx.toolRequestZoteroRestart(args),
      list_plugin_commands: (ctx) => ctx.toolListPluginCommands(),
      move_to_trash: (ctx, args) => ctx.toolMoveToTrash(args),
      trigger_plugin_command: (ctx, args) => ctx.toolTriggerPluginCommand(args),
      finish_task: (ctx, args) => ctx.toolFinishTask(args)
    };
  }

  return { buildDispatchTable };
})();
"""
    (CONTENT / "assistant-tool-dispatch.js").write_text(dispatch_file, encoding="utf-8")

    part_a = "".join(lines[567:1435])
    part_b = "".join(lines[2035:5553])
    part_c = "".join(lines[5681:8510])

    destructure = ",\n    ".join(const_names)
    util_destructure = ",\n    ".join(util_names)

    new_execute = """
    async executeTool(toolName, args) {
      this.log("tool.started", { toolName, args });
      let result;
      try {
        const handler = this._toolDispatch[toolName];
        if (!handler) {
          result = { ok: false, error: `未知工具：${toolName}` };
        } else {
          result = await handler(this, args);
        }
      } catch (error) {
        result = {
          ok: false,
          error: String(error),
          source: "tool",
          toolName
        };
      }
      if (this.task) {
        if (result && result.ok === false) {
          this.task.lastToolFailure = {
            toolName,
            error: result.error || "工具返回失败。"
          };
          this.task.consecutiveToolFailures = (this.task.consecutiveToolFailures || 0) + 1;
        } else if (this.isWriteTool(toolName)) {
          this.task.lastToolFailure = null;
          this.task.consecutiveToolFailures = 0;
          this.task.executedWriteToolCount++;
        } else {
          this.task.lastToolFailure = null;
          this.task.consecutiveToolFailures = 0;
        }
      }
      this.log("tool.finished", { toolName, result });
      return result;
    }
"""

    ensure_global_styles = """
    ensureGlobalStyles(doc) {
      const { STYLE_ID, STYLE_REV, getGlobalStylesText } = ZoteroAssistantStyles;
      const existing = doc.getElementById(STYLE_ID);
      if (existing && existing.getAttribute("data-za-rev") === STYLE_REV) {
        return;
      }
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      const style = this.html(doc, "style");
      style.id = STYLE_ID;
      style.setAttribute("data-za-rev", STYLE_REV);
      style.textContent = getGlobalStylesText();
      (doc.head || doc.documentElement).appendChild(style);
    }
"""

    constructor_patch = """    constructor(data) {
      this.id = data.id;
      this.version = data.version;
      this.rootURI = data.rootURI;
      this.windows = new Map();
      this.task = null;
      this.eventLog = [];
      this.rememberedApprovals = {};
      this.undoStack = [];
      this.prefPaneID = null;
      this.sessionReadGrants = new Set();
      this.sessionPreferenceApprovals = new Set();
      this.sessionMemoryByLibraryID = new Map();
      this.libraryIndexes = new Map();
      this.notifierID = null;
      this.chatDisplayLog = [];
      this.chatTurnPending = { userText: "", aiReadable: [], process: [] };
      this.taskLoopActive = false;
      this._toolDispatch = ZoteroAssistantToolDispatch.buildDispatchTable();
    }
"""

    part_a = re.sub(
        r"    constructor\(data\) \{[\s\S]*?    \}\n\n    async startup\(\)",
        constructor_patch + "\n    async startup()",
        part_a,
        count=1,
    )
    part_b = re.sub(
        r"    ensureGlobalStyles\(doc\) \{[\s\S]*?    \}\n\n    actionButton\(doc",
        ensure_global_styles + "\n    actionButton(doc",
        part_b,
        count=1,
    )
    part_b = re.sub(
        r"    async executeTool\(toolName, args\) \{[\s\S]*?    \}\n\n    async toolRequestClarification",
        "    async toolRequestClarification",
        part_b,
        count=1,
    )
    part_c = new_execute + "\n" + part_c

    header = f"""var ZoteroAssistant = (() => {{
  const {{
    {destructure}
  }} = ZoteroAssistantConstants;
  const {{
    {util_destructure}
  }} = ZoteroAssistantUtil;

"""

    footer = """
  function create(data) {
    return new AssistantPlugin(data);
  }

  return { create };
})();
"""

    part_a = re.sub(
        r"  function create\(data\) \{\n    return new AssistantPlugin\(data\);\n  \}\n\n  class AssistantPlugin",
        "  class AssistantPlugin",
        part_a,
        count=1,
    )

    new_main = header + part_a + part_b + part_c + footer
    backup = SRC.with_suffix(".js.bak")
    if not backup.exists():
        backup.write_text(text, encoding="utf-8")
    SRC.write_text(new_main, encoding="utf-8")
    print(f"Wrote modules under {CONTENT}")
    print(f"Main file lines: {len(new_main.splitlines())}")
    print(f"Backup: {backup.name}")


if __name__ == "__main__":
    main()