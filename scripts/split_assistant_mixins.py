# -*- coding: utf-8 -*-
"""Split AssistantPlugin methods into prototype mixin modules."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "chrome" / "content" / "zotero-assistant.js"
CONTENT = ROOT / "chrome" / "content"

# Methods that stay on the class body in zotero-assistant.js (not in mixins)
CLASS_ONLY = {"constructor"}

MODULE_METHODS: dict[str, set[str]] = {
    "assistant-plugin-ui-dom.js": {
        "el",
        "html",
        "panel",
        "actionButton",
        "applyButtonInlineStyle",
        "statusPillClass",
        "toastPalette",
        "toastButton",
        "createToast",
        "animateToast",
        "looksLikeMarkdown",
        "fillChatBubbleContent",
        "renderMarkdownInto",
        "appendInlineMarkdown",
        "truncateText",
    },
    "assistant-plugin-sidebar.js": {
        "createSidebar",
        "createLauncher",
        "attachSidebar",
        "isSidebarVisible",
        "setSidebarOpen",
        "toggleSidebar",
        "showSidebar",
        "hideSidebar",
        "createHeader",
        "listPreferencePanes",
        "resolvePreferencePaneId",
        "openPreferencesPaneById",
        "openPreferencesPane",
        "addToolsMenuItem",
        "ensureUiOverlayRoot",
    },
    "assistant-plugin-chat.js": {
        "createChatLauncher",
        "createChatPanel",
        "defaultChatBounds",
        "clampChatBounds",
        "applyChatBounds",
        "avoidSidebarOverlapForChat",
        "showChatPanel",
        "hideChatPanel",
        "toggleMinimizeChatPanel",
        "attachChatDragHandlers",
        "attachChatResizeHandlers",
        "runTaskLoopInBackground",
        "showChatNotice",
        "sendChatInput",
        "startTaskFromInput",
        "startTaskFromText",
        "continueConversationWithUserMessage",
        "canContinueConversationTask",
        "renderChatPanelIfOpen",
        "scheduleChatRepaint",
        "parseArguments",
        "chatMessageTextFromToolCall",
        "appendChatDisplay",
        "resetChatTurnPending",
        "beginChatTurnUser",
        "pushChatTurnReadable",
        "finishTaskSummaryMeetsUserMessageRule",
        "pushChatTurnProcess",
        "compressProcessLinesForChat",
        "flushChatTurnToDisplay",
        "chatProcessLineFromToolCall",
        "absorbAssistantMessageForChatDisplay",
        "appendAssistantToolCallsToChatDisplay",
        "backfillChatDisplayFromTask",
        "chatTurnPendingTranscriptEntries",
        "buildChatTranscript",
        "isChatTaskBusy",
        "resolveChatState",
        "chatBusyStatusLabel",
        "createChatTypingRow",
        "renderChatPanel",
        "createChatBubbleRow",
        "renderChatApprovalCard",
    },
    "assistant-plugin-approval-ui.js": {
        "ensurePopupHost",
        "createNativePopup",
        "ensureApprovalPopup",
        "ensureLogPopup",
        "getAnchorRect",
        "popupScreenOrigin",
        "openPopupAtPosition",
        "hidePopup",
        "renderApprovalPopup",
        "renderLogPopup",
        "renderStatus",
        "renderGrantState",
        "renderApprovals",
        "renderLog",
        "showMessage",
        "evaluateApproval",
        "approvalKey",
        "approvalSummary",
        "buildPendingApproval",
        "approvePending",
        "rejectPending",
        "formatLogEvent",
        "summarizeToolArgs",
        "summarizeToolResult",
    },
    "assistant-plugin-model.js": {
        "isDebugModeEnabled",
        "isSessionMemoryEnabled",
        "isAutoCompressionEnabled",
        "boundedIntPref",
        "contextCompressionTriggerChars",
        "contextCompressionTargetChars",
        "contextCompressionKeepMessages",
        "contextCompressionMaxTokens",
        "contextCompressionTargetTokens",
        "estimateMessagesTokens",
        "estimateMessageTokens",
        "recentContextStartByTokens",
        "getDebugOutputDir",
        "buildDebugFileName",
        "joinPath",
        "localFile",
        "ensureDirectory",
        "writeTextFile",
        "debugContentPreview",
        "sanitizeToolArgs",
        "sanitizeToolCalls",
        "sanitizeForLog",
        "debugMessagesTail",
        "modelRequestSnapshot",
        "modelCallOptionsSnapshot",
        "serializeErrorForDebug",
        "buildTaskSnapshot",
        "buildDebugReport",
        "maybeWriteDebugReport",
        "makeModelError",
        "systemPrompt",
        "getFetch",
        "normalizeAPIMode",
        "resolveModelEndpoint",
        "buildRequestVariants",
        "buildResponsesInstructions",
        "responsesToolDefinitions",
        "buildResponsesInput",
        "responsesFunctionCallInput",
        "buildCompletionPrompt",
        "normalizeModelResponse",
        "normalizeResponsesModelResponse",
        "extractResponsesOutputText",
        "extractResponsesTextPart",
        "extractResponsesToolCalls",
        "toInternalToolCallFromResponses",
        "normalizePlainAssistantMessage",
        "normalizeTextContent",
        "looksLikeToolPlanJson",
        "stripJsonToolPlanFromAssistantText",
        "normalizeContentToolPlan",
        "toToolCall",
        "callModelWithRetries",
        "callModel",
        "fetchModelResponseTextWithTimeout",
        "handleModelResponse",
        "handlePlainAssistantMessage",
    },
    "assistant-plugin-task.js": {
        "resetModelRoundQuota",
        "runTaskLoop",
        "finishAfterLoopLimit",
        "stringifyContextObject",
        "messageContentForSummary",
        "serializeMessageForSummary",
        "serializeMessagesForSummary",
        "estimateMessageChars",
        "estimateMessagesChars",
        "isCompressedContextMessage",
        "recentContextStart",
        "compressionSystemInstruction",
        "ensureTaskContextBudget",
        "compressTaskContext",
        "trimTaskMessagesAfterCompressionFailure",
        "continueAfterCompressionFailure",
        "getSessionMemory",
        "setSessionMemory",
        "sessionMemorySystemInstruction",
        "buildTaskMemoryPayload",
        "clearSessionMemoryForLibrary",
        "safeUpdateSessionMemoryForTask",
        "copyTextToClipboard",
        "copySessionMemoryForLibrary",
        "injectTaskContext",
    },
    "assistant-plugin-prefs.js": {
        "preferenceBranch",
        "prefConstant",
        "allPreferenceNames",
        "normalizePreferenceName",
        "normalizePreferencePrefix",
        "isMozillaInternalPreference",
        "isAllowedPreferenceNamespace",
        "isSensitivePreferenceName",
        "knownVisiblePreferenceNames",
        "isKnownVisiblePreference",
        "sourcePrefixForPreference",
        "preferenceTypeName",
        "preferenceExists",
        "readPreferenceRaw",
        "setPreferenceRaw",
        "validatePreferenceWrite",
        "maskSensitiveValue",
        "preferenceRiskLevel",
        "preferenceMetadata",
        "preferenceMatchesQuery",
        "preferenceLimit",
        "preferenceNamesUnderPrefix",
        "preferenceApprovalPrefix",
        "hasPreferencePrefixGrant",
        "grantPreferencePrefix",
        "revokePreferencePrefix",
        "toolBrowsePreferences",
        "toolSearchPreferences",
        "toolReadPreferences",
        "toolListPreferencePanes",
        "toolOpenZoteroPreferences",
        "toolSetPreference",
        "toolRequestZoteroRestart",
    },
    "assistant-plugin-library.js": {
        "currentTaskLibraryID",
        "getActiveLibraryID",
        "getLibrary",
        "getLibraryName",
        "hasSessionReadGrant",
        "grantSessionRead",
        "revokeSessionRead",
        "markAllIndexesDirty",
        "markLibraryIndexDirty",
        "normalizeWebUrl",
        "hostnameMatchesDomain",
        "filterWebSearchResults",
        "resolveWebSearchProvider",
        "fetchWithTimeout",
        "readResponseTextLimited",
        "htmlToMarkdownLite",
        "toolLiveSearch",
        "toolWebFetch",
        "readCurrentContext",
        "currentReaderHint",
        "getActiveReaderState",
        "readerForTab",
        "resolveMaybePromise",
        "selectedZoteroTabID",
        "readerAttachmentItem",
        "readerObjectCandidates",
        "readerWindowCandidates",
        "readerPDFApplication",
        "readerPageInfo",
        "readerPageLabel",
        "firstInteger",
        "readerPageTextMethodAvailable",
        "readReaderPageText",
        "textFromPDFTextContent",
        "annotationPageIndex",
        "annotationPageLabel",
        "parseAnnotationPosition",
        "annotationMatchesPage",
        "annotationSummary",
        "readerDebugSnapshot",
        "toolReadCurrentReaderPages",
        "itemSummary",
        "creatorTypeName",
        "creatorSnapshot",
        "itemFieldDescriptors",
        "itemMetadataSnapshot",
        "collectionSummary",
        "toolSearchItems",
        "toolReadItemFields",
        "toolExpandedContext",
        "toolReadLibraryOverview",
        "toolBrowseLibraryItems",
        "toolReadFulltextPage",
        "ensureLibraryIndex",
        "buildLibraryIndex",
        "filterLibraryItems",
        "findTopLevelSummary",
        "getLibraryOverviewPayload",
        "isNoteItem",
        "isAnnotationItem",
        "notePreview",
        "annotationPreview",
        "getFulltextAPI",
        "pathExists",
        "readAttachmentTextFromPath",
        "readFulltextFromModernAPI",
        "readFulltextText",
        "resolveFulltextTarget",
        "resolveOwningItem",
        "isSupportedParentItemType",
        "normalizeCreators",
        "currentCreatorsSnapshot",
        "itemTagNames",
        "itemCollectionIDs",
        "defaultParentTitleForAttachment",
        "addItemToCollectionIDs",
        "toolCreateCollection",
        "toolAddItemsToCollection",
        "toolAddTags",
        "toolCreateNote",
        "toolCreateParentItem",
        "toolUpdateMetadata",
        "toolListPluginCommands",
        "toolMoveToTrash",
        "toolTriggerPluginCommand",
        "toolFinishTask",
        "toolRequestClarification",
        "annotationItemsForAttachment",
        "getItemByKey",
        "getCollectionByKey",
        "executeTool",
        "isWriteTool",
    },
    "assistant-plugin-core.js": {
        "startup",
        "shutdown",
        "ensurePrefs",
        "setDefault",
        "registerPreferencePane",
        "unregisterPreferencePane",
        "registerNotifier",
        "unregisterNotifier",
        "getMainWindows",
        "addToWindow",
        "removeFromWindow",
        "repairOrphanRunningTask",
        "renderAll",
        "render",
        "firstState",
        "firstWindow",
        "log",
        "pruneLog",
        "persistLog",
        "readJSONPref",
        "writeJSONPref",
        "clearCurrentTask",
        "undoLast",
    },
}

METHOD_HEADER = re.compile(r"^    (async )?([a-zA-Z_][a-zA-Z0-9_]*)\(")

ENSURE_GLOBAL_STYLES_METHOD = """ensureGlobalStyles(doc) {
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
}"""


def find_class_body_lines(lines: list[str]) -> tuple[int, int]:
    start = None
    for i, line in enumerate(lines):
        if line.strip() == "class AssistantPlugin {":
            start = i
            break
    if start is None:
        raise RuntimeError("AssistantPlugin class not found")
    depth = 0
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return start, i
    raise RuntimeError("Unclosed AssistantPlugin class")


def extract_methods(class_lines: list[str]) -> dict[str, str]:
    """Map method name -> source text (4-space indented methods)."""
    methods: dict[str, str] = {}
    i = 0
    n = len(class_lines)
    while i < n:
        m = METHOD_HEADER.match(class_lines[i])
        if not m:
            i += 1
            continue
        name = m.group(2)
        start = i
        depth = 0
        started = False
        j = i
        while j < n:
            line = class_lines[j]
            for ch in line:
                if ch == "{":
                    depth += 1
                    started = True
                elif ch == "}":
                    depth -= 1
            if started and depth == 0:
                chunk = "".join(class_lines[start : j + 1])
                methods[name] = chunk
                i = j + 1
                break
            j += 1
        else:
            raise RuntimeError(f"Unclosed method {name} at line {start}")
    return methods


def method_to_mixin_property(chunk: str) -> str:
    """Convert class method indentation to object literal property (2 spaces)."""
    out = []
    for line in chunk.splitlines(keepends=True):
        if line.startswith("    "):
            out.append(line[2:])
        else:
            out.append(line)
    text = "".join(out)
    # async foo(...) { -> async foo(...) {
    return text.rstrip() + ",\n\n"


def build_reverse_map() -> dict[str, str]:
    rev: dict[str, str] = {}
    for fname, names in MODULE_METHODS.items():
        for name in names:
            if name in rev and rev[name] != fname:
                raise RuntimeError(f"Duplicate assignment for {name}: {rev[name]} vs {fname}")
            rev[name] = fname
    return rev


def main() -> None:
    text = MAIN.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    class_start, class_end = find_class_body_lines(lines)
    class_lines = lines[class_start + 1 : class_end]
    methods = extract_methods(class_lines)
    rev = build_reverse_map()

    assigned = set()
    for fname, names in MODULE_METHODS.items():
        assigned |= names

    unassigned = set(methods.keys()) - assigned - CLASS_ONLY
    if unassigned:
        raise RuntimeError(f"Methods not assigned to any mixin: {sorted(unassigned)}")

    missing = assigned - set(methods.keys()) - CLASS_ONLY
    if missing:
        raise RuntimeError(f"Mixin lists unknown methods: {sorted(missing)}")

    var_names = {}
    for fname in MODULE_METHODS:
        base = fname.replace(".js", "").replace("-", "_")
        parts = base.split("_")
        var_names[fname] = "ZoteroAssistant" + "".join(p.capitalize() for p in parts[2:])  # PluginModel

    # Fix var naming: assistant-plugin-model.js -> ZoteroAssistantPluginModel
    for fname in MODULE_METHODS:
        slug = fname.replace("assistant-plugin-", "").replace(".js", "")
        camel = "".join(w.capitalize() for w in slug.split("-"))
        var_names[fname] = f"ZoteroAssistantPlugin{camel}"

    for fname, names in MODULE_METHODS.items():
        var = var_names[fname]
        props = []
        for name in sorted(names, key=lambda x: methods[x].find("(")):
            props.append(method_to_mixin_property(methods[name]))
        extra = ""
        if fname == "assistant-plugin-ui-dom.js":
            extra = ",\n\n" + ENSURE_GLOBAL_STYLES_METHOD
        body = f"var {var} = {{\n" + "".join(props).rstrip().rstrip(",") + extra + "\n};\n"
        (CONTENT / fname).write_text(body, encoding="utf-8")

    # Rebuild main class with only constructor + Object.assign block
    constructor = methods["constructor"]
    preamble = "".join(lines[: class_start + 1])
    # Everything before class through "class AssistantPlugin {"
    postamble_start = None
    for i in range(class_end, len(lines)):
        if lines[i].strip().startswith("function create"):
            postamble_start = i
            break
    if postamble_start is None:
        raise RuntimeError("function create not found")
    postamble = "".join(lines[postamble_start:])

    mixin_vars = [var_names[f] for f in sorted(MODULE_METHODS.keys())]
    assign_lines = "  Object.assign(AssistantPlugin.prototype,\n"
    for i, var in enumerate(mixin_vars):
        sep = "," if i < len(mixin_vars) - 1 else ""
        assign_lines += f"    {var}{sep}\n"
    assign_lines += "  );\n\n"

    import subprocess
    import sys

    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "wrap_assistant_mixins.py")],
        check=True,
    )

    print("Mixin files:")
    for fname in sorted(MODULE_METHODS.keys()):
        p = CONTENT / fname
        n = len(p.read_text(encoding="utf-8").splitlines())
        print(f"  {fname}: {n} lines, {len(MODULE_METHODS[fname])} methods")
    main_lines = len((CONTENT / "zotero-assistant.js").read_text(encoding="utf-8").splitlines())
    print(f"Main zotero-assistant.js: {main_lines} lines")
    print("Vars:", ", ".join(mixin_vars))


if __name__ == "__main__":
    main()