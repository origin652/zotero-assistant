var ZoteroAssistantPluginCore = (() => {
  const {
    HTML_NS,
    PREF_PREFIX,
    PREFS,
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_AUDIT_MODEL,
    DEFAULT_API_MODE,
    DEFAULT_SAFETY_MODE,
    DEFAULT_UI_LANGUAGE,
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
  log(type, data) {
    this.eventLog.push({ time: Date.now(), type, data: this.sanitizeForLog(data) });
    this.eventLog = this.pruneLog(this.eventLog);
    try {
      this.persistLog();
    } catch (error) {
      Zotero.debug(`Zotero Assistant failed to persist log: ${error}`);
    }
    for (const state of this.windows.values()) {
      try {
        this.renderApprovalPopup(state);
        if (typeof this.renderLogPopup === "function") {
          this.renderLogPopup(state);
        }
      } catch (error) {
        Zotero.debug(`Zotero Assistant failed to render log side effects: ${error}`);
      }
    }
  },

  render(state) {
    this.renderChatPanel(state);
    this.renderChatDrawer(state);
    this.renderApprovalPopup(state);
  },

  pruneLog(log) {
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return (log || []).filter((entry) => entry && entry.time >= cutoff);
  },

  shutdown() {
    for (const win of Array.from(this.windows.keys())) {
      this.removeFromWindow(win);
    }
    this.unregisterNotifier();
    this.unregisterPreferencePane();
    this.persistLog();
  },

  renderAll() {
    for (const state of this.windows.values()) {
      this.render(state);
    }
  },

  persistLog() {
    this.writeJSONPref(PREFS.eventLog, this.eventLog);
  },

  setDefault(name, value) {
    try {
      if (Zotero.Prefs.get(name, true) === undefined) {
        Zotero.Prefs.set(name, value, true);
      }
    } catch (error) {
      Zotero.debug(`Zotero Assistant failed to set pref ${name}: ${error}`);
    }
  },

  firstState() {
    return this.windows.values().next().value || null;
  },

  ensurePrefs() {
    this.setDefault(PREFS.baseURL, DEFAULT_BASE_URL);
    this.setDefault(PREFS.model, DEFAULT_MODEL);
    this.setDefault(PREFS.auditModel, DEFAULT_AUDIT_MODEL);
    this.setDefault(PREFS.apiMode, DEFAULT_API_MODE);
    this.setDefault(PREFS.apiKey, "");
    this.setDefault(PREFS.safetyMode, DEFAULT_SAFETY_MODE);
    this.setDefault(PREFS.uiLanguage, DEFAULT_UI_LANGUAGE);
    this.setDefault(PREFS.debugMode, false);
    this.setDefault(PREFS.debugOutputDir, "");
    this.setDefault(PREFS.rememberedApprovals, "{}");
    this.setDefault(PREFS.eventLog, "[]");
    this.setDefault(PREFS.braveSearchApiKey, "");
    this.setDefault(PREFS.webSearchProvider, "auto");
    this.setDefault(PREFS.metadataSemanticScholarEnabled, false);
    this.setDefault(PREFS.metadataSemanticScholarApiKey, "");
    this.setDefault(PREFS.metadataPubMedEnabled, false);
    this.setDefault(PREFS.metadataPubMedApiKey, "");
    this.setDefault(PREFS.metadataPubMedEmail, "");
    this.setDefault(PREFS.selectionAskShortcut, DEFAULT_SELECTION_ASK_SHORTCUT);
    this.setDefault(PREFS.sessionMemoryEnabled, DEFAULT_SESSION_MEMORY_ENABLED);
    this.setDefault(PREFS.autoCompressionEnabled, DEFAULT_AUTO_COMPRESSION_ENABLED);
    this.setDefault(PREFS.contextCompressionTriggerChars, DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS);
    this.setDefault(PREFS.contextCompressionTargetChars, DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS);
    this.setDefault(PREFS.contextCompressionKeepMessages, DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES);
    this.setDefault(PREFS.contextCompressionMaxTokens, DEFAULT_CONTEXT_COMPRESSION_MAX_TOKENS);
    this.setDefault(PREFS.contextCompressionTargetTokens, DEFAULT_CONTEXT_COMPRESSION_TARGET_TOKENS);
  },

  firstWindow() {
    const state = this.firstState();
    return state && state.win;
  },

  installPreferencePaneLocalization(state) {
    if (!state || !state.win || !state.doc || state.prefPaneLocalizationObserver) {
      return;
    }
    const schedule = () => {
      if (state.prefPaneLocalizationTimer) {
        return;
      }
      state.prefPaneLocalizationTimer = state.win.setTimeout(() => {
        state.prefPaneLocalizationTimer = null;
        this.localizePreferencePaneDocument(state.doc);
      }, 0);
    };
    const Observer = state.win.MutationObserver;
    if (typeof Observer === "function") {
      state.prefPaneLocalizationObserver = new Observer(schedule);
      state.prefPaneLocalizationObserver.observe(state.doc.documentElement || state.doc, {
        childList: true,
        subtree: true
      });
    }
    schedule();
  },

  addToWindow(win) {
    if (!win || this.windows.has(win)) {
      return;
    }
    const doc = win.document;
    this.ensureGlobalStyles(doc);
    const state = {
      win,
      doc,
      container: null,
      launcher: null,
      menuItem: null,
      statusNode: null,
      grantNode: null,
      logNode: null,
      approvalsNode: null,
      chatLauncher: null,
      chatPanel: null,
      chatHeaderNode: null,
      chatMessagesNode: null,
      chatApprovalNode: null,
      chatInputNode: null,
      chatFooterNode: null,
      chatSendButton: null,
      chatOpen: false,
      chatMinimized: false,
      chatBounds: null,
      chatDrawerBounds: null,
      chatDrawerFollowChat: true,
      chatDrawerDragging: null,
      chatNotice: "",
      chatDragging: null,
      uiOverlayRoot: null,
      onResize: null,
      popupHost: null,
      approvalPopup: null,
      logPopup: null,
      logPopupTimer: null,
      lastLogPopupKey: "",
      onSelectionAskKeydown: null,
      selectionAskShortcutTargets: [],
      selectionAskShortcutTimer: null,
      selectionAskShortcutSyncing: false,
      prefPaneLocalizationObserver: null,
      prefPaneLocalizationTimer: null,
      pendingSelectionAskDraft: null,
      activeSelectionAskDraftMeta: null,
      inputNode: null,
      sendButton: null
    };
    state.menuItem = this.addToolsMenuItem(win);
    this.ensureUiOverlayRoot(state);
    state.chatLauncher = this.createChatLauncher(win, state);
    state.chatPanel = this.createChatPanel(win, state);
    state.onResize = () => {
      if (!state.chatOpen || !state.chatBounds) {
        return;
      }
      state.chatBounds = this.clampChatBounds(state, state.chatBounds);
      this.applyChatBounds(state);
      this.positionChatDrawer(state);
    };
    win.addEventListener("resize", state.onResize);
    this.installSelectionAskShortcut(state);
    this.installPreferencePaneLocalization(state);
    this.windows.set(win, state);
    this.render(state);
  },

  readJSONPref(pref, fallback) {
    try {
      const value = Zotero.Prefs.get(pref, true);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  },

  writeJSONPref(pref, value) {
    try {
      Zotero.Prefs.set(pref, JSON.stringify(value), true);
    } catch (error) {
      Zotero.debug(`Zotero Assistant failed to write ${pref}: ${error}`);
    }
  },

  async startup() {
    this.ensurePrefs();
    this.rememberedApprovals = this.readJSONPref(PREFS.rememberedApprovals, {});
    this.eventLog = this.pruneLog(this.readJSONPref(PREFS.eventLog, []));
    this.writeJSONPref(PREFS.eventLog, this.eventLog);
    this.registerNotifier();
    await this.registerPreferencePane();
    if (!this.chatTurnPending) {
      this.resetChatTurnPending();
    }
    if (!Array.isArray(this.chatDisplayLog)) {
      this.chatDisplayLog = [];
    }
    for (const win of this.getMainWindows()) {
      this.addToWindow(win);
    }
    this.log("plugin.started", { version: this.version });
  },

  async undoLast() {
    const op = this.undoStack.pop();
    if (!op) {
      return;
    }
    this.log("undo.started", op);
    if (op.type === "remove_items_from_collection") {
      const collection = Zotero.Collections.get(op.collectionID);
      if (collection) {
        await Zotero.DB.executeTransaction(async () => {
          await collection.removeItems(op.itemIDs);
        });
        await collection.loadDataType("childItems", true);
      }
    } else if (op.type === "delete_collection") {
      const collection = Zotero.Collections.get(op.collectionID);
      if (collection) {
        await collection.eraseTx();
      }
    } else if (op.type === "restore_tags") {
      for (const change of op.changed) {
        const item = Zotero.Items.get(change.itemID);
        if (!item) {
          continue;
        }
        item.setTags(change.before);
        await item.saveTx();
      }
    } else if (op.type === "trash_item") {
      const item = Zotero.Items.get(op.itemID);
      if (item) {
        await item.trashTx();
      }
    } else if (op.type === "detach_attachment_from_parent_item") {
      const attachment = Zotero.Items.get(op.attachmentItemID);
      if (attachment) {
        attachment.parentID = null;
        await attachment.saveTx();
        if (op.attachmentCollectionIDs && op.attachmentCollectionIDs.length) {
          await this.addItemToCollectionIDs(attachment.id, op.attachmentCollectionIDs);
        }
      }
      const parentItem = Zotero.Items.get(op.parentItemID);
      if (parentItem) {
        await parentItem.trashTx();
      }
    } else if (op.type === "restore_fields") {
      const item = Zotero.Items.get(op.itemID);
      if (item) {
        for (const [field, value] of Object.entries(op.before)) {
          item.setField(field, value);
        }
        if (Array.isArray(op.beforeCreators) && typeof item.setCreators === "function") {
          item.setCreators(this.normalizeCreators(op.beforeCreators));
        }
        await item.saveTx();
      }
    } else if (op.type === "restore_pref") {
      const branch = this.preferenceBranch();
      if (op.beforeHadUserValue === false && typeof branch.clearUserPref === "function") {
        branch.clearUserPref(op.prefName);
      } else {
        this.setPreferenceRaw(op.prefName, op.before);
      }
    } else if (op.type === "restore_trashed_items") {
      for (const id of op.itemIDs) {
        const item = Zotero.Items.get(id);
        if (item) {
          item.deleted = false;
          await item.saveTx();
        }
      }
    } else if (op.type === "delete_export_file") {
      try {
        if (typeof this.pathToLocalFile === "function") {
          const file = this.pathToLocalFile(op.path);
          if (file.exists()) {
            file.remove(false);
          }
        } else if (typeof IOUtils !== "undefined" && typeof IOUtils.remove === "function") {
          await IOUtils.remove(op.path);
        } else if (typeof OS !== "undefined" && OS.File && typeof OS.File.remove === "function") {
          await OS.File.remove(op.path);
        }
      } catch (error) {
        this.log("undo.delete_export_file_failed", { path: op.path, error: String(error) });
      }
    }
    this.log("undo.finished", op);
    if (this.task && this.task.libraryID) {
      this.markLibraryIndexDirty(this.task.libraryID);
    }
    this.renderAll();
  },

  getMainWindows() {
    const wins = [];
    const enumerator = Services.wm.getEnumerator("navigator:browser");
    while (enumerator.hasMoreElements()) {
      const win = enumerator.getNext();
      if (win && win.ZoteroPane) {
        wins.push(win);
      }
    }
    return wins;
  },

  removeFromWindow(win) {
    const state = this.windows.get(win);
    if (!state) {
      return;
    }
    if (state.onResize) {
      win.removeEventListener("resize", state.onResize);
      state.onResize = null;
    }
    this.uninstallSelectionAskShortcut(state);
    if (state.menuItem && state.menuItem.parentNode) {
      state.menuItem.parentNode.removeChild(state.menuItem);
    }
    if (state.uiOverlayRoot && state.uiOverlayRoot.parentNode) {
      state.uiOverlayRoot.parentNode.removeChild(state.uiOverlayRoot);
    }
    if (state.logPopupTimer) {
      win.clearTimeout(state.logPopupTimer);
    }
    if (state.prefPaneLocalizationTimer) {
      win.clearTimeout(state.prefPaneLocalizationTimer);
      state.prefPaneLocalizationTimer = null;
    }
    if (state.prefPaneLocalizationObserver) {
      state.prefPaneLocalizationObserver.disconnect();
      state.prefPaneLocalizationObserver = null;
    }
    if (state.approvalPopup && typeof state.approvalPopup.hidePopup === "function") {
      state.approvalPopup.hidePopup();
    }
    if (state.logPopup && typeof state.logPopup.hidePopup === "function") {
      state.logPopup.hidePopup();
    }
    if (state.popupHost && state.popupHost.parentNode) {
      state.popupHost.parentNode.removeChild(state.popupHost);
    }
    this.windows.delete(win);
  },

  registerNotifier() {
    if (this.notifierID || !Zotero.Notifier || !Zotero.Notifier.registerObserver) {
      return;
    }
    const observer = {
      notify: (event, type) => {
        if (INDEX_NOTIFIER_TYPES.includes(type)) {
          this.markAllIndexesDirty();
        }
      }
    };
    this.notifierID = Zotero.Notifier.registerObserver(observer, INDEX_NOTIFIER_TYPES, "zoteroAssistant");
  },

  unregisterNotifier() {
    if (this.notifierID && Zotero.Notifier && Zotero.Notifier.unregisterObserver) {
      Zotero.Notifier.unregisterObserver(this.notifierID);
      this.notifierID = null;
    }
  },

  async clearCurrentTask() {
    if (!this.task) {
      return;
    }
    this.log("task.context.cleared", {
      id: this.task.id,
      libraryID: this.task.libraryID,
      libraryName: this.task.libraryName
    });
    await this.safeUpdateSessionMemoryForTask("task_cleared");
    this.task = null;
    this.renderAll();
  },

  repairOrphanRunningTask() {
    if (!this.task || this.task.status !== "running") {
      return false;
    }
    if (this.taskLoopActive) {
      return false;
    }
    const stuckStarting = this.task.phase === "starting";
    this.task.status = "paused";
    this.task.phase = stuckStarting ? "stuck_starting" : "orphan_running";
    this.task.error = stuckStarting
      ? this.t("orphanStuckStarting")
      : this.t("orphanRunning");
    this.log("task.orphan_running_repaired", { id: this.task.id, phase: this.task.phase });
    return true;
  },

  unregisterPreferencePane() {
    if (this.prefPaneID && Zotero.PreferencePanes && Zotero.PreferencePanes.unregister) {
      Zotero.PreferencePanes.unregister(this.prefPaneID);
      this.prefPaneID = null;
    }
  },

  async registerPreferencePane() {
    if (!Zotero.PreferencePanes || !Zotero.PreferencePanes.register || this.prefPaneID) {
      return;
    }
    this.prefPaneID = await Zotero.PreferencePanes.register({
      pluginID: this.id,
      id: PREF_PANE_ID,
      src: this.rootURI + "chrome/content/preferences.xhtml",
      label: "Zotero Assistant",
      helpURL: "https://example.com/zotero-assistant"
    });
  }
};
})();
