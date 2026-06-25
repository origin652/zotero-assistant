var ZoteroAssistantPluginChat = (() => {
  const {
    HTML_NS,
    PREF_PREFIX,
    PREFS,
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_API_MODE,
    DEFAULT_SAFETY_MODE,
    DEFAULT_SELECTION_ASK_SHORTCUT,
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
    CHAT_DRAWER_WIDTH,
    CHAT_DRAWER_LOG_PREVIEW,
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
    SELECTION_ASK_MAX_CHARS,
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
  const {
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

  return {
  hideChatPanel(state) {
    if (!state || !state.chatPanel) {
      return;
    }
    state.chatOpen = false;
    state.chatPanel.style.setProperty("display", "none", "important");
    if (state.chatDrawerOpen && state.chatDrawerNode) {
      state.chatDrawerOpen = false;
      state.chatDrawerNode.style.setProperty("display", "none", "important");
    }
    if (state.chatLauncher) {
      state.chatLauncher.style.setProperty("display", "flex", "important");
    }
  },

  showChatPanel(state) {
    if (!state || !state.chatPanel) {
      return;
    }
    if (!state.chatBounds) {
      state.chatBounds = this.defaultChatBounds(state);
    }
    state.chatOpen = true;
    state.chatPanel.style.setProperty("display", "flex", "important");
    if (state.chatLauncher) {
      state.chatLauncher.style.setProperty("display", "none", "important");
    }
    if (state.approvalPopup) {
      this.hidePopup(state.approvalPopup);
    }
    this.applyChatBounds(state);
    this.positionChatDrawer(state);
    this.renderChatPanel(state);
    if (state.chatInputNode && !state.chatMinimized) {
      state.chatInputNode.focus();
    }
  },

  toggleChatPanel(state) {
    if (!state || !state.chatPanel) {
      return;
    }
    if (state.chatOpen) {
      this.hideChatPanel(state);
    } else {
      this.showChatPanel(state);
    }
  },

  toggleChatPanelForWindow(win) {
    const state = this.windows.get(win);
    if (state) {
      this.toggleChatPanel(state);
    }
  },

  showChatNotice(state, message) {
    if (!state) {
      return;
    }
    state.chatNotice = String(message || "");
    this.showChatPanel(state);
    this.renderChatPanel(state);
  },

  isChatTaskBusy() {
    return !!(this.task && this.task.status === "running");
  },

  parseArguments(raw) {
    if (!raw) {
      return {};
    }
    if (typeof raw === "object") {
      return raw;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return {};
    }
  },

  installSelectionAskShortcut(state) {
    if (!state || !state.win || state.onSelectionAskKeydown) {
      return;
    }
    state.selectionAskShortcutTargets = [];
    state.onSelectionAskKeydown = (event) => {
      this.handleSelectionAskShortcut(state, event).catch((error) => {
        Zotero.debug(`Zotero Assistant selection ask shortcut failed: ${error}`);
      });
    };
    this.addSelectionAskShortcutTarget(state, state.win);
    this.syncSelectionAskShortcutTargets(state);
    state.selectionAskShortcutTimer = state.win.setInterval(() => {
      this.syncSelectionAskShortcutTargets(state);
    }, 1500);
  },

  uninstallSelectionAskShortcut(state) {
    if (!state) {
      return;
    }
    if (state.selectionAskShortcutTimer && state.win) {
      state.win.clearInterval(state.selectionAskShortcutTimer);
      state.selectionAskShortcutTimer = null;
    }
    const targets = Array.isArray(state.selectionAskShortcutTargets) ? state.selectionAskShortcutTargets : [];
    for (const targetWin of targets) {
      try {
        targetWin.removeEventListener("keydown", state.onSelectionAskKeydown, true);
      } catch (error) {
        // Ignore stale reader frames during Zotero tab teardown.
      }
    }
    state.selectionAskShortcutTargets = [];
    state.onSelectionAskKeydown = null;
    state.pendingSelectionAskDraft = null;
    state.activeSelectionAskDraftMeta = null;
  },

  addSelectionAskShortcutTarget(state, targetWin) {
    if (!state || !state.onSelectionAskKeydown || !targetWin || targetWin.closed) {
      return;
    }
    if (!Array.isArray(state.selectionAskShortcutTargets)) {
      state.selectionAskShortcutTargets = [];
    }
    if (state.selectionAskShortcutTargets.includes(targetWin)) {
      return;
    }
    try {
      targetWin.addEventListener("keydown", state.onSelectionAskKeydown, true);
      state.selectionAskShortcutTargets.push(targetWin);
    } catch (error) {
      // Some Zotero internal frames may not allow listeners; skip them.
    }
  },

  async syncSelectionAskShortcutTargets(state) {
    if (!state || !state.win || !state.onSelectionAskKeydown || state.selectionAskShortcutSyncing) {
      return;
    }
    state.selectionAskShortcutSyncing = true;
    try {
      const candidates = [];
      this.collectFrameWindows(state.win, candidates, new Set());
      try {
        const tabID = this.selectedZoteroTabID(state.win);
        const reader = await this.readerForTab(state.win, tabID);
        if (reader) {
          for (const readerWin of this.readerWindowCandidates(reader)) {
            this.collectFrameWindows(readerWin, candidates, new Set());
          }
        }
      } catch (error) {
        // Reader probing is best effort; shortcut still works in the main window.
      }
      for (const candidate of candidates) {
        this.addSelectionAskShortcutTarget(state, candidate);
      }
      state.selectionAskShortcutTargets = (state.selectionAskShortcutTargets || []).filter((targetWin) => {
        try {
          return !!targetWin && !targetWin.closed;
        } catch (error) {
          return false;
        }
      });
    } finally {
      state.selectionAskShortcutSyncing = false;
    }
  },

  collectFrameWindows(rootWin, output, seen) {
    if (!rootWin || seen.has(rootWin)) {
      return;
    }
    seen.add(rootWin);
    output.push(rootWin);
    let frames = [];
    try {
      frames = Array.from(rootWin.frames || []);
    } catch (error) {
      frames = [];
    }
    for (const frameWin of frames) {
      this.collectFrameWindows(frameWin, output, seen);
    }
  },

  selectionAskShortcutString() {
    return String(Zotero.Prefs.get(PREFS.selectionAskShortcut, true) || DEFAULT_SELECTION_ASK_SHORTCUT).trim();
  },

  parseSelectionAskShortcut(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return null;
    }
    const parts = raw.split("+").map((part) => part.trim()).filter(Boolean);
    const shortcut = { ctrl: false, alt: false, shift: false, meta: false, key: "" };
    for (const part of parts) {
      const token = part.toLowerCase();
      if (token === "ctrl" || token === "control") {
        shortcut.ctrl = true;
      } else if (token === "alt" || token === "option") {
        shortcut.alt = true;
      } else if (token === "shift") {
        shortcut.shift = true;
      } else if (token === "meta" || token === "cmd" || token === "command") {
        shortcut.meta = true;
      } else {
        shortcut.key = this.normalizeShortcutKey(part);
      }
    }
    return shortcut.key ? shortcut : null;
  },

  normalizeShortcutKey(value) {
    const key = String(value || "").trim();
    if (!key) {
      return "";
    }
    if (key.length === 1) {
      return key.toUpperCase();
    }
    const lower = key.toLowerCase();
    if (lower === "space" || lower === "spacebar") {
      return " ";
    }
    return lower;
  },

  selectionAskShortcutMatchesEvent(event) {
    const shortcut = this.parseSelectionAskShortcut(this.selectionAskShortcutString());
    if (!shortcut) {
      return false;
    }
    const eventKey = this.normalizeShortcutKey(event.key || "");
    return eventKey === shortcut.key &&
      !!event.ctrlKey === shortcut.ctrl &&
      !!event.altKey === shortcut.alt &&
      !!event.shiftKey === shortcut.shift &&
      !!event.metaKey === shortcut.meta;
  },

  async handleSelectionAskShortcut(state, event) {
    if (!state || !event || event.defaultPrevented || event.repeat) {
      return;
    }
    if (!this.selectionAskShortcutMatchesEvent(event)) {
      return;
    }
    if (this.selectionAskEventExcluded(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    await this.syncSelectionAskShortcutTargets(state);

    const snapshot = await this.readSelectionAskSnapshot(state, event);
    if (!snapshot.ok) {
      state.pendingSelectionAskDraft = null;
      this.log("selection.ask.no_selection", { reason: snapshot.error || "no_selection" });
      state.chatMinimized = false;
      this.showChatNotice(state, this.t("noVisibleSelection"));
      return;
    }
    const draft = await this.buildSelectionAskDraft(state, snapshot);
    state.chatMinimized = false;
    this.prepareSelectionAskDraft(state, draft);
  },

  selectionAskEventExcluded(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const nodes = path.length ? path : [event.target];
    return nodes.some((node) => this.nodeIsEditableForSelectionAsk(node) || this.nodeWithinAssistantUI(node));
  },

  nodeElementForSelectionAsk(node) {
    if (!node) {
      return null;
    }
    if (node.nodeType === 1) {
      return node;
    }
    return node.parentElement || node.parentNode || null;
  },

  nodeIsEditableForSelectionAsk(node) {
    const element = this.nodeElementForSelectionAsk(node);
    if (!element) {
      return false;
    }
    const tag = String(element.localName || element.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      return true;
    }
    if (element.isContentEditable) {
      return true;
    }
    return !!(typeof element.closest === "function" && element.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
  },

  nodeWithinAssistantUI(node) {
    const element = this.nodeElementForSelectionAsk(node);
    return !!(element && typeof element.closest === "function" && element.closest("#zotero-assistant-ui-root, #zotero-assistant-sidebar"));
  },

  normalizeSelectionAskText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  },

  selectionSnapshotFromWindow(targetWin) {
    if (!targetWin || targetWin.closed) {
      return null;
    }
    let selection = null;
    try {
      selection = targetWin.getSelection && targetWin.getSelection();
    } catch (error) {
      return null;
    }
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      return null;
    }
    if (this.selectionTouchesExcludedNode(selection)) {
      return null;
    }
    const text = this.normalizeSelectionAskText(selection.toString());
    if (!text) {
      return null;
    }
    return {
      ok: true,
      text,
      win: targetWin,
      doc: targetWin.document || null,
      selection
    };
  },

  selectionTouchesExcludedNode(selection) {
    const nodes = [selection.anchorNode, selection.focusNode];
    try {
      for (let index = 0; index < selection.rangeCount; index++) {
        nodes.push(selection.getRangeAt(index).commonAncestorContainer);
      }
    } catch (error) {
      // Ignore partially detached ranges.
    }
    return nodes.some((node) => this.nodeIsEditableForSelectionAsk(node) || this.nodeWithinAssistantUI(node));
  },

  async readSelectionAskSnapshot(state, event) {
    const candidates = [];
    if (event && event.view) {
      candidates.push(event.view);
    }
    const targetDoc = event && event.target && event.target.ownerDocument;
    if (targetDoc && targetDoc.defaultView) {
      candidates.push(targetDoc.defaultView);
    }
    candidates.push(state.win);
    for (const targetWin of state.selectionAskShortcutTargets || []) {
      candidates.push(targetWin);
    }
    const unique = Array.from(new Set(candidates.filter(Boolean)));
    for (const targetWin of unique) {
      const snapshot = this.selectionSnapshotFromWindow(targetWin);
      if (snapshot) {
        snapshot.source = await this.describeSelectionAskSource(state, snapshot);
        return snapshot;
      }
    }
    return { ok: false, error: this.t("unreadableSelection") };
  },

  async describeSelectionAskSource(state, snapshot) {
    const fallback = {
      type: "zotero_window",
      label: this.t("selectionLabel"),
      lines: [this.t("sourceZoteroWindow")]
    };
    try {
      const tabID = this.selectedZoteroTabID(state.win);
      const reader = await this.readerForTab(state.win, tabID);
      if (reader) {
        const readerWindows = this.readerWindowCandidates(reader);
        const isReaderWindow = readerWindows.some((readerWin) => readerWin === snapshot.win || readerWin.document === snapshot.doc);
        if (isReaderWindow) {
          const attachment = this.readerAttachmentItem(reader);
          const owner = attachment ? this.resolveOwningItem(attachment) : null;
          const pdfApp = this.readerPDFApplication(reader);
          const pageInfo = this.readerPageInfo(reader, pdfApp);
          const title = owner
            ? safeCall(() => owner.getField("title")) || safeCall(() => owner.getDisplayTitle())
            : attachment
              ? safeCall(() => attachment.getField("title")) || safeCall(() => attachment.getDisplayTitle())
              : "";
          const pageLabel = Number.isInteger(pageInfo.pageIndex) ? this.readerPageLabel(pdfApp, pageInfo.pageIndex) : "";
          const pageText = pageLabel || (pageInfo.pageNumber ? String(pageInfo.pageNumber) : "");
          const lines = [
            this.t("sourceZoteroReader", { title: title ? ` - ${title}` : "" }),
            attachment && attachment.key ? this.t("attachmentKey", { key: attachment.key }) : "",
            pageText ? this.t("currentPage", { page: pageText }) : ""
          ].filter(Boolean);
          return {
            type: "reader",
            label: lines[0],
            lines,
            libraryID: attachment && attachment.libraryID ? attachment.libraryID : "",
            libraryName: attachment && attachment.libraryID ? this.getLibraryName(attachment.libraryID) : "",
            itemKey: owner && owner.key ? owner.key : "",
            attachmentKey: attachment && attachment.key ? attachment.key : "",
            pageLabel: pageText
          };
        }
      }
    } catch (error) {
      // Fall back to generic Zotero-window metadata.
    }
    const title = snapshot.doc && snapshot.doc.title ? String(snapshot.doc.title).trim() : "";
    if (title) {
      return {
        type: "zotero_window",
        label: `${this.t("selectionLabel")} - ${title}`,
        lines: [this.t("sourceZoteroWindowTitle", { title })]
      };
    }
    return fallback;
  },

  quoteSelectionAskText(text) {
    return String(text || "")
      .split(/\n/)
      .map((line) => `> ${line}`)
      .join("\n");
  },

  async buildSelectionAskDraft(state, snapshot) {
    const original = snapshot.text || "";
    const clipped = original.length > SELECTION_ASK_MAX_CHARS
      ? original.slice(0, SELECTION_ASK_MAX_CHARS)
      : original;
    const truncated = clipped.length < original.length;
    const source = snapshot.source || {
      type: "zotero_window",
      label: this.t("selectionLabel"),
      lines: [this.t("sourceZoteroWindow")]
    };
    const lines = [
      this.t("answerBasedOnText"),
      "",
      ...source.lines,
      "",
      this.quoteSelectionAskText(clipped),
      "",
      this.t("myQuestion")
    ];
    return {
      text: lines.join("\n"),
      meta: {
        sourceType: source.type || "zotero_window",
        sourceLabel: source.label || this.t("selectionLabel"),
        libraryID: source.libraryID || "",
        libraryName: source.libraryName || "",
        itemKey: source.itemKey || "",
        attachmentKey: source.attachmentKey || "",
        pageLabel: source.pageLabel || "",
        originalChars: original.length,
        includedChars: clipped.length,
        truncated,
        createdAt: new Date().toISOString()
      }
    };
  },

  prepareSelectionAskDraft(state, draft) {
    if (!state || !state.chatInputNode || !draft || !draft.text) {
      return;
    }
    state.chatMinimized = false;
    this.showChatPanel(state);
    const existing = String(state.chatInputNode.value || "").trim();
    const busy = this.isChatTaskBusy();
    if (existing) {
      state.pendingSelectionAskDraft = draft;
      state.chatNotice = busy
        ? this.t("draftExistingBusy")
        : this.t("draftExisting");
      this.renderChatPanel(state);
      return;
    }
    this.applySelectionAskDraftToInput(state, draft, "replace");
    const baseNotice = draft.meta.truncated
      ? this.t("selectionFilledTruncated", { originalChars: draft.meta.originalChars, includedChars: draft.meta.includedChars })
      : this.t("selectionFilled");
    state.chatNotice = busy
      ? `${baseNotice} ${this.t("currentTaskRunningWait")}`
      : baseNotice;
    this.log("selection.ask.prepared", this.selectionAskLogPayload(draft.meta, { hadExistingDraft: false }));
    this.renderChatPanel(state);
  },

  applySelectionAskDraftToInput(state, draft, mode) {
    if (!state || !state.chatInputNode || !draft || !draft.text) {
      return;
    }
    const input = state.chatInputNode;
    if (mode === "append" && input.value) {
      const insert = `\n\n${draft.text}`;
      if (typeof input.selectionStart === "number" && typeof input.selectionEnd === "number") {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.slice(0, start) + insert + input.value.slice(end);
        const cursor = start + insert.length;
        input.selectionStart = cursor;
        input.selectionEnd = cursor;
      } else {
        input.value = `${input.value}\n\n${draft.text}`;
      }
    } else {
      input.value = draft.text;
      const cursor = input.value.length;
      if (typeof input.selectionStart === "number") {
        input.selectionStart = cursor;
        input.selectionEnd = cursor;
      }
    }
    state.activeSelectionAskDraftMeta = draft.meta;
    state.pendingSelectionAskDraft = null;
    input.focus();
  },

  selectionAskLogPayload(meta, extra = {}) {
    const data = Object.assign({
      sourceType: meta && meta.sourceType || "",
      sourceLabel: meta && meta.sourceLabel || "",
      libraryID: meta && meta.libraryID || "",
      libraryName: meta && meta.libraryName || "",
      itemKey: meta && meta.itemKey || "",
      attachmentKey: meta && meta.attachmentKey || "",
      pageLabel: meta && meta.pageLabel || "",
      originalChars: meta && meta.originalChars || 0,
      includedChars: meta && meta.includedChars || 0,
      truncated: !!(meta && meta.truncated)
    }, extra);
    return data;
  },

  selectionAskLibraryID(meta) {
    const raw = meta && meta.libraryID;
    if (!raw) {
      return null;
    }
    const numeric = Number(raw);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  },

  taskLibraryFromSelectionOrActive(state, selectionAskMeta) {
    const selectionLibraryID = this.selectionAskLibraryID(selectionAskMeta);
    const libraryID = selectionLibraryID || this.getActiveLibraryID(state.win);
    const libraryName = selectionLibraryID && selectionAskMeta && selectionAskMeta.libraryName
      ? selectionAskMeta.libraryName
      : this.getLibraryName(libraryID);
    return {
      libraryID,
      libraryName,
      source: selectionLibraryID ? "selection" : "active"
    };
  },

  consumeSelectionAskMetaForText(state, text) {
    if (!state || !state.activeSelectionAskDraftMeta) {
      return null;
    }
    const meta = state.activeSelectionAskDraftMeta;
    state.activeSelectionAskDraftMeta = null;
    const content = String(text || "");
    const markers = [
      this.t("answerBasedOnText"),
      "基于这段文字回答：",
      "Answer based on this text:"
    ];
    return markers.some((marker) => marker && content.includes(marker)) ? meta : null;
  },

  clampChatBounds(state, bounds) {
    const win = state.win;
    const viewportWidth = Math.max(320, Number(win.innerWidth || state.doc.documentElement.clientWidth || 1024));
    const viewportHeight = Math.max(320, Number(win.innerHeight || state.doc.documentElement.clientHeight || 768));
    const maxW = Math.max(CHAT_MIN_WIDTH, viewportWidth - 32);
    const maxH = Math.max(CHAT_MIN_HEIGHT, viewportHeight - 32);
    const width = Math.min(Math.max(Number(bounds.width || CHAT_DEFAULT_WIDTH), CHAT_MIN_WIDTH), maxW);
    const height = Math.min(Math.max(Number(bounds.height || CHAT_DEFAULT_HEIGHT), CHAT_MIN_HEIGHT), maxH);
    const minTopRoom = state.chatMinimized ? CHAT_MINIMIZED_HEIGHT : height;
    return {
      left: Math.max(16, Math.min(Number(bounds.left || 16), viewportWidth - width - 16)),
      top: Math.max(16, Math.min(Number(bounds.top || 16), viewportHeight - minTopRoom - 16)),
      width,
      height
    };
  },

  createChatPanel(win, state) {
    const doc = win.document;
    const panel = this.html(doc, "div");
    panel.id = "zotero-assistant-chat-panel";
    panel.style.cssText = [
      "display:none",
      "position:absolute",
      "margin:0",
      "padding:0",
      "box-sizing:border-box",
      "flex-direction:column",
      "pointer-events:auto",
      "z-index:5",
      "min-width:0",
      "min-height:0",
      "background:#ffffff",
      "border:1px solid #d8dde6",
      "border-radius:12px",
      "box-shadow:0 12px 40px rgba(15,23,42,0.16)",
      "overflow:hidden",
      "position:absolute"
    ].join(";");
    panel.style.setProperty("display", "none", "important");
    panel.style.setProperty("position", "absolute", "important");

    const header = this.el(doc, "div", "za-floating-chat-header", "");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid #e2e5ea;background:#f0f2f5;flex:0 0 auto;cursor:move;";
    const titleWrap = this.el(doc, "div", "za-floating-chat-title-wrap", "");
    titleWrap.appendChild(this.el(doc, "div", "za-floating-chat-title", "Zotero 助手"));
    titleWrap.appendChild(this.el(doc, "div", "za-floating-chat-subtitle", "聊天式任务入口"));
    const actions = this.el(doc, "div", "za-floating-chat-actions", "");
    actions.appendChild(this.actionButton(doc, "设置", "ghost", () => this.openPreferencesPane()));
    const manage = this.actionButton(doc, "管理", "ghost", () => this.toggleChatDrawer(state));
    manage.setAttribute("data-za-chat-drawer-toggle", "1");
    actions.appendChild(manage);
    const minimize = this.actionButton(doc, "最小化", "ghost", () => this.toggleMinimizeChatPanel(state));
    minimize.setAttribute("data-za-chat-minimize", "1");
    actions.appendChild(minimize);
    actions.appendChild(this.actionButton(doc, "关闭", "ghost", () => this.hideChatPanel(state)));
    header.appendChild(titleWrap);
    header.appendChild(actions);
    this.attachChatDragHandlers(state, header);

    const drawer = this.createChatDrawer(win, state);
    state.chatDrawerNode = drawer;
    state.chatDrawerOpen = false;

    const messages = this.el(doc, "div", "za-floating-chat-messages", "");
    messages.style.cssText = "flex:1 1 auto;min-height:0;padding:14px 12px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:14px;background:#e9ebef;";
    const approval = this.el(doc, "div", "za-floating-chat-approval", "");
    const footer = this.el(doc, "div", "za-floating-chat-footer", "");
    footer.style.cssText = "flex:0 0 auto;display:flex;gap:8px;align-items:flex-end;padding:10px 12px 12px;border-top:1px solid #e2e5ea;background:#ffffff;";
    const input = this.html(doc, "textarea");
    input.placeholder = this.t("chatPlaceholder");
    input.rows = 2;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.sendChatInput(state);
      }
    });
    const send = this.actionButton(doc, "发送", "primary", () => this.sendChatInput(state));
    footer.appendChild(input);
    footer.appendChild(send);

    const resizeHandle = this.el(doc, "div", "za-chat-resize-handle", "");
    resizeHandle.setAttribute("aria-label", this.t("chatResizeLabel"));
    resizeHandle.title = this.t("chatResizeTitle");
    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(approval);
    panel.appendChild(footer);
    panel.appendChild(resizeHandle);
    this.attachChatResizeHandlers(state, resizeHandle);
    const overlay = this.ensureUiOverlayRoot(state);
    overlay.appendChild(panel);
    overlay.appendChild(drawer);

    state.chatHeaderNode = header;
    state.chatMessagesNode = messages;
    state.chatApprovalNode = approval;
    state.chatInputNode = input;
    state.chatFooterNode = footer;
    state.chatSendButton = send;
    return panel;
  },

  createChatDrawer(win, state) {
    const doc = win.document;
    const drawer = this.el(doc, "div", "za-chat-drawer", "");
    drawer.style.cssText = [
      "display:none",
      "position:absolute",
      "box-sizing:border-box",
      "flex-direction:column",
      "pointer-events:auto",
      "z-index:6",
      "min-width:0",
      "min-height:0",
      "background:#ffffff",
      "border:1px solid #d8dde6",
      "border-radius:12px",
      "box-shadow:0 12px 40px rgba(15,23,42,0.16)",
      "overflow:hidden"
    ].join(";");
    drawer.style.setProperty("display", "none", "important");
    drawer.style.setProperty("position", "absolute", "important");

    const header = this.el(doc, "div", "za-chat-drawer-header", "");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid #e2e5ea;background:#f0f2f5;flex:0 0 auto;cursor:move;";
    header.appendChild(this.el(doc, "div", "za-chat-drawer-title", "管理"));
    header.appendChild(this.actionButton(doc, "收起", "ghost", () => this.toggleChatDrawer(state)));
    this.attachChatDrawerDragHandlers(state, header);
    drawer.appendChild(header);
    state.chatDrawerHeaderNode = header;

    const body = this.el(doc, "div", "za-chat-drawer-body", "");
    body.style.cssText = "flex:1 1 auto;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:14px;";
    const statusSection = this.el(doc, "div", "za-chat-drawer-section", "");
    statusSection.appendChild(this.el(doc, "div", "za-chat-drawer-section-title", "任务状态"));
    const statusBody = this.el(doc, "div", "za-chat-drawer-section-body", "");
    statusSection.appendChild(statusBody);
    body.appendChild(statusSection);

    const logSection = this.el(doc, "div", "za-chat-drawer-section", "");
    logSection.appendChild(this.el(doc, "div", "za-chat-drawer-section-title", "执行日志"));
    const logBody = this.el(doc, "div", "za-chat-drawer-section-body", "");
    logSection.appendChild(logBody);
    body.appendChild(logSection);

    const grantDetails = this.html(doc, "details");
    grantDetails.className = "za-chat-drawer-grant";
    const grantSummary = this.html(doc, "summary");
    grantSummary.textContent = this.uiText("授权与会话");
    grantDetails.appendChild(grantSummary);
    const grantBody = this.el(doc, "div", "za-chat-drawer-section-body", "");
    grantDetails.appendChild(grantBody);
    body.appendChild(grantDetails);

    drawer.appendChild(body);

    state.chatDrawerStatusBody = statusBody;
    state.chatDrawerLogBody = logBody;
    state.chatDrawerGrantBody = grantBody;
    state.chatDrawerLogExpanded = false;
    return drawer;
  },

  chatDrawerHeightForState(state) {
    const chat = state.chatBounds || this.defaultChatBounds(state);
    return state.chatMinimized ? CHAT_MINIMIZED_HEIGHT : chat.height;
  },

  chatDrawerBoundsBesideChat(state) {
    const chat = state.chatBounds || this.defaultChatBounds(state);
    return {
      left: chat.left + chat.width + 8,
      top: chat.top,
      width: CHAT_DRAWER_WIDTH,
      height: this.chatDrawerHeightForState(state)
    };
  },

  clampChatDrawerBounds(state, bounds) {
    const win = state.win;
    const viewportWidth = Math.max(320, Number(win.innerWidth || state.doc.documentElement.clientWidth || 1024));
    const viewportHeight = Math.max(320, Number(win.innerHeight || state.doc.documentElement.clientHeight || 768));
    const width = CHAT_DRAWER_WIDTH;
    const maxH = Math.max(CHAT_MIN_HEIGHT, viewportHeight - 32);
    const height = Math.min(
      Math.max(Number(bounds.height || this.chatDrawerHeightForState(state)), CHAT_MIN_HEIGHT),
      maxH
    );
    return {
      left: Math.max(16, Math.min(Number(bounds.left || 16), viewportWidth - width - 16)),
      top: Math.max(16, Math.min(Number(bounds.top || 16), viewportHeight - height - 16)),
      width,
      height
    };
  },

  applyChatDrawerBounds(state) {
    if (!state.chatDrawerNode || !state.chatDrawerOpen) {
      return;
    }
    let bounds;
    if (state.chatDrawerFollowChat !== false) {
      bounds = this.clampChatDrawerBounds(state, this.chatDrawerBoundsBesideChat(state));
    } else {
      bounds = this.clampChatDrawerBounds(state, state.chatDrawerBounds || this.chatDrawerBoundsBesideChat(state));
      bounds.height = this.chatDrawerHeightForState(state);
      bounds = this.clampChatDrawerBounds(state, bounds);
    }
    state.chatDrawerBounds = bounds;
    const drawer = state.chatDrawerNode;
    drawer.style.left = `${Math.round(bounds.left)}px`;
    drawer.style.top = `${Math.round(bounds.top)}px`;
    drawer.style.width = `${Math.round(bounds.width)}px`;
    drawer.style.height = `${Math.round(bounds.height)}px`;
  },

  positionChatDrawer(state) {
    if (!state.chatDrawerNode || !state.chatPanel || !state.chatOpen || !state.chatDrawerOpen) {
      return;
    }
    this.applyChatDrawerBounds(state);
  },

  toggleChatDrawer(state) {
    if (!state || !state.chatDrawerNode) {
      return;
    }
    state.chatDrawerOpen = !state.chatDrawerOpen;
    if (state.chatDrawerOpen) {
      if (!state.chatBounds) {
        state.chatBounds = this.defaultChatBounds(state);
      }
      if (state.chatDrawerBounds == null) {
        state.chatDrawerFollowChat = true;
      }
      state.chatDrawerNode.style.setProperty("display", "flex", "important");
      this.positionChatDrawer(state);
    } else {
      state.chatDrawerNode.style.setProperty("display", "none", "important");
    }
    this.renderChatDrawer(state);
  },

  renderChatDrawer(state) {
    if (!state || !state.chatDrawerNode) {
      return;
    }
    if (!state.chatDrawerOpen) {
      return;
    }
    this.drawerStatus(state);
    this.drawerLog(state);
    this.drawerGrant(state);
  },

  drawerStatus(state) {
    const body = state.chatDrawerStatusBody;
    if (!body) {
      return;
    }
    body.textContent = "";
    const doc = state.doc;
    if (!this.task) {
      body.appendChild(this.el(doc, "p", "za-empty", "暂无任务。在下方输入明确任务后开始。"));
      return;
    }
    const row = this.html(doc, "div");
    row.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;";
    row.appendChild(this.el(doc, "span", `za-pill ${this.statusPillClass(this.task.status)}`, this.task.status));
    row.appendChild(this.el(doc, "span", "za-muted", this.t("phase", { phase: this.task.phase })));
    body.appendChild(row);
    if (this.task.error) {
      body.appendChild(this.el(doc, "div", "za-error", this.t("error", { error: this.task.error })));
    }
    if (this.task.libraryName) {
      const lib = this.el(doc, "div", "za-muted", this.t("boundLibrary", { library: this.task.libraryName }));
      lib.style.marginTop = "6px";
      body.appendChild(lib);
    }
    const actions = this.el(doc, "div", "za-btn-row", "");
    if (this.task.canContinueAfterCompressionFailure) {
      actions.appendChild(this.actionButton(doc, "裁剪后继续", "primary", () => this.continueAfterCompressionFailure()));
    }
    actions.appendChild(this.actionButton(doc, "清除任务", "ghost", () => this.clearCurrentTask()));
    const undoButton = this.actionButton(doc, "撤销最近", "secondary", () => this.undoLast());
    undoButton.disabled = this.undoStack.length === 0;
    actions.appendChild(undoButton);
    body.appendChild(actions);
  },

  drawerLog(state) {
    const body = state.chatDrawerLogBody;
    if (!body) {
      return;
    }
    body.textContent = "";
    const doc = state.doc;
    const all = this.eventLog.slice().reverse();
    const previewCount = CHAT_DRAWER_LOG_PREVIEW;
    const showCount = state.chatDrawerLogExpanded ? Math.min(all.length, MAX_CHAT_DISPLAY_LOG) : Math.min(all.length, previewCount);
    const shown = all.slice(0, showCount);
    if (!shown.length) {
      body.appendChild(this.el(doc, "p", "za-empty", "暂无日志。"));
    } else {
      for (const event of shown) {
        const formatted = this.formatLogEvent(event);
        const line = this.el(doc, "div", `za-log-line za-log-tone-${formatted.tone || "neutral"}`, "");
        line.style.cssText = "display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-bottom:1px solid var(--za-border, #e2e5ea);";
        const head = this.el(doc, "div", "", "");
        head.style.cssText = "display:flex;gap:6px;align-items:baseline;";
        head.appendChild(this.el(doc, "span", "za-log-type", formatted.badge || ""));
        head.appendChild(this.el(doc, "span", "", formatted.title || ""));
        line.appendChild(head);
        if (formatted.detail) {
          const detail = this.el(doc, "div", "za-muted", formatted.detail);
          detail.style.cssText = "font-size:11px;";
          line.appendChild(detail);
        }
        body.appendChild(line);
      }
    }
    const row = this.el(doc, "div", "za-btn-row", "");
    row.style.marginTop = "8px";
    if (all.length > previewCount) {
      row.appendChild(this.actionButton(doc, state.chatDrawerLogExpanded ? "收起日志" : "展开全部", "ghost", () => {
        state.chatDrawerLogExpanded = !state.chatDrawerLogExpanded;
        this.drawerLog(state);
      }));
    }
    row.appendChild(this.actionButton(doc, "清除日志", "ghost", () => {
      this.eventLog = [];
      this.persistLog();
      this.renderChatDrawer(state);
    }));
    body.appendChild(row);
  },

  drawerGrant(state) {
    const body = state.chatDrawerGrantBody;
    if (!body) {
      return;
    }
    body.textContent = "";
    const doc = state.doc;
    const activeLibraryID = this.getActiveLibraryID(state.win);
    const activeLibraryName = this.getLibraryName(activeLibraryID);
    const activeGranted = this.hasSessionReadGrant(activeLibraryID);
    body.appendChild(this.el(doc, "div", "", this.t("uiLibrary", { library: activeLibraryName })));
    const grantLine = this.el(
      doc,
      "div",
      activeGranted ? "za-grant-on" : "za-grant-off",
      activeGranted ? this.t("libraryReadOn") : this.t("libraryReadOff")
    );
    grantLine.style.marginTop = "6px";
    body.appendChild(grantLine);
    if (activeGranted) {
      const row = this.el(doc, "div", "za-btn-row", "");
      row.style.marginTop = "6px";
      row.appendChild(this.actionButton(doc, "收回整库读取", "secondary", () => this.revokeSessionRead(activeLibraryID)));
      body.appendChild(row);
    }

    body.appendChild(this.el(doc, "div", "za-muted", "本库会话记忆")).style.marginTop = "10px";
    if (!this.isSessionMemoryEnabled()) {
      const disabled = this.el(doc, "div", "za-grant-off", "会话记忆 · 已在设置中关闭");
      disabled.style.marginTop = "6px";
      body.appendChild(disabled);
    } else {
      const memory = this.getSessionMemory(activeLibraryID);
      if (!memory || !memory.summary) {
        const emptyMemory = this.el(doc, "div", "za-grant-off", "本库暂无会话摘要");
        emptyMemory.style.marginTop = "6px";
        body.appendChild(emptyMemory);
      } else {
        const line = this.el(doc, "div", "za-grant-on", this.t("memoryRecorded", { chars: memory.summary.length, version: memory.version || 1 }));
        line.style.marginTop = "6px";
        body.appendChild(line);
        const memActions = this.el(doc, "div", "za-btn-row", "");
        memActions.style.marginTop = "6px";
        memActions.appendChild(this.actionButton(doc, "复制摘要", "secondary", () => this.copySessionMemoryForLibrary(activeLibraryID)));
        memActions.appendChild(this.actionButton(doc, "清除记忆", "ghost", () => this.clearSessionMemoryForLibrary(activeLibraryID)));
        body.appendChild(memActions);
      }
    }

    body.appendChild(this.el(doc, "div", "za-muted", "设置前缀授权")).style.marginTop = "10px";
    const prefixes = Array.from(this.sessionPreferenceApprovals).sort((a, b) => a.localeCompare(b, this.compareLocale()));
    if (!prefixes.length) {
      const emptyPrefs = this.el(doc, "div", "za-grant-off", "本会话暂无设置写入前缀授权");
      emptyPrefs.style.marginTop = "6px";
      body.appendChild(emptyPrefs);
    }
    for (const prefix of prefixes) {
      const line = this.el(doc, "div", "za-grant-on", prefix);
      line.style.marginTop = "6px";
      line.style.wordBreak = "break-all";
      body.appendChild(line);
      const row = this.el(doc, "div", "za-btn-row", "");
      row.style.marginTop = "6px";
      row.appendChild(this.actionButton(doc, "收回此前缀", "secondary", () => this.revokePreferencePrefix(prefix)));
      body.appendChild(row);
    }
  },

  applyChatBounds(state) {
    if (!state.chatPanel) {
      return;
    }
    const bounds = this.clampChatBounds(state, state.chatBounds || this.defaultChatBounds(state));
    state.chatBounds = bounds;
    state.chatPanel.style.left = `${Math.round(bounds.left)}px`;
    state.chatPanel.style.top = `${Math.round(bounds.top)}px`;
    state.chatPanel.style.width = `${Math.round(bounds.width)}px`;
    state.chatPanel.style.height = state.chatMinimized
      ? `${CHAT_MINIMIZED_HEIGHT}px`
      : `${Math.round(bounds.height)}px`;
    this.positionChatDrawer(state);
  },

  renderChatPanel(state) {
    if (!state.chatPanel || !state.chatMessagesNode) {
      return;
    }
    if (!state.chatOpen) {
      state.chatPanel.style.setProperty("display", "none", "important");
      if (state.chatLauncher) {
        state.chatLauncher.style.setProperty("display", "flex", "important");
      }
      return;
    }
    state.chatPanel.style.setProperty("display", "flex", "important");
    state.chatPanel.style.setProperty("background", "#ffffff", "important");
    state.chatPanel.style.setProperty("opacity", "1", "important");
    if (state.chatMessagesNode) {
      state.chatMessagesNode.style.setProperty("background", "#e9ebef", "important");
      state.chatMessagesNode.style.setProperty("display", state.chatMinimized ? "none" : "flex", "important");
      state.chatMessagesNode.style.setProperty("flex-direction", "column", "important");
    }
    if (state.chatFooterNode) {
      state.chatFooterNode.style.setProperty("background", "#ffffff", "important");
    }
    if (state.chatHeaderNode) {
      state.chatHeaderNode.style.setProperty("background", "#f0f2f5", "important");
    }
    if (state.chatLauncher) {
      state.chatLauncher.style.setProperty("display", "none", "important");
    }
    this.applyChatBounds(state);
    const minimizeButton = state.chatPanel.querySelector("[data-za-chat-minimize]");
    if (minimizeButton) {
      minimizeButton.textContent = state.chatMinimized ? this.uiText("恢复") : this.uiText("最小化");
      minimizeButton.setAttribute("aria-label", state.chatMinimized ? this.uiText("恢复") : this.uiText("最小化"));
    }
    if (state.chatApprovalNode) {
      state.chatApprovalNode.style.setProperty("display", state.chatMinimized ? "none" : "block", "important");
    }
    if (state.chatFooterNode) {
      state.chatFooterNode.style.setProperty("display", state.chatMinimized ? "none" : "flex", "important");
    }
    const resizeEl = state.chatPanel && state.chatPanel.querySelector(".za-chat-resize-handle");
    if (resizeEl) {
      resizeEl.style.setProperty("display", state.chatMinimized ? "none" : "block", "important");
    }
    if (state.chatMinimized) {
      return;
    }
    const body = state.chatMessagesNode;
    body.textContent = "";
    if (state.chatNotice) {
      body.appendChild(this.el(state.doc, "div", "za-chat-notice", state.chatNotice));
    }
    const transcript = this.buildChatTranscript();
    if (!transcript.length) {
      body.appendChild(this.el(state.doc, "div", "za-chat-empty", this.uiText("暂无问答。发送任务后，用户和 AI 的可读消息会显示在这里。")));
    } else {
      for (const entry of transcript) {
        body.appendChild(this.createChatBubbleRow(state.doc, entry));
      }
    }
    if (this.isChatTaskBusy()) {
      body.appendChild(this.createChatTypingRow(state.doc));
    }
    this.renderChatApprovalCard(state);
    body.scrollTop = body.scrollHeight;
  },

  resolveChatState(preferredState) {
    if (preferredState && preferredState.chatPanel) {
      return preferredState;
    }
    return this.firstState();
  },

  defaultChatBounds(state) {
    const width = CHAT_DEFAULT_WIDTH;
    const height = CHAT_DEFAULT_HEIGHT;
    const margin = 24;
    const win = state.win;
    const viewportWidth = Math.max(640, Number(win.innerWidth || state.doc.documentElement.clientWidth || 1024));
    const viewportHeight = Math.max(480, Number(win.innerHeight || state.doc.documentElement.clientHeight || 768));
    const sidebarWidth = this.isSidebarVisible(state) && state.container
      ? Math.max(0, Math.round(state.container.getBoundingClientRect().width || 0) + 18)
      : 0;
    return this.clampChatBounds(state, {
      left: viewportWidth - width - margin - sidebarWidth,
      top: viewportHeight - height - margin,
      width,
      height
    });
  },

  appendChatDisplay(speaker, text, options = {}) {
    const raw = String(text || "").trim();
    const rawReasoning = String(options.reasoning || "").trim();
    if (!raw && !rawReasoning) {
      return;
    }
    const clipped = raw.length > MAX_CHAT_DISPLAY_CHARS
      ? raw.slice(0, MAX_CHAT_DISPLAY_CHARS) + this.t("contentTruncated")
      : raw;
    const clippedReasoning = rawReasoning.length > MAX_CHAT_DISPLAY_CHARS
      ? rawReasoning.slice(0, MAX_CHAT_DISPLAY_CHARS) + this.t("reasoningTruncated")
      : rawReasoning;
    const isUser = speaker === "user";
    this.chatDisplayLog.push({
      speaker: isUser ? "user" : "ai",
      label: options.label || (isUser ? "你" : "AI"),
      text: clipped || (clippedReasoning ? this.t("reasoningOnly") : ""),
      reasoning: clippedReasoning,
      kind: options.kind || (isUser ? "user" : "ai"),
      time: Date.now()
    });
    if (this.chatDisplayLog.length > MAX_CHAT_DISPLAY_LOG) {
      this.chatDisplayLog = this.chatDisplayLog.slice(-MAX_CHAT_DISPLAY_LOG);
    }
  },

  beginChatTurnUser(text) {
    this.flushChatTurnToDisplay();
    const userText = String(text || "").trim();
    if (userText) {
      this.appendChatDisplay("user", userText);
      this.renderChatPanelIfOpen();
    }
    this.chatTurnPending = {
      userText: "",
      aiReadable: [],
      process: []
    };
  },

  createChatLauncher(win, state) {
    const doc = win.document;
    const button = this.html(doc, "button");
    button.id = "zotero-assistant-chat-launcher";
    button.type = "button";
    button.textContent = "AI";
    button.setAttribute("aria-label", this.uiText("打开 Zotero 助手聊天窗"));
    button.style.pointerEvents = "auto";
    button.addEventListener("click", () => this.showChatPanel(state));
    this.ensureUiOverlayRoot(state).appendChild(button);
    return button;
  },

  pushChatTurnProcess(line) {
    const raw = String(line || "").trim();
    if (!raw || !this.chatTurnPending) {
      return;
    }
    this.chatTurnPending.process.push(raw);
  },

  scheduleChatRepaint(state) {
    const win = state && state.win;
    if (!win || typeof win.setTimeout !== "function") {
      this.renderChatPanelIfOpen();
      return;
    }
    win.setTimeout(() => {
      if (state && state.chatOpen) {
        this.renderChatPanel(state);
      }
    }, 0);
  },

  chatBusyStatusLabel() {
    if (!this.task || this.task.status !== "running") {
      return "";
    }
    const phase = this.task.phase || "";
    if (phase === "compressing_context") {
      return this.uiText("正在压缩上下文…");
    }
    if (phase === "injecting_context") {
      return this.uiText("正在读取 Zotero 上下文…");
    }
    if (phase === "understanding" || phase === "continued" || phase === "resumed") {
      return this.uiText("正在思考…");
    }
    if (phase === "calling_model") {
      return this.uiText("正在等待模型回复…");
    }
    return this.uiText("正在处理…");
  },

  createChatTypingRow(doc) {
    const row = this.el(doc, "div", "za-chat-row za-chat-row-ai za-chat-row-typing", "");
    row.style.cssText = "display:flex;flex-direction:row;align-items:flex-start;justify-content:flex-start;gap:8px;width:100%;box-sizing:border-box;";
    const avatar = this.el(doc, "div", "za-chat-avatar za-chat-avatar-ai", "AI");
    avatar.style.cssText = "flex:0 0 36px;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:#4a90d9;color:#fff;";
    const stack = this.el(doc, "div", "za-chat-stack", "");
    stack.style.cssText = "display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0;max-width:calc(100% - 52px);";
    const name = this.el(doc, "div", "za-chat-name", "AI");
    name.style.cssText = "font-size:11px;font-weight:600;color:#8a8f99;line-height:1.2;padding:0 4px;";
    const bubble = this.el(doc, "div", "za-chat-bubble za-chat-bubble-ai za-chat-bubble-typing", "");
    bubble.style.cssText = "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:10px 14px;font-size:13px;line-height:1.5;background:#ffffff;color:#111827;border:1px solid #e2e5ea;box-shadow:0 1px 2px rgba(0,0,0,0.06);";
    const dots = this.el(doc, "div", "za-chat-typing-dots", "");
    dots.style.cssText = "display:inline-flex;align-items:center;gap:5px;";
    for (let i = 0; i < 3; i++) {
      dots.appendChild(this.el(doc, "span", "", ""));
    }
    const hint = this.el(doc, "div", "za-chat-typing-hint", this.chatBusyStatusLabel());
    hint.style.cssText = "font-size:11px;color:#94a3b8;margin-top:6px;line-height:1.3;";
    bubble.appendChild(dots);
    bubble.appendChild(hint);
    stack.appendChild(name);
    stack.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(stack);
    return row;
  },

  createChatBubbleRow(doc, entry) {
    const isUser = entry.speaker === "user";
    const row = this.el(doc, "div", isUser ? "za-chat-row za-chat-row-user" : "za-chat-row za-chat-row-ai", "");
    row.style.cssText = isUser
      ? "display:flex;flex-direction:row;align-items:flex-start;justify-content:flex-end;gap:8px;width:100%;box-sizing:border-box;"
      : "display:flex;flex-direction:row;align-items:flex-start;justify-content:flex-start;gap:8px;width:100%;box-sizing:border-box;";
    const avatar = this.el(doc, "div", isUser ? "za-chat-avatar za-chat-avatar-user" : "za-chat-avatar za-chat-avatar-ai", isUser ? this.uiText("我") : "AI");
    avatar.style.cssText = isUser
      ? "flex:0 0 36px;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:#c45c26;color:#fff;"
      : "flex:0 0 36px;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:#4a90d9;color:#fff;";
    const stack = this.el(doc, "div", "za-chat-stack", "");
    stack.style.cssText = isUser
      ? "display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:0;max-width:calc(100% - 52px);"
      : "display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0;max-width:calc(100% - 52px);";
    const isProcess = entry.kind === "process";
    const name = this.el(doc, "div", "za-chat-name", entry.label || (isUser ? this.uiText("你") : "AI"));
    name.style.cssText = "font-size:11px;font-weight:600;color:#8a8f99;line-height:1.2;padding:0 4px;";
    const bubble = this.el(doc, "div", isUser ? "za-chat-bubble za-chat-bubble-user" : (isProcess ? "za-chat-bubble za-chat-bubble-process" : "za-chat-bubble za-chat-bubble-ai"), "");
    bubble.style.cssText = isUser
      ? "max-width:100%;border-radius:10px;border-bottom-right-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#95ec69;color:#111827;box-shadow:0 1px 2px rgba(0,0,0,0.06);"
      : isProcess
        ? "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:8px 10px;font-size:11px;line-height:1.45;background:#f1f5f9;color:#64748b;border:1px dashed #cbd5e1;box-shadow:none;"
        : "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#ffffff;color:#111827;border:1px solid #e2e5ea;box-shadow:0 1px 2px rgba(0,0,0,0.06);";
    this.fillChatBubbleContent(bubble, entry.text, isUser && !isProcess, {
      reasoning: !isUser && !isProcess ? entry.reasoning : ""
    });
    stack.appendChild(name);
    stack.appendChild(bubble);
    if (isUser) {
      row.appendChild(stack);
      row.appendChild(avatar);
    } else {
      row.appendChild(avatar);
      row.appendChild(stack);
    }
    return row;
  },

  buildChatTranscript() {
    this.backfillChatDisplayFromTask();
    const committed = this.chatDisplayLog.slice(-80).map((entry) => ({
      speaker: entry.speaker,
      label: entry.label,
      text: entry.text,
      reasoning: entry.reasoning || "",
      kind: entry.kind || entry.speaker
    }));
    const pending = this.chatTurnPendingTranscriptEntries();
    if (!committed.length && !pending.length) {
      return [];
    }
    return committed.concat(pending);
  },

  async sendChatInput(state) {
    const chatState = this.resolveChatState(state);
    const text = (chatState && chatState.chatInputNode && chatState.chatInputNode.value || "").trim();
    if (!text) {
      return;
    }
    const selectionAskMeta = this.consumeSelectionAskMetaForText(chatState, text);
    if (chatState.chatInputNode) {
      chatState.chatInputNode.value = "";
    }
    chatState.pendingSelectionAskDraft = null;
    chatState.chatNotice = "";
    this.showChatPanel(chatState);
    try {
      await this.startTaskFromText(chatState, text, { selectionAskMeta });
    } catch (error) {
      Zotero.debug(`Zotero Assistant sendChatInput failed: ${error}`);
    } finally {
      this.flushChatTurnToDisplay();
      this.renderAll();
      this.scheduleChatRepaint(chatState);
    }
  },

  resetChatTurnPending() {
    this.chatTurnPending = { userText: "", aiReadable: [], process: [] };
  },

  normalizeChatReadableEntry(entry) {
    if (entry && typeof entry === "object") {
      return {
        text: String(entry.text || "").trim(),
        reasoning: String(entry.reasoning || "").trim()
      };
    }
    return {
      text: String(entry || "").trim(),
      reasoning: ""
    };
  },

  pushChatTurnReadable(text, options = {}) {
    const raw = String(text || "").trim();
    const reasoning = String(options.reasoning || "").trim();
    if ((!raw && !reasoning) || !this.chatTurnPending) {
      return;
    }
    const last = this.normalizeChatReadableEntry(this.chatTurnPending.aiReadable[this.chatTurnPending.aiReadable.length - 1]);
    if (last.text === raw && last.reasoning === reasoning) {
      return;
    }
    this.chatTurnPending.aiReadable.push({ text: raw, reasoning });
    if (this.task) {
      this.task.userFacingMessageCount = (this.task.userFacingMessageCount || 0) + 1;
    }
  },

  renderChatPanelIfOpen() {
    for (const state of this.windows.values()) {
      if (state && state.chatOpen) {
        this.renderChatPanel(state);
      }
    }
  },

  flushChatTurnToDisplay() {
    const turn = this.chatTurnPending;
    if (!turn) {
      this.resetChatTurnPending();
      return;
    }
    const readable = (turn.aiReadable || [])
      .map((entry) => this.normalizeChatReadableEntry(entry))
      .filter((entry) => entry.text || entry.reasoning);
    const process = (turn.process || []).filter(Boolean);
    if (!readable.length && !process.length) {
      this.resetChatTurnPending();
      return;
    }
    if (readable.length) {
      this.appendChatDisplay("ai", readable.map((entry) => entry.text).filter(Boolean).join("\n\n"), {
        label: "AI",
        kind: "ai",
        reasoning: readable.map((entry) => entry.reasoning).filter(Boolean).join("\n\n")
      });
    }
    if (process.length) {
      const summary = this.compressProcessLinesForChat(process);
      if (summary) {
        this.appendChatDisplay("ai", summary, { label: this.uiText("工作记录"), kind: "process" });
      }
    }
    this.resetChatTurnPending();
  },

  renderChatApprovalCard(state) {
    if (!state.chatApprovalNode) {
      return;
    }
    const body = state.chatApprovalNode;
    body.textContent = "";
    if (!this.task || !this.task.pendingApproval) {
      this.renderSelectionAskDraftPrompt(state, body);
      return;
    }
    const pending = this.task.pendingApproval;
    const card = this.el(state.doc, "div", "za-chat-approval-card", "");
    const title = this.el(state.doc, "div", "", pending.kind === "session_library_read" ? this.uiText("AI 需要整库读取权限") : this.uiText("AI 需要你批准一个操作"));
    title.style.fontWeight = "800";
    title.style.marginBottom = "6px";
    const summary = this.el(state.doc, "div", "", pending.summary);
    summary.style.whiteSpace = "pre-wrap";
    const buttons = this.el(state.doc, "div", "za-btn-row", "");
    buttons.appendChild(this.actionButton(state.doc, pending.approveLabel || "允许本次", "primary", () => this.approvePending(false)));
    if (pending.allowRemember) {
      buttons.appendChild(this.actionButton(state.doc, pending.rememberLabel || "记住此命令", "secondary", () => this.approvePending(true)));
    }
    const reject = this.actionButton(state.doc, "拒绝", "ghost", () => this.rejectPending());
    reject.style.color = "#b91c1c";
    buttons.appendChild(reject);
    card.appendChild(title);
    if (pending.aiLevel) {
      const tag = this.el(state.doc, "div", this.aiRiskTagClass(pending.aiLevel), this.aiRiskTagText(pending.aiLevel));
      tag.style.marginBottom = "4px";
      card.appendChild(tag);
      if (pending.aiReason) {
        const reason = this.el(state.doc, "div", "za-muted", this.t("reason", { reason: pending.aiReason }));
        reason.style.whiteSpace = "pre-wrap";
        reason.style.marginBottom = "6px";
        card.appendChild(reason);
      }
    }
    card.appendChild(summary);
    if (pending.details) {
      const details = this.html(state.doc, "details");
      details.style.marginTop = "6px";
      const detailsSummary = this.html(state.doc, "summary");
      detailsSummary.textContent = this.uiText("查看详情");
      const pre = this.html(state.doc, "pre");
      pre.textContent = pending.details;
      pre.style.cssText = "white-space:pre-wrap;word-break:break-all;font-size:11px;margin:6px 0 0;max-height:180px;overflow:auto;";
      details.appendChild(detailsSummary);
      details.appendChild(pre);
      card.appendChild(details);
    }
    card.appendChild(buttons);
    body.appendChild(card);
  },

  renderSelectionAskDraftPrompt(state, body) {
    const draft = state && state.pendingSelectionAskDraft;
    if (!draft || !body) {
      return;
    }
    const card = this.el(state.doc, "div", "za-selection-draft-card", "");
    const title = this.el(state.doc, "div", "za-selection-draft-card-title", "输入框已有草稿");
    const detail = this.el(
      state.doc,
      "div",
      "za-selection-draft-card-text",
      "请选择如何处理这次选句提问引用块。追加会插入到当前光标位置，覆盖会替换现有草稿。"
    );
    const buttons = this.el(state.doc, "div", "za-btn-row", "");
    buttons.appendChild(this.actionButton(state.doc, "追加", "primary", () => {
      this.applySelectionAskDraftToInput(state, draft, "append");
      state.chatNotice = draft.meta.truncated
        ? this.t("selectionAppendedTruncated", { originalChars: draft.meta.originalChars, includedChars: draft.meta.includedChars })
        : this.t("selectionAppended");
      this.log("selection.ask.prepared", this.selectionAskLogPayload(draft.meta, { hadExistingDraft: true, mergeMode: "append" }));
      this.renderChatPanel(state);
    }));
    buttons.appendChild(this.actionButton(state.doc, "覆盖", "secondary", () => {
      this.applySelectionAskDraftToInput(state, draft, "replace");
      state.chatNotice = draft.meta.truncated
        ? this.t("selectionReplacedTruncated", { originalChars: draft.meta.originalChars, includedChars: draft.meta.includedChars })
        : this.t("selectionReplaced");
      this.log("selection.ask.prepared", this.selectionAskLogPayload(draft.meta, { hadExistingDraft: true, mergeMode: "replace" }));
      this.renderChatPanel(state);
    }));
    buttons.appendChild(this.actionButton(state.doc, "取消", "ghost", () => {
      state.pendingSelectionAskDraft = null;
      state.chatNotice = this.t("selectionDraftCancelled");
      this.log("selection.ask.cancelled", this.selectionAskLogPayload(draft.meta, { hadExistingDraft: true }));
      this.renderChatPanel(state);
    }));
    card.appendChild(title);
    card.appendChild(detail);
    card.appendChild(buttons);
    body.appendChild(card);
  },

  attachChatDrawerDragHandlers(state, header) {
    header.addEventListener("mousedown", (event) => {
      const target = event.target;
      const onButton = target && typeof target.closest === "function" && target.closest("button");
      if (event.button !== 0 || onButton) {
        return;
      }
      event.preventDefault();
      state.chatDrawerFollowChat = false;
      const bounds = state.chatDrawerBounds || this.chatDrawerBoundsBesideChat(state);
      state.chatDrawerDragging = {
        startX: event.clientX,
        startY: event.clientY,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height
      };
      const onMove = (moveEvent) => {
        if (!state.chatDrawerDragging) {
          return;
        }
        state.chatDrawerBounds = this.clampChatDrawerBounds(state, {
          left: state.chatDrawerDragging.left + moveEvent.clientX - state.chatDrawerDragging.startX,
          top: state.chatDrawerDragging.top + moveEvent.clientY - state.chatDrawerDragging.startY,
          width: state.chatDrawerDragging.width,
          height: state.chatDrawerDragging.height
        });
        this.applyChatDrawerBounds(state);
      };
      const onUp = () => {
        state.chatDrawerDragging = null;
        state.win.removeEventListener("mousemove", onMove, true);
        state.win.removeEventListener("mouseup", onUp, true);
      };
      state.win.addEventListener("mousemove", onMove, true);
      state.win.addEventListener("mouseup", onUp, true);
    });
  },

  attachChatDragHandlers(state, header) {
    header.addEventListener("mousedown", (event) => {
      const target = event.target;
      const onButton = target && typeof target.closest === "function" && target.closest("button");
      if (event.button !== 0 || onButton) {
        return;
      }
      event.preventDefault();
      const bounds = state.chatBounds || this.defaultChatBounds(state);
      state.chatDragging = {
        startX: event.clientX,
        startY: event.clientY,
        left: bounds.left,
        top: bounds.top
      };
      const onMove = (moveEvent) => {
        if (!state.chatDragging) {
          return;
        }
        state.chatBounds = this.clampChatBounds(state, {
          left: state.chatDragging.left + moveEvent.clientX - state.chatDragging.startX,
          top: state.chatDragging.top + moveEvent.clientY - state.chatDragging.startY,
          width: bounds.width,
          height: bounds.height
        });
        this.applyChatBounds(state);
      };
      const onUp = () => {
        state.chatDragging = null;
        state.win.removeEventListener("mousemove", onMove, true);
        state.win.removeEventListener("mouseup", onUp, true);
      };
      state.win.addEventListener("mousemove", onMove, true);
      state.win.addEventListener("mouseup", onUp, true);
    });
  },

  runTaskLoopInBackground(state) {
    if (!this.task || this.task.status !== "running") {
      this.log("task.loop.skipped_not_running", { status: this.task && this.task.status });
      return;
    }
    if (this.taskLoopActive) {
      this.taskLoopResumeRequested = true;
      this.log("task.loop.queued_reentrant", { id: this.task.id });
      return;
    }
    this.taskLoopActive = true;
    this.taskLoopResumeRequested = false;
    const taskId = this.task.id;
    this.task.phase = "injecting_context";
    this.log("task.loop.entered", { id: taskId, phase: this.task.phase });
    this.renderChatPanelIfOpen();
    this.runTaskLoop()
      .catch((error) => {
        Zotero.debug(`Zotero Assistant runTaskLoop failed: ${error}`);
        if (this.task && this.task.id === taskId && this.task.status === "running") {
          this.task.status = "paused";
          this.task.phase = "model_failed";
          this.task.error = String(error);
        }
        this.showChatNotice(state, this.t("taskException", { error }));
      })
      .finally(() => {
        this.taskLoopActive = false;
        this.flushChatTurnToDisplay();
        this.renderAll();
        this.scheduleChatRepaint(state);
        if (this.taskLoopResumeRequested && this.task && this.task.id === taskId && this.task.status === "running") {
          this.taskLoopResumeRequested = false;
          this.runTaskLoopInBackground(state);
        }
      });
  },

  async startTaskFromText(state, text, options = {}) {
    state = this.resolveChatState(state);
    const taskText = String(text || "").trim();
    const selectionAskMeta = options.selectionAskMeta || null;
    if (!taskText) {
      this.showChatNotice(state, this.t("noInputTask"));
      return false;
    }
    if (!state || !state.win) {
      this.showChatNotice(state, this.t("cannotBindWindow"));
      return false;
    }
    this.repairOrphanRunningTask();
    if (this.task && this.task.status === "running") {
      this.appendChatDisplay("user", taskText);
      this.showChatNotice(state, this.t("taskAlreadyRunning"));
      this.scheduleChatRepaint(state);
      return false;
    }
    if (this.canContinueConversationTask()) {
      return await this.continueConversationWithUserMessage(state, taskText, { selectionAskMeta });
    }
    let libraryID;
    let libraryName;
    let libraryBindingSource = "active";
    try {
      const taskLibrary = this.taskLibraryFromSelectionOrActive(state, selectionAskMeta);
      libraryID = taskLibrary.libraryID;
      libraryName = taskLibrary.libraryName;
      libraryBindingSource = taskLibrary.source;
    } catch (error) {
      this.showChatNotice(state, this.t("cannotReadLibrary", { error }));
      return false;
    }
    this.taskLoopActive = false;
    this.task = {
      id: `task-${Date.now()}`,
      prompt: taskText,
      status: "running",
      phase: "understanding",
      error: null,
      libraryID,
      libraryName,
      messages: [{ role: "user", content: taskText }],
      pendingApproval: null,
      subtasks: [
        `${libraryBindingSource === "selection" ? "绑定任务到选区来源库" : "绑定任务到当前激活库"}：${libraryName}`,
        "读取默认 Zotero 上下文",
        this.hasSessionReadGrant(libraryID) ? "注入整库鸟瞰图" : "按需申请整库元数据读取",
        "制定工具调用计划"
      ],
      createdCollections: 0,
      createdItems: 0,
      loopCount: 0,
      roundLiveSearchCount: 0,
      roundWebFetchCount: 0,
      roundMetadataLookupCount: 0,
      roundCreatedCollections: 0,
      roundCreatedItems: 0,
      roundProcessedItems: new Set(),
      processedItems: new Set(),
      contextInjected: false,
      executedWriteToolCount: 0,
      liveSearchCount: 0,
      webFetchCount: 0,
      metadataLookupCount: 0,
      metadataLookupCache: {},
      plainAssistantTurnCount: 0,
      userFacingMessageCount: 0,
      lastToolFailure: null,
      consecutiveToolFailures: 0,
      lastDebugReportPath: null,
      compressionCount: 0,
      compressedSummaryChars: 0,
      canContinueAfterCompressionFailure: false,
      compressionFailure: null,
      sessionMemoryInjected: false,
      sessionMemoryChars: 0,
      selectionAsk: selectionAskMeta ? this.selectionAskLogPayload(selectionAskMeta) : null
    };
    const taskStartedLog = { id: this.task.id, prompt: taskText, libraryID, libraryName, libraryBindingSource, status: this.task.status };
    if (selectionAskMeta) {
      taskStartedLog.prompt = "[selection ask prompt omitted]";
      taskStartedLog.selectionAsk = this.selectionAskLogPayload(selectionAskMeta);
    }
    this.log("task.started", taskStartedLog);
    try {
      this.beginChatTurnUser(taskText);
    } catch (error) {
      this.task.status = "paused";
      this.task.phase = "start_failed";
      this.task.error = this.t("chatInitFailed", { error });
      this.showChatNotice(state, this.task.error);
      this.renderAll();
      return false;
    }
    this.task.phase = "starting_loop";
    this.log("task.loop.starting", { id: this.task.id, phase: this.task.phase });
    try {
      this.runTaskLoopInBackground(state);
    } catch (error) {
      this.task.status = "paused";
      this.task.phase = "loop_start_failed";
      this.task.error = this.t("taskLoopStartFailed", { error });
      this.log("task.paused", {
        id: this.task.id,
        reason: this.task.error,
        source: "runtime"
      });
      this.showChatNotice(state, this.task.error);
    }
    this.renderAll();
    this.scheduleChatRepaint(state);
    return true;
  },

  toggleMinimizeChatPanel(state) {
    if (!state || !state.chatPanel) {
      return;
    }
    state.chatMinimized = !state.chatMinimized;
    this.applyChatBounds(state);
    this.positionChatDrawer(state);
    this.renderChatPanel(state);
  },

  async startTaskFromInput(state) {
    const text = (state.inputNode && state.inputNode.value || "").trim();
    const accepted = await this.startTaskFromText(state, text);
    if (accepted && state.inputNode) {
      state.inputNode.value = "";
    }
  },

  attachChatResizeHandlers(state, handle) {
    if (!handle) {
      return;
    }
    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || state.chatMinimized) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const bounds = state.chatBounds || this.defaultChatBounds(state);
      state.chatResizing = {
        startX: event.clientX,
        startY: event.clientY,
        width: bounds.width,
        height: bounds.height,
        left: bounds.left,
        top: bounds.top
      };
      const onMove = (moveEvent) => {
        if (!state.chatResizing) {
          return;
        }
        const dx = moveEvent.clientX - state.chatResizing.startX;
        const dy = moveEvent.clientY - state.chatResizing.startY;
        state.chatBounds = this.clampChatBounds(state, {
          left: state.chatResizing.left,
          top: state.chatResizing.top,
          width: state.chatResizing.width + dx,
          height: state.chatResizing.height + dy
        });
        this.applyChatBounds(state);
      };
      const onUp = () => {
        state.chatResizing = null;
        state.win.removeEventListener("mousemove", onMove, true);
        state.win.removeEventListener("mouseup", onUp, true);
      };
      state.win.addEventListener("mousemove", onMove, true);
      state.win.addEventListener("mouseup", onUp, true);
    });
  },

  avoidSidebarOverlapForChat(state) {
    if (!state || !state.chatBounds || !this.isSidebarVisible(state) || !state.container) {
      return;
    }
    const sidebarRect = state.container.getBoundingClientRect();
    const sidebarLeft = Number(sidebarRect.left);
    if (!Number.isFinite(sidebarLeft) || sidebarLeft <= 0) {
      return;
    }
    const margin = 18;
    const chatRight = state.chatBounds.left + state.chatBounds.width;
    if (chatRight <= sidebarLeft - margin) {
      return;
    }
    state.chatBounds = this.clampChatBounds(state, {
      ...state.chatBounds,
      left: sidebarLeft - margin - state.chatBounds.width
    });
  },

  backfillChatDisplayFromTask() {
    if (!this.task || !Array.isArray(this.task.messages) || this.chatDisplayLog.length) {
      return;
    }
    for (const message of this.task.messages) {
      if (!message) {
        continue;
      }
      if (message.role === "user") {
        const ut = this.normalizeTextContent(message.content);
        if (ut) {
          this.appendChatDisplay("user", ut);
        }
        this.chatTurnPending = { userText: "", aiReadable: [], process: [] };
      } else if (message.role === "assistant") {
        this.absorbAssistantMessageForChatDisplay(message);
      }
    }
    if (this.task.summary) {
      this.pushChatTurnReadable(this.task.summary);
    }
    this.flushChatTurnToDisplay();
  },

  canContinueConversationTask() {
    if (!this.task || this.task.pendingApproval) {
      return false;
    }
    if (this.task.status === "running") {
      return false;
    }
    return true;
  },

  chatMessageTextFromToolCall(call) {
    const name = call && call.function && call.function.name;
    if (!name) {
      return "";
    }
    const args = this.parseArguments(call.function && call.function.arguments);
    if (name === "request_clarification") {
      return [
        args.question || "",
        args.recommendedAnswer ? this.t("recommendedAnswer", { answer: args.recommendedAnswer }) : ""
      ].filter(Boolean).join("\n");
    }
    return "";
  },

  compressProcessLinesForChat(lines) {
    const items = Array.isArray(lines) ? lines.filter(Boolean) : [];
    if (!items.length) {
      return "";
    }
    const maxLines = 10;
    const head = items.slice(0, maxLines);
    const tail = items.length > maxLines ? `\n${this.t("processMore", { count: items.length - maxLines })}` : "";
    return [this.t("processHeading"), ...head.map((line, index) => `${index + 1}. ${line}`)].join("\n") + tail;
  },

  chatProcessLineFromToolCall(call) {
    const name = call && call.function && call.function.name;
    if (!name) {
      return "";
    }
    if (name === "request_clarification" || name === "finish_task") {
      return "";
    }
    const args = this.parseArguments(call.function && call.function.arguments);
    const labels = {
      search_items: "搜索文献",
      read_current_context: "读取当前选择",
      read_item_fields: "读取条目字段",
      read_current_reader_pages: "读取当前阅读器页面",
      read_library_overview: "读取库概览",
      browse_library_items: "浏览库条目",
      read_fulltext_page: "读取全文",
      live_search: "联网搜索",
      web_fetch: "抓取网页",
      lookup_metadata_candidates: "联网查元数据",
      create_collection: "创建分类",
      create_item: "创建条目",
      add_tags: "添加标签",
      create_note: "创建笔记",
      append_note: "追加笔记",
      add_items_to_collection: "加入分类",
      update_metadata: "更新元数据",
      move_to_trash: "移到回收站",
      set_preference: "修改设置",
      request_expanded_context: "申请整库读取",
      trigger_plugin_command: "调用插件命令",
      list_plugin_commands: "列出插件命令",
      browse_preferences: "浏览设置",
      search_preferences: "搜索设置",
      read_preferences: "读取设置",
      list_preference_panes: "列出设置面板",
      open_zotero_preferences: "打开设置页",
      create_parent_item: "创建父条目"
    };
    const label = this.uiText(labels[name] || name);
    let detail = "";
    const separator = this.isEnglishUI() ? ": " : "：";
    if (name === "search_items" && args.query) {
      detail = `${separator}${args.query}`;
    } else if (name === "live_search" && args.query) {
      detail = `${separator}${args.query}`;
    } else if (name === "web_fetch" && args.url) {
      detail = `${separator}${String(args.url).slice(0, 60)}`;
    } else if (name === "lookup_metadata_candidates" && String(args.query || "").trim()) {
      detail = `${separator}${String(args.query).slice(0, 60)}`;
    } else if (name === "lookup_metadata_candidates" && Array.isArray(args.itemKeys)) {
      detail = `${separator}${args.itemKeys.length} ${this.isEnglishUI() ? "items" : "条"}`;
    } else if (name === "create_collection" && args.name) {
      detail = `${separator}${args.name}`;
    } else if (name === "create_item") {
      const title = args.fields && args.fields.title ? args.fields.title : args.itemType || "";
      detail = title ? `${separator}${String(title).slice(0, 60)}` : "";
    }
    return `${label}${detail}`;
  },

  chatTurnPendingTranscriptEntries() {
    const turn = this.chatTurnPending;
    if (!turn) {
      return [];
    }
    const entries = [];
    const readable = (turn.aiReadable || [])
      .map((entry) => this.normalizeChatReadableEntry(entry))
      .filter((entry) => entry.text || entry.reasoning);
    if (readable.length) {
      entries.push({
        speaker: "ai",
        label: "AI",
        text: readable.map((entry) => entry.text).filter(Boolean).join("\n\n") || this.t("reasoningOnly"),
        reasoning: readable.map((entry) => entry.reasoning).filter(Boolean).join("\n\n"),
        kind: "ai"
      });
    }
    const process = (turn.process || []).filter(Boolean);
    if (process.length) {
      const summary = this.compressProcessLinesForChat(process);
      if (summary) {
        entries.push({
          speaker: "ai",
          label: this.uiText("工作记录"),
          text: summary,
          kind: "process"
        });
      }
    }
    return entries;
  },

  absorbAssistantMessageForChatDisplay(message) {
    if (!message || !this.chatTurnPending) {
      return;
    }
    const displayParts = this.assistantMessageDisplayParts(message);
    if (displayParts.text || displayParts.reasoning) {
      this.pushChatTurnReadable(displayParts.text, { reasoning: displayParts.reasoning });
    }
    if (!Array.isArray(message.tool_calls)) {
      return;
    }
    for (const call of message.tool_calls) {
      const readable = this.chatMessageTextFromToolCall(call);
      if (readable) {
        this.pushChatTurnReadable(readable);
        continue;
      }
      const processLine = this.chatProcessLineFromToolCall(call);
      if (processLine) {
        this.pushChatTurnProcess(processLine);
      }
    }
  },

  finishTaskSummaryMeetsUserMessageRule(summaryText) {
    const summary = String(summaryText || "").trim();
    if (!summary || summary.length < 8) {
      return {
        ok: false,
        error: this.t("finalSummaryRequired")
      };
    }
    const prior = this.task ? (this.task.userFacingMessageCount || 0) : 0;
    if (prior < 1 && summary.length < 24) {
      return {
        ok: false,
        error: this.t("finalSummaryNoPriorMessage"),
        mustMessageUserFirst: true
      };
    }
    const incomplete = this.incompleteFinishTaskSummaryReason(summary);
    if (incomplete) {
      return {
        ok: false,
        error: incomplete,
        mustProvideSubstantiveSummary: true
      };
    }
    return { ok: true, summary };
  },

  incompleteFinishTaskSummaryReason(summaryText) {
    const summary = String(summaryText || "").trim();
    const compact = summary.replace(/\s+/g, "").replace(/[：:。.!！?？]+$/g, "");
    const placeholderEndings = [
      "如下",
      "如下是",
      "如下为",
      "如下所示",
      "总结如下",
      "摘要如下",
      "结果如下",
      "概览如下",
      "内容如下",
      "列表如下",
      "asfollows",
      "summaryasfollows",
      "resultasfollows",
      "resultsasfollows",
      "below",
      "summarybelow",
      "resultsbelow"
    ];
    if (placeholderEndings.some((ending) => compact.endsWith(ending))) {
      return this.t("finalSummaryPlaceholder");
    }
    if (/[:：]\s*$/.test(summary)) {
      return this.t("finalSummaryColon");
    }
    return "";
  },

  appendAssistantToolCallsToChatDisplay(toolCalls) {
    if (!Array.isArray(toolCalls)) {
      return;
    }
    for (const call of toolCalls) {
      const readable = this.chatMessageTextFromToolCall(call);
      if (readable) {
        this.pushChatTurnReadable(readable);
        continue;
      }
      const processLine = this.chatProcessLineFromToolCall(call);
      if (processLine) {
        this.pushChatTurnProcess(processLine);
      }
    }
  },

  async continueConversationWithUserMessage(state, taskText, options = {}) {
    const selectionAskMeta = options.selectionAskMeta || null;
    const taskLibrary = this.taskLibraryFromSelectionOrActive(state, selectionAskMeta);
    const libraryID = taskLibrary.libraryID;
    if (this.task.libraryID && this.task.libraryID !== libraryID) {
      this.task.libraryID = libraryID;
      this.task.libraryName = taskLibrary.libraryName;
      this.task.contextInjected = false;
      this.task.processedItems = null;
      this.task.roundMetadataLookupCount = 0;
      this.task.roundWebFetchCount = 0;
      const switchReason = taskLibrary.source === "selection"
        ? "The user sent a selected-text question from a Zotero source in another library."
        : "The user switched the active Zotero library in the UI.";
      this.task.messages.push({
        role: "system",
        content: `${switchReason} This task is now bound to: ${this.task.libraryName} (${libraryID}). Re-read context if library-specific work continues.`
      });
    }
    this.task.status = "running";
    this.task.phase = this.task.phase === "needs_user" ? "resumed" : "continued";
    this.beginChatTurnUser(taskText);
    this.task.messages.push({ role: "user", content: taskText });
    this.task.error = null;
    this.task.pendingApproval = null;
    const userReplyLog = { id: this.task.id, content: taskText, continued: true };
    if (selectionAskMeta) {
      userReplyLog.content = "[selection ask prompt omitted]";
      userReplyLog.selectionAsk = this.selectionAskLogPayload(selectionAskMeta);
    }
    this.log("task.user_reply", userReplyLog);
    this.renderAll();
    this.scheduleChatRepaint(state);
    this.runTaskLoopInBackground(state);
    return true;
  }
};
})();
