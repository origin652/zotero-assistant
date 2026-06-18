# -*- coding: utf-8 -*-
"""Wrap assistant-plugin-*.js mixins in IIFE with constants/util in scope."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "chrome" / "content"

CONST_DESTRUCTURE = """  const {
    HTML_NS,
    PREF_PREFIX,
    PREFS,
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_API_MODE,
    DEFAULT_SAFETY_MODE,
    DEFAULT_SESSION_MEMORY_ENABLED,
    DEFAULT_AUTO_COMPRESSION_ENABLED,
    DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS,
    DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS,
    DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES,
    DEFAULT_CONTEXT_COMPRESSION_MAX_TOKENS,
    DEFAULT_CONTEXT_COMPRESSION_TARGET_TOKENS,
    CHARS_PER_TOKEN_ESTIMATE,
    DEFAULT_CONTEXT_COMPRESSION_TRIGGER_MESSAGES,
    CHAT_MINIMIZED_HEIGHT,
    CHAT_MIN_WIDTH,
    CHAT_MIN_HEIGHT,
    CHAT_DEFAULT_WIDTH,
    CHAT_DEFAULT_HEIGHT,
    MAX_CHAT_DISPLAY_LOG,
    MAX_CHAT_DISPLAY_CHARS,
    COMPRESSED_CONTEXT_MARKER,
    PREF_PANE_ID,
    LOG_RETENTION_DAYS,
    MAX_MODEL_RETRIES,
    MAX_MODEL_FETCH_MS,
    MAX_COLLECTIONS_PER_MODEL_ROUND,
    MAX_ITEMS_PER_MODEL_ROUND,
    MAX_CONTEXT_SELECTED_ITEMS,
    MAX_TASK_LOOPS,
    DEFAULT_BROWSE_PAGE_SIZE,
    MAX_BROWSE_PAGE_SIZE,
    FULLTEXT_PAGE_CHARS,
    READER_PAGE_CHARS,
    READER_NEIGHBOR_PAGE_RADIUS,
    NOTE_PREVIEW_LENGTH,
    ABSTRACT_PREVIEW_LENGTH,
    MAX_OVERVIEW_TAGS,
    MAX_OVERVIEW_COLLECTIONS,
    MAX_LIVE_SEARCH_PER_MODEL_ROUND,
    LEGACY_WEB_SEARCH_TOOL,
    LIVE_SEARCH_TOOL,
    MAX_WEB_FETCH_PER_MODEL_ROUND,
    MAX_WEB_SEARCH_RESULTS,
    WEB_FETCH_TIMEOUT_MS,
    WEB_FETCH_MAX_BYTES,
    WEB_FETCH_MAX_CHARS,
    DEBUG_TEXT_LIMIT,
    DEBUG_MESSAGE_LIMIT,
    DEBUG_MESSAGE_TAIL,
    COMPRESSION_MESSAGE_SERIALIZE_LIMIT,
    MEMORY_MESSAGE_SERIALIZE_LIMIT,
    MEMORY_RECENT_MESSAGE_LIMIT,
    DEFAULT_PREF_PAGE_SIZE,
    MAX_PREF_PAGE_SIZE,
    WEB_SEARCH_USER_AGENT,
    INDEX_NOTIFIER_TYPES,
    SESSION_GRANT_TOOL,
    READ_TOOLS,
    LOW_RISK_WRITE_TOOLS,
    HIGH_RISK_WRITE_TOOLS,
    TOOL_DEFINITIONS
  } = ZoteroAssistantConstants;
"""

UTIL_DESTRUCTURE = """  const {
    safeCall,
    stripHTML,
    truncateText,
    safeJSONStringify,
    mapCountsToSortedPairs,
    extractYear,
    isAttachmentItem,
    normalizeFulltextContent,
    parseMarkdownBlocks,
    tokenizeInlineMarkdown
  } = ZoteroAssistantUtil;
"""


def wrap_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8").strip()
    if text.startswith("var ZoteroAssistantPlugin") and "= (() =>" in text:
        return
    m = re.match(r"var\s+(\w+)\s*=\s*(\{[\s\S]*\});?\s*$", text)
    if not m:
        raise RuntimeError(f"Unexpected format: {path.name}")
    var_name, obj_literal = m.group(1), m.group(2)
    wrapped = (
        f"var {var_name} = (() => {{\n"
        f"{CONST_DESTRUCTURE}"
        f"{UTIL_DESTRUCTURE}\n"
        f"  return {obj_literal};\n"
        f"}})();\n"
    )
    path.write_text(wrapped, encoding="utf-8")
    print(f"Wrapped {path.name}")


def main() -> None:
    for path in sorted(CONTENT.glob("assistant-plugin-*.js")):
        wrap_file(path)
    slim = """var ZoteroAssistant = (() => {
  class AssistantPlugin {
    constructor(data) {
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
  }

  Object.assign(AssistantPlugin.prototype,
    ZoteroAssistantPluginApprovalUi,
    ZoteroAssistantPluginChat,
    ZoteroAssistantPluginCore,
    ZoteroAssistantPluginLibrary,
    ZoteroAssistantPluginModel,
    ZoteroAssistantPluginPrefs,
    ZoteroAssistantPluginSidebar,
    ZoteroAssistantPluginTask,
    ZoteroAssistantPluginUiDom
  );

  function create(data) {
    return new AssistantPlugin(data);
  }

  return { create };
})();
"""
    (CONTENT / "zotero-assistant.js").write_text(slim, encoding="utf-8")
    print(f"Slim main: {len(slim.splitlines())} lines")


if __name__ == "__main__":
    main()