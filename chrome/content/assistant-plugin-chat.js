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
    this.avoidSidebarOverlapForChat(state);
    this.applyChatBounds(state);
    this.renderChatPanel(state);
    if (state.chatInputNode && !state.chatMinimized) {
      state.chatInputNode.focus();
    }
  },

  showChatNotice(state, message) {
    if (state) {
      state.chatNotice = String(message || "");
      this.showChatPanel(state);
      this.renderChatPanel(state);
    }
    if (state && state.logNode) {
      this.showMessage(state, message);
    }
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
    state.chatMinimized = false;
    this.showChatPanel(state);

    const snapshot = await this.readSelectionAskSnapshot(state, event);
    if (!snapshot.ok) {
      state.pendingSelectionAskDraft = null;
      this.log("selection.ask.no_selection", { reason: snapshot.error || "no_selection" });
      this.showChatNotice(state, "未检测到可提问的选中文本。你可以直接在这里输入问题。");
      return;
    }
    const draft = await this.buildSelectionAskDraft(state, snapshot);
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
    return { ok: false, error: "没有可读选区，或选区位于输入框、可编辑区域、Zotero 助手界面内。" };
  },

  async describeSelectionAskSource(state, snapshot) {
    const fallback = {
      type: "zotero_window",
      label: "Zotero 窗口选区",
      lines: ["来源：Zotero 窗口选区"]
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
            `来源：Zotero 阅读器${title ? ` - ${title}` : ""}`,
            attachment && attachment.key ? `附件 key：${attachment.key}` : "",
            pageText ? `当前页：${pageText}` : ""
          ].filter(Boolean);
          return {
            type: "reader",
            label: lines[0],
            lines,
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
        label: `Zotero 窗口选区 - ${title}`,
        lines: [`来源：Zotero 窗口选区 - ${title}`]
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
      label: "Zotero 窗口选区",
      lines: ["来源：Zotero 窗口选区"]
    };
    const lines = [
      "基于这段文字回答：",
      "",
      ...source.lines,
      "",
      this.quoteSelectionAskText(clipped),
      "",
      "我的问题："
    ];
    return {
      text: lines.join("\n"),
      meta: {
        sourceType: source.type || "zotero_window",
        sourceLabel: source.label || "Zotero 窗口选区",
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
        ? "聊天输入框已有草稿，且当前任务正在运行。请选择如何处理草稿，任务结束后再发送。"
        : "聊天输入框已有草稿，请选择追加、覆盖或取消。";
      this.renderChatPanel(state);
      return;
    }
    this.applySelectionAskDraftToInput(state, draft, "replace");
    const baseNotice = draft.meta.truncated
      ? `已填入选中文本，原文 ${draft.meta.originalChars} 字符，已截断为 ${draft.meta.includedChars} 字符。`
      : "已填入选中文本。请补充你的问题后发送。";
    state.chatNotice = busy
      ? `${baseNotice} 当前任务正在运行，请等待结束后再发送。`
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
      itemKey: meta && meta.itemKey || "",
      attachmentKey: meta && meta.attachmentKey || "",
      pageLabel: meta && meta.pageLabel || "",
      originalChars: meta && meta.originalChars || 0,
      includedChars: meta && meta.includedChars || 0,
      truncated: !!(meta && meta.truncated)
    }, extra);
    return data;
  },

  consumeSelectionAskMetaForText(state, text) {
    if (!state || !state.activeSelectionAskDraftMeta) {
      return null;
    }
    const meta = state.activeSelectionAskDraftMeta;
    state.activeSelectionAskDraftMeta = null;
    return String(text || "").includes("基于这段文字回答：") ? meta : null;
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
    const minimize = this.actionButton(doc, "最小化", "ghost", () => this.toggleMinimizeChatPanel(state));
    minimize.setAttribute("data-za-chat-minimize", "1");
    actions.appendChild(minimize);
    actions.appendChild(this.actionButton(doc, "关闭", "ghost", () => this.hideChatPanel(state)));
    header.appendChild(titleWrap);
    header.appendChild(actions);
    this.attachChatDragHandlers(state, header);

    const messages = this.el(doc, "div", "za-floating-chat-messages", "");
    messages.style.cssText = "flex:1 1 auto;min-height:0;padding:14px 12px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:14px;background:#e9ebef;";
    const approval = this.el(doc, "div", "za-floating-chat-approval", "");
    const footer = this.el(doc, "div", "za-floating-chat-footer", "");
    footer.style.cssText = "flex:0 0 auto;display:flex;gap:8px;align-items:flex-end;padding:10px 12px 12px;border-top:1px solid #e2e5ea;background:#ffffff;";
    const input = this.html(doc, "textarea");
    input.placeholder = "输入任务或回复 AI 追问。Shift+Enter 换行，Enter 发送。";
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
    resizeHandle.setAttribute("aria-label", "拖动调节聊天窗大小");
    resizeHandle.title = "拖动调节大小";
    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(approval);
    panel.appendChild(footer);
    panel.appendChild(resizeHandle);
    this.attachChatResizeHandlers(state, resizeHandle);
    this.ensureUiOverlayRoot(state).appendChild(panel);

    state.chatHeaderNode = header;
    state.chatMessagesNode = messages;
    state.chatApprovalNode = approval;
    state.chatInputNode = input;
    state.chatFooterNode = footer;
    state.chatSendButton = send;
    return panel;
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
      minimizeButton.textContent = state.chatMinimized ? "恢复" : "最小化";
      minimizeButton.setAttribute("aria-label", state.chatMinimized ? "恢复聊天窗" : "最小化聊天窗");
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
      body.appendChild(this.el(state.doc, "div", "za-chat-empty", "暂无问答。发送任务后，用户和 AI 的可读消息会显示在这里。"));
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
    if (!raw) {
      return;
    }
    const clipped = raw.length > MAX_CHAT_DISPLAY_CHARS
      ? raw.slice(0, MAX_CHAT_DISPLAY_CHARS) + "\n…（内容已截断）"
      : raw;
    const isUser = speaker === "user";
    this.chatDisplayLog.push({
      speaker: isUser ? "user" : "ai",
      label: options.label || (isUser ? "你" : "AI"),
      text: clipped,
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
    button.setAttribute("aria-label", "打开 Zotero 助手聊天窗");
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
      return "正在压缩上下文…";
    }
    if (phase === "injecting_context") {
      return "正在读取 Zotero 上下文…";
    }
    if (phase === "understanding" || phase === "continued" || phase === "resumed") {
      return "正在思考…";
    }
    if (phase === "calling_model") {
      return "正在等待模型回复…";
    }
    return "正在处理…";
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
    const avatar = this.el(doc, "div", isUser ? "za-chat-avatar za-chat-avatar-user" : "za-chat-avatar za-chat-avatar-ai", isUser ? "我" : "AI");
    avatar.style.cssText = isUser
      ? "flex:0 0 36px;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:#c45c26;color:#fff;"
      : "flex:0 0 36px;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:#4a90d9;color:#fff;";
    const stack = this.el(doc, "div", "za-chat-stack", "");
    stack.style.cssText = isUser
      ? "display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:0;max-width:calc(100% - 52px);"
      : "display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0;max-width:calc(100% - 52px);";
    const isProcess = entry.kind === "process";
    const name = this.el(doc, "div", "za-chat-name", entry.label || (isUser ? "你" : "AI"));
    name.style.cssText = "font-size:11px;font-weight:600;color:#8a8f99;line-height:1.2;padding:0 4px;";
    const bubble = this.el(doc, "div", isUser ? "za-chat-bubble za-chat-bubble-user" : (isProcess ? "za-chat-bubble za-chat-bubble-process" : "za-chat-bubble za-chat-bubble-ai"), "");
    bubble.style.cssText = isUser
      ? "max-width:100%;border-radius:10px;border-bottom-right-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#95ec69;color:#111827;box-shadow:0 1px 2px rgba(0,0,0,0.06);"
      : isProcess
        ? "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:8px 10px;font-size:11px;line-height:1.45;background:#f1f5f9;color:#64748b;border:1px dashed #cbd5e1;box-shadow:none;"
        : "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#ffffff;color:#111827;border:1px solid #e2e5ea;box-shadow:0 1px 2px rgba(0,0,0,0.06);";
    this.fillChatBubbleContent(bubble, entry.text, isUser && !isProcess);
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

  pushChatTurnReadable(text) {
    const raw = String(text || "").trim();
    if (!raw || !this.chatTurnPending) {
      return;
    }
    const last = this.chatTurnPending.aiReadable[this.chatTurnPending.aiReadable.length - 1];
    if (last === raw) {
      return;
    }
    this.chatTurnPending.aiReadable.push(raw);
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
    const readable = (turn.aiReadable || []).filter(Boolean);
    const process = (turn.process || []).filter(Boolean);
    if (!readable.length && !process.length) {
      this.resetChatTurnPending();
      return;
    }
    if (readable.length) {
      this.appendChatDisplay("ai", readable.join("\n\n"), { label: "AI", kind: "ai" });
    }
    if (process.length) {
      const summary = this.compressProcessLinesForChat(process);
      if (summary) {
        this.appendChatDisplay("ai", summary, { label: "工作记录", kind: "process" });
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
    const title = this.el(state.doc, "div", "", pending.kind === "session_library_read" ? "AI 需要整库读取权限" : "AI 需要你批准一个操作");
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
    card.appendChild(summary);
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
        ? `已追加选中文本，原文 ${draft.meta.originalChars} 字符，已截断为 ${draft.meta.includedChars} 字符。`
        : "已追加选中文本。";
      this.log("selection.ask.prepared", this.selectionAskLogPayload(draft.meta, { hadExistingDraft: true, mergeMode: "append" }));
      this.renderChatPanel(state);
    }));
    buttons.appendChild(this.actionButton(state.doc, "覆盖", "secondary", () => {
      this.applySelectionAskDraftToInput(state, draft, "replace");
      state.chatNotice = draft.meta.truncated
        ? `已覆盖为选中文本，原文 ${draft.meta.originalChars} 字符，已截断为 ${draft.meta.includedChars} 字符。`
        : "已覆盖为选中文本。";
      this.log("selection.ask.prepared", this.selectionAskLogPayload(draft.meta, { hadExistingDraft: true, mergeMode: "replace" }));
      this.renderChatPanel(state);
    }));
    buttons.appendChild(this.actionButton(state.doc, "取消", "ghost", () => {
      state.pendingSelectionAskDraft = null;
      state.chatNotice = "已取消这次选句提问草稿。";
      this.log("selection.ask.cancelled", this.selectionAskLogPayload(draft.meta, { hadExistingDraft: true }));
      this.renderChatPanel(state);
    }));
    card.appendChild(title);
    card.appendChild(detail);
    card.appendChild(buttons);
    body.appendChild(card);
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
      this.log("task.loop.skipped_reentrant", { id: this.task.id });
      this.task.status = "paused";
      this.task.phase = "loop_busy";
      this.task.error = "任务循环未结束，无法再次启动。请稍候或侧边栏「清除当前任务」。";
      this.showChatNotice(state, this.task.error);
      this.renderAll();
      return;
    }
    this.taskLoopActive = true;
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
        this.showChatNotice(state, `任务异常：${error}`);
      })
      .finally(() => {
        this.taskLoopActive = false;
        this.flushChatTurnToDisplay();
        this.renderAll();
        this.scheduleChatRepaint(state);
      });
  },

  async startTaskFromText(state, text, options = {}) {
    state = this.resolveChatState(state);
    const taskText = String(text || "").trim();
    const selectionAskMeta = options.selectionAskMeta || null;
    if (!taskText) {
      this.showChatNotice(state, "请输入一个明确任务。助手不会默认执行任何任务。");
      return false;
    }
    if (!state || !state.win) {
      this.showChatNotice(state, "无法绑定 Zotero 主窗口，请关闭聊天窗后从本窗口重新打开。");
      return false;
    }
    this.repairOrphanRunningTask();
    if (this.task && this.task.status === "running") {
      this.appendChatDisplay("user", taskText);
      this.showChatNotice(state, "已有任务正在运行，这条已记在聊天里。请等待当前任务结束，或在侧边栏「清除当前任务」后再发新任务。");
      this.scheduleChatRepaint(state);
      return false;
    }
    if (this.canContinueConversationTask()) {
      return await this.continueConversationWithUserMessage(state, taskText, { selectionAskMeta });
    }
    let libraryID;
    let libraryName;
    try {
      libraryID = this.getActiveLibraryID(state.win);
      libraryName = this.getLibraryName(libraryID);
    } catch (error) {
      this.showChatNotice(state, `无法读取当前文献库：${error}`);
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
        `绑定任务到当前激活库：${libraryName}`,
        "读取默认 Zotero 上下文",
        this.hasSessionReadGrant(libraryID) ? "注入整库鸟瞰图" : "按需申请整库元数据读取",
        "制定工具调用计划"
      ],
      createdCollections: 0,
      loopCount: 0,
      roundLiveSearchCount: 0,
      roundWebFetchCount: 0,
      roundCreatedCollections: 0,
      roundProcessedItems: new Set(),
      processedItems: new Set(),
      contextInjected: false,
      executedWriteToolCount: 0,
      liveSearchCount: 0,
      webFetchCount: 0,
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
    const taskStartedLog = { id: this.task.id, prompt: taskText, libraryID, libraryName, status: this.task.status };
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
      this.task.error = `聊天显示初始化失败：${error}`;
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
      this.task.error = `任务循环启动失败：${error}`;
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
        args.recommendedAnswer ? `推荐：${args.recommendedAnswer}` : ""
      ].filter(Boolean).join("\n");
    }
    if (name === "finish_task") {
      return args.summary || "";
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
    const tail = items.length > maxLines ? `\n… 另有 ${items.length - maxLines} 步未展开` : "";
    return ["【本回合后台操作】", ...head.map((line, index) => `${index + 1}. ${line}`)].join("\n") + tail;
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
      create_collection: "创建分类",
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
    const label = labels[name] || name;
    let detail = "";
    if (name === "search_items" && args.query) {
      detail = `：${args.query}`;
    } else if (name === "live_search" && args.query) {
      detail = `：${args.query}`;
    } else if (name === "web_fetch" && args.url) {
      detail = `：${String(args.url).slice(0, 60)}`;
    } else if (name === "create_collection" && args.name) {
      detail = `：${args.name}`;
    }
    return `${label}${detail}`;
  },

  chatTurnPendingTranscriptEntries() {
    const turn = this.chatTurnPending;
    if (!turn) {
      return [];
    }
    const entries = [];
    const readable = (turn.aiReadable || []).filter(Boolean);
    if (readable.length) {
      entries.push({
        speaker: "ai",
        label: "AI",
        text: readable.join("\n\n"),
        kind: "ai"
      });
    }
    const process = (turn.process || []).filter(Boolean);
    if (process.length) {
      const summary = this.compressProcessLinesForChat(process);
      if (summary) {
        entries.push({
          speaker: "ai",
          label: "工作记录",
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
    const assistantText = this.stripJsonToolPlanFromAssistantText(message.content);
    if (assistantText) {
      this.pushChatTurnReadable(assistantText);
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
        error: "finish_task 被拒绝：必须填写给用户的中文 summary（至少 8 个字），说明做了什么、结果如何。"
      };
    }
    const prior = this.task ? (this.task.userFacingMessageCount || 0) : 0;
    if (prior < 1 && summary.length < 24) {
      return {
        ok: false,
        error: "finish_task 被拒绝：本任务尚未向用户发送过任何说明。请先在同一轮用中文回复用户（assistant 正文或 request_clarification），或在 finish_task.summary 中写完整说明（不少于 24 字），再结束任务。",
        mustMessageUserFirst: true
      };
    }
    return { ok: true, summary };
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
    const libraryID = this.getActiveLibraryID(state.win);
    if (this.task.libraryID && this.task.libraryID !== libraryID) {
      this.task.libraryID = libraryID;
      this.task.libraryName = this.getLibraryName(libraryID);
      this.task.messages.push({
        role: "system",
        content: `The user switched the active Zotero library in the UI. This task is now bound to: ${this.task.libraryName} (${libraryID}). Re-read context if library-specific work continues.`
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
