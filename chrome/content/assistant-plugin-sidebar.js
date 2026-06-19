var ZoteroAssistantPluginSidebar = (() => {
  const {
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
  showSidebar(win) {
    const state = this.windows.get(win);
    this.setSidebarOpen(state, true);
    if (state && state.launcher) {
      state.launcher.style.setProperty("display", "none", "important");
    }
    if (state && state.chatOpen) {
      this.avoidSidebarOverlapForChat(state);
      this.applyChatBounds(state);
    }
  },

  hideSidebar(win) {
    const state = this.windows.get(win);
    this.setSidebarOpen(state, false);
    if (state && state.launcher) {
      state.launcher.style.setProperty("display", "flex", "important");
    }
    if (state && state.approvalPopup) {
      this.hidePopup(state.approvalPopup);
    }
    if (state && state.logPopup) {
      this.hidePopup(state.logPopup);
    }
    if (state && state.chatOpen) {
      this.avoidSidebarOverlapForChat(state);
      this.applyChatBounds(state);
    }
  },

  createHeader(doc, win) {
    const header = this.el(doc, "div", "zotero-assistant-header", "");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;position:relative;z-index:10004;pointer-events:auto;flex-shrink:0;";
    const brand = this.el(doc, "div", "za-brand", "");
    brand.appendChild(this.el(doc, "div", "za-brand-title", "Zotero 助手"));
    brand.appendChild(this.el(doc, "div", "za-brand-sub", "任务驱动 · 可撤销 · 需授权"));
    const actions = this.html(doc, "div");
    actions.style.cssText = "display:flex;align-items:center;gap:6px;flex-shrink:0;position:relative;z-index:10005;pointer-events:auto;";
    const hideBtn = this.actionButton(doc, "隐藏", "ghost", () => this.hideSidebar(win));
    hideBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.hideSidebar(win);
    }, true);
    actions.appendChild(this.actionButton(doc, "设置", "ghost", () => this.openPreferencesPane(win)));
    actions.appendChild(hideBtn);
    header.appendChild(brand);
    header.appendChild(actions);
    return header;
  },

  attachSidebar(win, container, state) {
    this.ensureUiOverlayRoot(state).appendChild(container);
  },

  createSidebar(win, state) {
    const doc = win.document;
    const container = this.html(doc, "div");
    container.id = "zotero-assistant-sidebar";
    container.style.cssText = [
      "box-sizing:border-box",
      "width:380px",
      "min-width:300px",
      "max-width:420px",
      "position:absolute",
      "top:0",
      "right:0",
      "bottom:0",
      "display:none",
      "flex-direction:column",
      "pointer-events:auto",
      "z-index:3",
      "overflow:hidden",
      "min-height:0"
    ].join(";");
    container.appendChild(this.createHeader(doc, win));

    const body = this.el(doc, "div", "zotero-assistant-body", "");
    body.style.cssText = "flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;";
    container.appendChild(body);

    state.statusNode = this.panel(doc, "任务状态");
    body.appendChild(state.statusNode);

    state.grantNode = this.panel(doc, "当前库权限");
    body.appendChild(state.grantNode);

    state.approvalsNode = this.panel(doc, "待授权操作");
    body.appendChild(state.approvalsNode);

    state.logNode = this.panel(doc, "执行日志");
    body.appendChild(state.logNode);

    const form = this.el(doc, "div", "zotero-assistant-form", "");
    const button = this.actionButton(doc, "打开聊天窗", "primary", () => this.showChatPanel(state));
    button.style.width = "100%";
    form.appendChild(button);
    container.appendChild(form);
    state.sendButton = button;

    this.attachSidebar(win, container, state);
    return container;
  },

  toggleSidebar(win) {
    const state = this.windows.get(win);
    if (!state || !state.container) {
      return;
    }
    if (this.isSidebarVisible(state)) {
      this.hideSidebar(win);
    } else {
      this.showSidebar(win);
    }
  },

  setSidebarOpen(state, open) {
    if (!state || !state.container) {
      return;
    }
    const el = state.container;
    if (open) {
      el.setAttribute("data-za-open", "1");
      el.style.setProperty("display", "flex", "important");
    } else {
      el.setAttribute("data-za-open", "0");
      el.style.setProperty("display", "none", "important");
    }
  },

  createLauncher(win, state) {
    const doc = win.document;
    const launcher = this.html(doc, "button");
    launcher.id = "zotero-assistant-launcher";
    launcher.type = "button";
    launcher.textContent = this.uiText("助手");
    launcher.style.cssText = [
      "position:absolute",
      "top:50%",
      "right:0",
      "transform:translateY(-50%)",
      "width:28px",
      "height:96px",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "writing-mode:vertical-rl",
      "text-orientation:mixed",
      "border:1px solid var(--material-border-color, #c9c9c9)",
      "border-right:none",
      "border-radius:10px 0 0 10px",
      "background:var(--material-background, #fff)",
      "color:var(--fill-primary, #1f1f1f)",
      "box-shadow:-6px 0 14px rgba(0, 0, 0, 0.12)",
      "z-index:2",
      "pointer-events:auto",
      "cursor:pointer",
      "padding:0",
      "font-size:12px"
    ].join(";");
    launcher.addEventListener("click", () => this.showSidebar(win));
    this.ensureUiOverlayRoot(state).appendChild(launcher);
    return launcher;
  },

  isSidebarVisible(state) {
    if (!state || !state.container) {
      return false;
    }
    return state.container.getAttribute("data-za-open") === "1";
  },

  addToolsMenuItem(win) {
    const doc = win.document;
    const toolsMenu = doc.getElementById("menu_ToolsPopup") || doc.getElementById("tools-menu-popup");
    if (!toolsMenu) {
      return null;
    }
    const item = doc.createXULElement ? doc.createXULElement("menuitem") : doc.createElement("menuitem");
    item.setAttribute("id", "zotero-assistant-tools-menu");
    item.setAttribute("label", this.uiText("Zotero 助手"));
    item.addEventListener("command", () => this.toggleChatPanelForWindow(win));
    toolsMenu.appendChild(item);
    return item;
  },

  listPreferencePanes(options = {}) {
    const pluginFilter = String(options.plugin_id || options.pluginID || "").trim().toLowerCase();
    const query = String(options.query || "").trim().toLowerCase();
    const limit = this.preferenceLimit(options.limit, 80);
    const panes = [];
    const pp = Zotero.PreferencePanes;
    const builtIn = pp && Array.isArray(pp.builtInPanes) ? pp.builtInPanes : [];
    const plugin = pp && Array.isArray(pp.pluginPanes) ? pp.pluginPanes : [];
    const push = (pane, source) => {
      if (!pane || !pane.id) {
        return;
      }
      if (pane.parent) {
        return;
      }
      const pluginID = pane.pluginID || (source === "builtin" ? "zotero@zotero.org" : "");
      if (pluginFilter && String(pluginID).toLowerCase() !== pluginFilter) {
        return;
      }
      const label = pane.rawLabel || pane.label || pane.id;
      const hay = `${pane.id} ${label} ${pluginID}`.toLowerCase();
      if (query && !hay.includes(query)) {
        return;
      }
      panes.push({
        id: pane.id,
        label: String(label),
        pluginID: pluginID || null,
        source,
        helpURL: pane.helpURL || null
      });
    };
    for (const pane of builtIn) {
      push(pane, "builtin");
    }
    for (const pane of plugin) {
      push(pane, "plugin");
    }
    panes.sort((a, b) => a.label.localeCompare(b.label, this.compareLocale()));
    return {
      panes: panes.slice(0, limit),
      count: Math.min(panes.length, limit),
      total: panes.length,
      defaultAssistantPaneId: PREF_PANE_ID,
      builtinExamples: [
        "zotero-prefpane-general",
        "zotero-prefpane-account",
        "zotero-prefpane-export",
        "zotero-prefpane-cite",
        "zotero-prefpane-advanced"
      ]
    };
  },

  openPreferencesPane(win) {
    this.openPreferencesPaneById(PREF_PANE_ID);
  },

  ensureUiOverlayRoot(state) {
    if (state.uiOverlayRoot && state.uiOverlayRoot.parentNode) {
      return state.uiOverlayRoot;
    }
    const doc = state.doc;
    const win = state.win;
    const root = this.html(doc, "div");
    root.id = "zotero-assistant-ui-root";
    root.setAttribute("data-za-overlay", "1");
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "width:100%",
      "height:100%",
      "margin:0",
      "padding:0",
      "border:none",
      "background:transparent",
      "pointer-events:none",
      "z-index:9997",
      "overflow:visible",
      "box-sizing:border-box"
    ].join(";");
    const parent = doc.body || doc.documentElement;
    parent.appendChild(root);
    state.uiOverlayRoot = root;
    return root;
  },

  openPreferencesPaneById(paneId, options = {}) {
    const resolved = this.resolvePreferencePaneId(paneId);
    if (!resolved.ok) {
      return resolved;
    }
    try {
      if (Zotero.Utilities && Zotero.Utilities.Internal && Zotero.Utilities.Internal.openPreferences) {
        const openOpts = {};
        if (options.scrollTo || options.scroll_to) {
          openOpts.scrollTo = options.scrollTo || options.scroll_to;
        }
        if (options.action) {
          openOpts.action = options.action;
        }
        Zotero.Utilities.Internal.openPreferences(resolved.id, openOpts);
      } else {
        return { ok: false, error: this.t("openPreferencesUnsupported") };
      }
    } catch (error) {
      Zotero.debug(`Zotero Assistant failed to open preferences: ${error}`);
      return { ok: false, error: String(error) };
    }
    this.schedulePreferencePaneLocalizationPass();
    return { ok: true, pane_id: resolved.id, label: resolved.label };
  },

  resolvePreferencePaneId(paneId) {
    const raw = String(paneId || "").trim();
    if (!raw) {
      return { ok: true, id: PREF_PANE_ID, label: "Zotero Assistant" };
    }
    const listed = this.listPreferencePanes({ limit: 500 });
    const match = (listed.panes || []).find((p) => p.id === raw);
    if (match) {
      return { ok: true, id: match.id, label: match.label };
    }
    return {
      ok: false,
      error: this.t("prefPaneMissing", { id: raw })
    };
  }
};
})();
