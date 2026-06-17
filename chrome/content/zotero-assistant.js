var ZoteroAssistant = (() => {
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const PREF_PREFIX = "extensions.zoteroAssistant.";
  const PREFS = {
    baseURL: PREF_PREFIX + "baseURL",
    apiKey: PREF_PREFIX + "apiKey",
    model: PREF_PREFIX + "model",
    apiMode: PREF_PREFIX + "apiMode",
    safetyMode: PREF_PREFIX + "safetyMode",
    debugMode: PREF_PREFIX + "debugMode",
    debugOutputDir: PREF_PREFIX + "debugOutputDir",
    rememberedApprovals: PREF_PREFIX + "rememberedApprovals",
    eventLog: PREF_PREFIX + "eventLog",
    braveSearchApiKey: PREF_PREFIX + "braveSearchApiKey",
    webSearchProvider: PREF_PREFIX + "webSearchProvider",
    sessionMemoryEnabled: PREF_PREFIX + "sessionMemoryEnabled",
    autoCompressionEnabled: PREF_PREFIX + "autoCompressionEnabled",
    contextCompressionTriggerChars: PREF_PREFIX + "contextCompressionTriggerChars",
    contextCompressionTargetChars: PREF_PREFIX + "contextCompressionTargetChars",
    contextCompressionKeepMessages: PREF_PREFIX + "contextCompressionKeepMessages",
    contextCompressionMaxTokens: PREF_PREFIX + "contextCompressionMaxTokens",
    contextCompressionTargetTokens: PREF_PREFIX + "contextCompressionTargetTokens"
  };

  const DEFAULT_BASE_URL = "https://api.openai.com/v1";
  const DEFAULT_MODEL = "gpt-4.1-mini";
  const DEFAULT_API_MODE = "auto";
  const DEFAULT_SAFETY_MODE = "review";
  const DEFAULT_SESSION_MEMORY_ENABLED = true;
  const DEFAULT_AUTO_COMPRESSION_ENABLED = true;
  const DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS = 80000;
  const DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS = 8000;
  const DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES = 12;
  const DEFAULT_CONTEXT_COMPRESSION_MAX_TOKENS = 128000;
  const DEFAULT_CONTEXT_COMPRESSION_TARGET_TOKENS = 16000;
  const CHARS_PER_TOKEN_ESTIMATE = 4;
  const DEFAULT_CONTEXT_COMPRESSION_TRIGGER_MESSAGES = 80;
  const CHAT_MINIMIZED_HEIGHT = 52;
  const CHAT_MIN_WIDTH = 300;
  const CHAT_MIN_HEIGHT = 280;
  const CHAT_DEFAULT_WIDTH = 420;
  const CHAT_DEFAULT_HEIGHT = 560;
  const MAX_CHAT_DISPLAY_LOG = 200;
  const MAX_CHAT_DISPLAY_CHARS = 24000;
  const COMPRESSED_CONTEXT_MARKER = "[Zotero Assistant compressed task context]";
  const PREF_PANE_ID = "zotero-prefpane-zotero-assistant";
  const LOG_RETENTION_DAYS = 30;
  const MAX_MODEL_RETRIES = 3;
  const MAX_MODEL_FETCH_MS = 180000;
  const MAX_COLLECTIONS_PER_TASK = 5;
  const MAX_ITEMS_PER_TASK = 100;
  const MAX_TASK_LOOPS = 50;
  const DEFAULT_BROWSE_PAGE_SIZE = 25;
  const MAX_BROWSE_PAGE_SIZE = 50;
  const FULLTEXT_PAGE_CHARS = 4000;
  const NOTE_PREVIEW_LENGTH = 160;
  const ABSTRACT_PREVIEW_LENGTH = 280;
  const MAX_OVERVIEW_TAGS = 20;
  const MAX_OVERVIEW_COLLECTIONS = 200;
  const MAX_LIVE_SEARCH_PER_TASK = 12;
  const LEGACY_WEB_SEARCH_TOOL = "web_search";
  const LIVE_SEARCH_TOOL = "live_search";
  const MAX_WEB_FETCH_PER_TASK = 15;
  const MAX_WEB_SEARCH_RESULTS = 10;
  const WEB_FETCH_TIMEOUT_MS = 30000;
  const WEB_FETCH_MAX_BYTES = 512000;
  const WEB_FETCH_MAX_CHARS = 60000;
  const DEBUG_TEXT_LIMIT = 16000;
  const DEBUG_MESSAGE_LIMIT = 6000;
  const DEBUG_MESSAGE_TAIL = 20;
  const COMPRESSION_MESSAGE_SERIALIZE_LIMIT = 24000;
  const MEMORY_MESSAGE_SERIALIZE_LIMIT = 1800;
  const MEMORY_RECENT_MESSAGE_LIMIT = 30;
  const DEFAULT_PREF_PAGE_SIZE = 50;
  const MAX_PREF_PAGE_SIZE = 200;
  const WEB_SEARCH_USER_AGENT = "Zotero-Assistant/0.3 (research; +https://example.com/zotero-assistant)";
  const INDEX_NOTIFIER_TYPES = ["item", "collection", "collection-item", "item-tag", "tag"];

  const SESSION_GRANT_TOOL = "request_expanded_context";

  const READ_TOOLS = new Set([
    "search_items",
    "read_current_context",
    "read_item_fields",
    "read_library_overview",
    "browse_library_items",
    "read_fulltext_page",
    "list_plugin_commands",
    "browse_preferences",
    "search_preferences",
    "read_preferences",
    "list_preference_panes",
    "open_zotero_preferences",
    "live_search",
    "web_fetch"
  ]);

  const LOW_RISK_WRITE_TOOLS = new Set([
    "create_collection",
    "add_tags",
    "create_note",
    "append_note",
    "add_items_to_collection"
  ]);

  const HIGH_RISK_WRITE_TOOLS = new Set([
    "create_parent_item",
    "update_metadata",
    "set_preference",
    "request_zotero_restart",
    "move_to_trash",
    "trigger_plugin_command"
  ]);

  const TOOL_DEFINITIONS = [
    {
      type: "function",
      function: {
        name: "request_clarification",
        description: "Ask the user for missing high-impact task information before taking action.",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string" },
            recommendedAnswer: { type: "string" }
          },
          required: ["question"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "search_items",
        description: "Search Zotero items by title, creator, year, or broad quick-search text.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number" }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_current_context",
        description: "Read current Zotero selection, current collection, and visible item summary.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "request_expanded_context",
        description: "Ask the user to allow session-scoped metadata access for the current active Zotero library.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string" },
            scope: { type: "string" }
          },
          required: ["reason", "scope"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_item_fields",
        description: "Read a Zotero item's full right-pane metadata fields, current values, and creators for targeted enrichment.",
        parameters: {
          type: "object",
          properties: {
            itemKey: { type: "string" }
          },
          required: ["itemKey"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_library_overview",
        description: "Read the current task library overview after session metadata access has been granted.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browse_library_items",
        description: "Browse library item metadata in pages after session metadata access has been granted.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            collectionKey: { type: "string" },
            includeDescendants: { type: "boolean" },
            tag: { type: "string" },
            creator: { type: "string" },
            year: { type: "string" },
            page: { type: "number" },
            pageSize: { type: "number" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_fulltext_page",
        description: "Read one page of full text for a single item or attachment. This is auto-approved but must be explicitly called.",
        parameters: {
          type: "object",
          properties: {
            itemKey: { type: "string" },
            cursor: { type: "string" }
          },
          required: ["itemKey"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "live_search",
        description: "Search the public web for recent information (live search). Returns titles, URLs, and snippets. Use for verifying facts, DOIs, publication metadata, or topics not in the Zotero library. Do not call web_search — that name is deprecated; use live_search only.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (min 2 characters)." },
            allowed_domains: {
              type: "array",
              items: { type: "string" },
              description: "If set, only include results from these domains (e.g. scholar.google.com)."
            },
            blocked_domains: {
              type: "array",
              items: { type: "string" },
              description: "Exclude results from these domains."
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "web_fetch",
        description: "Fetch a public HTTP(S) URL and return page content as markdown-like text (similar to Claude Code WebFetch). Optionally include a prompt describing what to extract; the returned body is for you to read and answer from. Do not use for authenticated or private URLs.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "HTTP or HTTPS URL to fetch." },
            prompt: {
              type: "string",
              description: "What you need from this page (e.g. 'Extract the publication date and abstract')."
            }
          },
          required: ["url", "prompt"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_collection",
        description: "Create a Zotero collection. A task may create at most five collections automatically.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            parentKey: { type: "string" }
          },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "add_items_to_collection",
        description: "Add items to a collection without removing them from existing collections.",
        parameters: {
          type: "object",
          properties: {
            collectionKey: { type: "string" },
            itemKeys: { type: "array", items: { type: "string" } }
          },
          required: ["collectionKey", "itemKeys"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "add_tags",
        description: "Add tags to Zotero items.",
        parameters: {
          type: "object",
          properties: {
            itemKeys: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } }
          },
          required: ["itemKeys", "tags"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_note",
        description: "Create a child note for an item.",
        parameters: {
          type: "object",
          properties: {
            parentItemKey: { type: "string" },
            html: { type: "string" }
          },
          required: ["parentItemKey", "html"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_parent_item",
        description: "Create a new regular Zotero parent item for a top-level attachment, optionally seed metadata, and move the attachment under the new parent item.",
        parameters: {
          type: "object",
          properties: {
            attachmentKey: { type: "string" },
            itemType: { type: "string", description: "Regular Zotero item type such as book, journalArticle, report, thesis, document, or webpage." },
            title: { type: "string" },
            fields: { type: "object" },
            creators: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  name: { type: "string" },
                  creatorType: { type: "string" }
                }
              }
            },
            copyCollections: { type: "boolean" },
            copyTags: { type: "boolean" }
          },
          required: ["attachmentKey", "itemType"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_metadata",
        description: "Update item metadata. This is high risk and requires approval outside fully open mode.",
        parameters: {
          type: "object",
          properties: {
            itemKey: { type: "string" },
            fields: { type: "object" },
            creators: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  name: { type: "string" },
                  creatorType: { type: "string" }
                }
              }
            }
          },
          required: ["itemKey"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "set_preference",
        description: "Set an existing non-sensitive Zotero or plugin preference. Do not use for API keys, tokens, passwords, or secrets.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: {},
            rememberPrefix: {
              type: "string",
              description: "Optional prefix to propose for session-scoped remembered approval, e.g. extensions.somePlugin."
            },
            reason: { type: "string" }
          },
          required: ["name", "value"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browse_preferences",
        description: "Browse Zotero and plugin preferences hierarchically by prefix. Start with an empty prefix, then drill into returned child prefixes.",
        parameters: {
          type: "object",
          properties: {
            prefix: { type: "string", description: "Prefix to browse, such as extensions. or extensions.zoteroAssistant. Empty means the allowed roots." },
            query: { type: "string", description: "Optional name/value search within this prefix." },
            limit: { type: "number" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "search_preferences",
        description: "Search Zotero and installed-plugin preferences by name or non-sensitive value.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            prefix: { type: "string" },
            limit: { type: "number" }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_preferences",
        description: "Read Zotero and installed-plugin preference metadata and current values. Sensitive values are masked and never returned.",
        parameters: {
          type: "object",
          properties: {
            names: { type: "array", items: { type: "string" } },
            prefix: { type: "string" },
            limit: { type: "number" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_preference_panes",
        description: "List Zotero built-in and installed-plugin preference panes (id, label, pluginID). Use the id with open_zotero_preferences.pane_id to open a specific page (e.g. another plugin's settings).",
        parameters: {
          type: "object",
          properties: {
            plugin_id: { type: "string", description: "Optional filter: only panes registered by this plugin ID (e.g. zotero-assistant@example.com)." },
            query: { type: "string", description: "Optional filter: case-insensitive match on pane label or id." },
            limit: { type: "number" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "open_zotero_preferences",
        description: "Open the Zotero preferences window. Omit pane_id for this assistant's pane, or pass pane_id from list_preference_panes (built-in or another plugin). Use for sensitive API keys or when the user should configure UI manually.",
        parameters: {
          type: "object",
          properties: {
            pane_id: { type: "string", description: "Preference pane id, e.g. zotero-prefpane-general or zotero-prefpane-zotero-assistant." },
            reason: { type: "string" },
            scroll_to: { type: "string", description: "Optional element id inside the pane to scroll to (Zotero navigateToPane scrollTo)." }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "request_zotero_restart",
        description: "Request explicit user authorization to restart Zotero after a setting change that needs restart.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string" }
          },
          required: ["reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "move_to_trash",
        description: "Move Zotero items to trash. Permanent deletion is never exposed.",
        parameters: {
          type: "object",
          properties: {
            itemKeys: { type: "array", items: { type: "string" } },
            reason: { type: "string" }
          },
          required: ["itemKeys", "reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_plugin_commands",
        description: "List discoverable Zotero and plugin menu commands that can be requested through trigger_plugin_command.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "trigger_plugin_command",
        description: "Trigger a discovered and specifically authorized plugin menu command.",
        parameters: {
          type: "object",
          properties: {
            commandId: { type: "string" },
            summary: { type: "string" }
          },
          required: ["commandId", "summary"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "finish_task",
        description: "End the task ONLY after you have explained results to the user in Chinese. summary is mandatory user-facing text (what you tell the user). If you have not sent any other user-visible message this task, summary must be a full explanation (not just '完成').",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Required Chinese message to the user: what was done, results, and next steps." }
          },
          required: ["summary"]
        }
      }
    }
  ];

  function create(data) {
    return new AssistantPlugin(data);
  }

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
    }

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
    }

    shutdown() {
      for (const win of Array.from(this.windows.keys())) {
        this.removeFromWindow(win);
      }
      this.unregisterNotifier();
      this.unregisterPreferencePane();
      this.persistLog();
    }

    ensurePrefs() {
      this.setDefault(PREFS.baseURL, DEFAULT_BASE_URL);
      this.setDefault(PREFS.model, DEFAULT_MODEL);
      this.setDefault(PREFS.apiMode, DEFAULT_API_MODE);
      this.setDefault(PREFS.apiKey, "");
      this.setDefault(PREFS.safetyMode, DEFAULT_SAFETY_MODE);
      this.setDefault(PREFS.debugMode, false);
      this.setDefault(PREFS.debugOutputDir, "");
      this.setDefault(PREFS.rememberedApprovals, "{}");
      this.setDefault(PREFS.eventLog, "[]");
      this.setDefault(PREFS.braveSearchApiKey, "");
      this.setDefault(PREFS.webSearchProvider, "auto");
      this.setDefault(PREFS.sessionMemoryEnabled, DEFAULT_SESSION_MEMORY_ENABLED);
      this.setDefault(PREFS.autoCompressionEnabled, DEFAULT_AUTO_COMPRESSION_ENABLED);
      this.setDefault(PREFS.contextCompressionTriggerChars, DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS);
      this.setDefault(PREFS.contextCompressionTargetChars, DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS);
      this.setDefault(PREFS.contextCompressionKeepMessages, DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES);
      this.setDefault(PREFS.contextCompressionMaxTokens, DEFAULT_CONTEXT_COMPRESSION_MAX_TOKENS);
      this.setDefault(PREFS.contextCompressionTargetTokens, DEFAULT_CONTEXT_COMPRESSION_TARGET_TOKENS);
    }

    setDefault(name, value) {
      try {
        if (Zotero.Prefs.get(name, true) === undefined) {
          Zotero.Prefs.set(name, value, true);
        }
      } catch (error) {
        Zotero.debug(`Zotero Assistant failed to set pref ${name}: ${error}`);
      }
    }

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

    unregisterPreferencePane() {
      if (this.prefPaneID && Zotero.PreferencePanes && Zotero.PreferencePanes.unregister) {
        Zotero.PreferencePanes.unregister(this.prefPaneID);
        this.prefPaneID = null;
      }
    }

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
    }

    unregisterNotifier() {
      if (this.notifierID && Zotero.Notifier && Zotero.Notifier.unregisterObserver) {
        Zotero.Notifier.unregisterObserver(this.notifierID);
        this.notifierID = null;
      }
    }

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
    }

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
        chatNotice: "",
        chatDragging: null,
        uiOverlayRoot: null,
        onResize: null,
        popupHost: null,
        approvalPopup: null,
        logPopup: null,
        logPopupTimer: null,
        lastLogPopupKey: "",
        inputNode: null,
        sendButton: null
      };
      state.menuItem = this.addToolsMenuItem(win);
      this.ensureUiOverlayRoot(state);
      state.launcher = this.createLauncher(win, state);
      state.container = this.createSidebar(win, state);
      state.chatLauncher = this.createChatLauncher(win, state);
      state.chatPanel = this.createChatPanel(win, state);
      state.onResize = () => {
        if (!state.chatOpen || !state.chatBounds) {
          return;
        }
        state.chatBounds = this.clampChatBounds(state, state.chatBounds);
        this.avoidSidebarOverlapForChat(state);
        this.applyChatBounds(state);
      };
      win.addEventListener("resize", state.onResize);
      this.windows.set(win, state);
      this.render(state);
    }

    removeFromWindow(win) {
      const state = this.windows.get(win);
      if (!state) {
        return;
      }
      if (state.onResize) {
        win.removeEventListener("resize", state.onResize);
        state.onResize = null;
      }
      if (state.menuItem && state.menuItem.parentNode) {
        state.menuItem.parentNode.removeChild(state.menuItem);
      }
      if (state.uiOverlayRoot && state.uiOverlayRoot.parentNode) {
        state.uiOverlayRoot.parentNode.removeChild(state.uiOverlayRoot);
      }
      if (state.logPopupTimer) {
        win.clearTimeout(state.logPopupTimer);
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
    }

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
    }

    addToolsMenuItem(win) {
      const doc = win.document;
      const toolsMenu = doc.getElementById("menu_ToolsPopup") || doc.getElementById("tools-menu-popup");
      if (!toolsMenu) {
        return null;
      }
      const item = doc.createXULElement ? doc.createXULElement("menuitem") : doc.createElement("menuitem");
      item.setAttribute("id", "zotero-assistant-tools-menu");
      item.setAttribute("label", "Zotero 助手");
      item.addEventListener("command", () => this.toggleSidebar(win));
      toolsMenu.appendChild(item);
      return item;
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

    hideChatPanel(state) {
      if (!state || !state.chatPanel) {
        return;
      }
      state.chatOpen = false;
      state.chatPanel.style.setProperty("display", "none", "important");
      if (state.chatLauncher) {
        state.chatLauncher.style.setProperty("display", "flex", "important");
      }
    }

    toggleMinimizeChatPanel(state) {
      if (!state || !state.chatPanel) {
        return;
      }
      state.chatMinimized = !state.chatMinimized;
      this.applyChatBounds(state);
      this.renderChatPanel(state);
    }

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
    }

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
    }

    looksLikeMarkdown(text) {
      const source = String(text || "");
      if (!source.trim()) {
        return false;
      }
      return /```|(^|\n)\s*#{1,6}\s|(^|\n)\s*[-*]\s|(^|\n)\s*\d+\.\s|\*\*|__|\[.+?\]\(https?:\/\//m.test(source);
    }

    fillChatBubbleContent(bubble, text, isUser) {
      const body = String(text || "");
      const useMd = !isUser || this.looksLikeMarkdown(body);
      const content = this.el(bubble.ownerDocument, "div", useMd ? "za-chat-bubble-text za-markdown" : "za-chat-bubble-text", "");
      if (useMd) {
        content.style.whiteSpace = "normal";
        this.renderMarkdownInto(content, body);
      } else {
        content.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;";
        content.textContent = body;
      }
      bubble.appendChild(content);
    }

    createLauncher(win, state) {
      const doc = win.document;
      const launcher = this.html(doc, "button");
      launcher.id = "zotero-assistant-launcher";
      launcher.type = "button";
      launcher.textContent = "助手";
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
    }

    attachSidebar(win, container, state) {
      this.ensureUiOverlayRoot(state).appendChild(container);
    }

    isSidebarVisible(state) {
      if (!state || !state.container) {
        return false;
      }
      return state.container.getAttribute("data-za-open") === "1";
    }

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
    }

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
    }

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
    }

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
    }

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
      panes.sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
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
    }

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
        error: `未找到设置面板 id「${raw}」。请先调用 list_preference_panes 查看已注册的 pane id。`
      };
    }

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
          return { ok: false, error: "当前 Zotero 环境不支持 openPreferences。" };
        }
      } catch (error) {
        Zotero.debug(`Zotero Assistant failed to open preferences: ${error}`);
        return { ok: false, error: String(error) };
      }
      return { ok: true, pane_id: resolved.id, label: resolved.label };
    }

    openPreferencesPane(win) {
      this.openPreferencesPaneById(PREF_PANE_ID);
    }

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
    }

    panel(doc, title) {
      const panel = this.el(doc, "section", "zotero-assistant-panel", "");
      const header = this.el(doc, "div", "za-panel-header", title);
      const body = this.el(doc, "div", "zotero-assistant-panel-body", "");
      panel.appendChild(header);
      panel.appendChild(body);
      return panel;
    }

    el(doc, tag, className, text) {
      const node = this.html(doc, tag);
      if (className) {
        node.className = className;
      }
      if (text) {
        node.textContent = text;
      }
      return node;
    }

    html(doc, tag) {
      return doc.createElementNS(HTML_NS, tag);
    }

    ensureGlobalStyles(doc) {
      const STYLE_ID = "zotero-assistant-global-styles";
      const STYLE_REV = "za-chat-ui-md-resize-20260617";
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
      style.textContent = `
#zotero-assistant-ui-root,
#zotero-assistant-ui-root * {
  box-sizing: border-box;
}
#zotero-assistant-ui-root {
  --za-bg: #f4f6f9;
  --za-surface: #ffffff;
  --za-surface-muted: #f8fafc;
  --za-border: rgba(15, 23, 42, 0.10);
  --za-border-strong: rgba(15, 23, 42, 0.14);
  --za-text: #0f172a;
  --za-text-muted: #64748b;
  --za-accent: #c45c26;
  --za-accent-hover: #a84d1f;
  --za-accent-soft: rgba(196, 92, 38, 0.12);
  --za-radius: 12px;
  --za-radius-sm: 8px;
  --za-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08);
  --za-font: system-ui, "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif;
}
#zotero-assistant-sidebar {
  display: flex !important;
  flex-direction: column !important;
  min-width: 0 !important;
  font-family: var(--za-font) !important;
  background: var(--za-bg) !important;
  color: var(--za-text) !important;
  border-left: 1px solid var(--za-border-strong) !important;
  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.10) !important;
}
#zotero-assistant-sidebar .zotero-assistant-header {
  flex: 0 0 auto !important;
  padding: 14px 16px !important;
  border-bottom: 1px solid var(--za-border) !important;
  background: linear-gradient(180deg, var(--za-surface) 0%, var(--za-surface-muted) 100%) !important;
}
#zotero-assistant-sidebar .za-brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
#zotero-assistant-sidebar .za-brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.2;
}
#zotero-assistant-sidebar .za-brand-sub {
  font-size: 11px;
  color: var(--za-text-muted);
  font-weight: 500;
}
#zotero-assistant-sidebar .zotero-assistant-body {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  padding: 12px 14px 16px !important;
  display: block !important;
}
#zotero-assistant-sidebar .zotero-assistant-panel {
  border: 1px solid var(--za-border) !important;
  border-radius: var(--za-radius) !important;
  background: var(--za-surface) !important;
  box-shadow: var(--za-shadow) !important;
  overflow: visible !important;
  min-width: 0 !important;
  height: auto !important;
  max-height: none !important;
  margin-bottom: 12px !important;
}
#zotero-assistant-sidebar .zotero-assistant-panel:last-child {
  margin-bottom: 0 !important;
}
#zotero-assistant-sidebar .za-panel-header {
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.02em;
  color: var(--za-text-muted) !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid var(--za-border) !important;
  background: var(--za-surface-muted) !important;
  flex: 0 0 auto !important;
}
#zotero-assistant-sidebar .zotero-assistant-panel-body {
  padding: 12px !important;
  font-size: 13px !important;
  line-height: 1.55 !important;
  min-width: 0 !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  word-wrap: break-word !important;
  overflow-wrap: anywhere !important;
  white-space: normal !important;
}
#zotero-assistant-sidebar .zotero-assistant-form {
  flex: 0 0 auto !important;
  border-top: 1px solid var(--za-border) !important;
  padding: 12px 14px 14px !important;
  background: var(--za-surface) !important;
  flex-direction: column !important;
  gap: 10px !important;
  display: flex !important;
}
#zotero-assistant-sidebar .zotero-assistant-form textarea {
  border: 1px solid var(--za-border-strong) !important;
  border-radius: var(--za-radius-sm) !important;
  padding: 10px 12px !important;
  font-family: var(--za-font) !important;
  font-size: 13px !important;
  line-height: 1.5 !important;
  background: var(--za-surface-muted) !important;
  color: var(--za-text) !important;
  min-height: 72px !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
#zotero-assistant-sidebar .zotero-assistant-form textarea:focus {
  outline: none !important;
  border-color: var(--za-accent) !important;
  box-shadow: 0 0 0 3px var(--za-accent-soft) !important;
  background: var(--za-surface) !important;
}
#zotero-assistant-chat-launcher {
  position: fixed !important;
  right: 24px !important;
  bottom: 24px !important;
  width: 54px !important;
  height: 54px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(196, 92, 38, 0.40) !important;
  background: #c45c26 !important;
  color: #ffffff !important;
  box-shadow: 0 14px 34px rgba(196, 92, 38, 0.34) !important;
  z-index: 9997 !important;
  cursor: pointer !important;
  font-family: var(--za-font, system-ui, sans-serif) !important;
  font-size: 15px !important;
  font-weight: 800 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
#zotero-assistant-chat-launcher:hover {
  background: #a84d1f !important;
}
#zotero-assistant-chat-panel {
  position: absolute !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  border: 1px solid #d8dde6 !important;
  border-radius: 12px !important;
  background: #ffffff !important;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.16) !important;
  overflow: hidden !important;
  z-index: 5 !important;
  pointer-events: auto !important;
}
#zotero-assistant-chat-panel .za-floating-chat-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid var(--za-border) !important;
  background: #f0f2f5 !important;
  cursor: move !important;
  flex: 0 0 auto !important;
}
#zotero-assistant-chat-panel .za-floating-chat-title-wrap {
  display: flex !important;
  flex-direction: column !important;
  min-width: 0 !important;
}
#zotero-assistant-chat-panel .za-floating-chat-title {
  font-size: 13px !important;
  font-weight: 800 !important;
  color: var(--za-text) !important;
  line-height: 1.2 !important;
}
#zotero-assistant-chat-panel .za-floating-chat-subtitle {
  color: var(--za-text-muted) !important;
  font-size: 11px !important;
  margin-top: 2px !important;
}
#zotero-assistant-chat-panel .za-floating-chat-actions {
  display: flex !important;
  gap: 6px !important;
  flex: 0 0 auto !important;
}
#zotero-assistant-chat-panel .za-floating-chat-actions .za-btn {
  min-height: 26px !important;
  padding: 4px 10px !important;
  font-size: 11px !important;
}
#zotero-assistant-chat-panel .za-floating-chat-messages {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  padding: 14px 12px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  background: #e9ebef !important;
}
#zotero-assistant-chat-panel .za-floating-chat-approval {
  flex: 0 0 auto !important;
  padding: 0 12px 10px !important;
}
#zotero-assistant-chat-panel .za-floating-chat-footer {
  flex: 0 0 auto !important;
  display: flex !important;
  gap: 8px !important;
  align-items: flex-end !important;
  padding: 10px 12px 12px !important;
  border-top: 1px solid var(--za-border) !important;
  background: #ffffff !important;
}
#zotero-assistant-chat-panel .za-floating-chat-footer textarea {
  flex: 1 1 auto !important;
  resize: none !important;
  min-height: 46px !important;
  max-height: 96px !important;
  border: 1px solid var(--za-border-strong) !important;
  border-radius: 12px !important;
  padding: 9px 10px !important;
  font-family: var(--za-font) !important;
  font-size: 13px !important;
  line-height: 1.45 !important;
  background: #f8fafc !important;
  color: var(--za-text) !important;
}
#zotero-assistant-chat-panel .za-floating-chat-footer textarea:focus {
  outline: none !important;
  border-color: var(--za-accent) !important;
  box-shadow: 0 0 0 3px var(--za-accent-soft) !important;
  background: #ffffff !important;
}
#zotero-assistant-chat-panel .za-chat-row {
  display: flex !important;
  align-items: flex-start !important;
  gap: 8px !important;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}
#zotero-assistant-chat-panel .za-chat-row-user {
  flex-direction: row !important;
  justify-content: flex-end !important;
}
#zotero-assistant-chat-panel .za-chat-row-ai {
  flex-direction: row !important;
  justify-content: flex-start !important;
}
#zotero-assistant-chat-panel .za-chat-avatar {
  flex: 0 0 36px !important;
  width: 36px !important;
  height: 36px !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  line-height: 1 !important;
  user-select: none !important;
}
#zotero-assistant-chat-panel .za-chat-avatar-ai {
  background: #4a90d9 !important;
  color: #ffffff !important;
}
#zotero-assistant-chat-panel .za-chat-avatar-user {
  background: #c45c26 !important;
  color: #ffffff !important;
}
#zotero-assistant-chat-panel .za-chat-stack {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
  min-width: 0 !important;
  max-width: calc(100% - 52px) !important;
}
#zotero-assistant-chat-panel .za-chat-row-user .za-chat-stack {
  align-items: flex-end !important;
}
#zotero-assistant-chat-panel .za-chat-row-ai .za-chat-stack {
  align-items: flex-start !important;
}
#zotero-assistant-chat-panel .za-chat-name {
  font-size: 11px !important;
  font-weight: 600 !important;
  color: #8a8f99 !important;
  line-height: 1.2 !important;
  padding: 0 4px !important;
}
#zotero-assistant-chat-panel .za-chat-bubble {
  max-width: 100% !important;
  border-radius: 10px !important;
  padding: 9px 12px !important;
  font-size: 13px !important;
  line-height: 1.5 !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06) !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-user {
  background: #95ec69 !important;
  color: #111827 !important;
  border-bottom-right-radius: 3px !important;
}
@keyframes za-chat-typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-5px); opacity: 1; }
}
#zotero-assistant-chat-panel .za-chat-typing-dots {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 2px 0 !important;
}
#zotero-assistant-chat-panel .za-chat-typing-dots span {
  width: 7px !important;
  height: 7px !important;
  border-radius: 50% !important;
  background: #94a3b8 !important;
  animation: za-chat-typing-bounce 1.2s ease-in-out infinite !important;
}
#zotero-assistant-chat-panel .za-chat-typing-dots span:nth-child(2) {
  animation-delay: 0.15s !important;
}
#zotero-assistant-chat-panel .za-chat-typing-dots span:nth-child(3) {
  animation-delay: 0.3s !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-typing {
  background: #ffffff !important;
  border: 1px solid #e2e5ea !important;
  min-width: 52px !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-ai {
  background: #ffffff !important;
  color: #111827 !important;
  border: 1px solid #e2e5ea !important;
  border-bottom-left-radius: 3px !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown {
  font-size: 13px;
  line-height: 1.5;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown p {
  margin: 0 0 6px 0 !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown p:last-child {
  margin-bottom: 0 !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown pre {
  margin: 0 0 6px 0 !important;
  background: #0f172a !important;
  color: #e2e8f0 !important;
  border-radius: 8px !important;
  padding: 8px 10px !important;
  font-size: 11px !important;
  overflow-x: auto !important;
  max-width: 100% !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown code {
  background: rgba(15, 23, 42, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown ul,
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown ol {
  margin: 0 0 6px 0 !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown a {
  color: #2563eb;
  font-weight: 600;
}
#zotero-assistant-chat-panel .za-chat-resize-handle {
  position: absolute !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 18px !important;
  height: 18px !important;
  cursor: nwse-resize !important;
  z-index: 6 !important;
  background: linear-gradient(135deg, transparent 50%, rgba(100,116,139,0.35) 50%) !important;
  border-bottom-right-radius: 12px !important;
}
#zotero-assistant-chat-panel .za-chat-notice,
#zotero-assistant-chat-panel .za-chat-empty {
  align-self: center !important;
  max-width: 92% !important;
  border-radius: 999px !important;
  padding: 6px 10px !important;
  font-size: 11px !important;
  color: #64748b !important;
  background: rgba(100, 116, 139, 0.10) !important;
}
#zotero-assistant-chat-panel .za-chat-approval-card {
  border: 1px solid rgba(245, 158, 11, 0.28) !important;
  border-radius: 14px !important;
  background: #fffbeb !important;
  padding: 10px !important;
  font-size: 12px !important;
  line-height: 1.45 !important;
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.12) !important;
}
#zotero-assistant-launcher {
  font-family: var(--za-font, system-ui, sans-serif) !important;
  font-weight: 700 !important;
  font-size: 11px !important;
  letter-spacing: 0.08em;
  color: var(--za-text, #0f172a) !important;
  background: linear-gradient(135deg, #fff 0%, #f8fafc 100%) !important;
  border: 1px solid rgba(196, 92, 38, 0.35) !important;
  box-shadow: -8px 0 24px rgba(196, 92, 38, 0.15) !important;
}
#zotero-assistant-launcher:hover {
  background: linear-gradient(135deg, #fff7ed 0%, #fff 100%) !important;
  border-color: var(--za-accent, #c45c26) !important;
}
#zotero-assistant-sidebar .za-btn,
#zotero-assistant-chat-panel .za-btn,
#zotero-assistant-approval-popup .za-btn,
#zotero-assistant-log-popup .za-btn {
  font-family: system-ui, "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  border-radius: 999px !important;
  padding: 7px 14px !important;
  cursor: pointer !important;
  border: 1px solid transparent !important;
  line-height: 1.35 !important;
  min-height: 32px !important;
  -moz-appearance: none !important;
  appearance: none !important;
  display: inline-block !important;
  box-sizing: border-box !important;
}
#zotero-assistant-sidebar .za-btn:active,
#zotero-assistant-chat-panel .za-btn:active,
#zotero-assistant-approval-popup .za-btn:active,
#zotero-assistant-log-popup .za-btn:active { transform: scale(0.98); }
#zotero-assistant-sidebar .za-btn:disabled,
#zotero-assistant-chat-panel .za-btn:disabled,
#zotero-assistant-approval-popup .za-btn:disabled,
#zotero-assistant-log-popup .za-btn:disabled { opacity: 0.45; cursor: not-allowed; }
#zotero-assistant-sidebar .za-btn-ghost,
#zotero-assistant-chat-panel .za-btn-ghost,
#zotero-assistant-approval-popup .za-btn-ghost,
#zotero-assistant-log-popup .za-btn-ghost {
  background: #ffffff !important;
  border-color: rgba(15, 23, 42, 0.14) !important;
  color: #64748b !important;
}
#zotero-assistant-sidebar .za-btn-primary,
#zotero-assistant-chat-panel .za-btn-primary,
#zotero-assistant-approval-popup .za-btn-primary,
#zotero-assistant-log-popup .za-btn-primary {
  background: #c45c26 !important;
  color: #ffffff !important;
  border-color: #c45c26 !important;
  box-shadow: 0 4px 14px rgba(196, 92, 38, 0.28);
}
#zotero-assistant-sidebar .za-btn-secondary,
#zotero-assistant-chat-panel .za-btn-secondary,
#zotero-assistant-approval-popup .za-btn-secondary,
#zotero-assistant-log-popup .za-btn-secondary {
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: rgba(15, 23, 42, 0.14) !important;
}
.za-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.za-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.za-pill-running { background: rgba(59, 130, 246, 0.14); color: #1d4ed8; }
.za-pill-waiting { background: rgba(245, 158, 11, 0.16); color: #b45309; }
.za-pill-paused { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
.za-pill-complete { background: rgba(34, 197, 94, 0.14); color: #15803d; }
.za-pill-idle { background: rgba(100, 116, 139, 0.12); color: #475569; }
.za-muted { color: var(--za-text-muted); font-size: 12px; }
.za-error {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: var(--za-radius-sm);
  background: rgba(254, 242, 242, 0.9);
  border: 1px solid rgba(239, 68, 68, 0.22);
  color: #991b1b;
  font-size: 12px;
  white-space: pre-wrap;
}
.za-empty {
  color: var(--za-text-muted);
  font-size: 12px;
  font-style: italic;
}
.za-log-line {
  padding: 8px 0;
  border-bottom: 1px solid var(--za-border);
  font-size: 11px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  color: var(--za-text-muted);
}
.za-log-line:last-of-type { border-bottom: none; }
.za-log-type { color: var(--za-text); font-weight: 600; }
.za-grant-on { color: #15803d; font-weight: 600; }
.za-grant-off { color: #b45309; font-weight: 600; }
#zotero-assistant-sidebar details {
  margin-top: 8px;
  border: 1px solid var(--za-border);
  border-radius: var(--za-radius-sm);
  padding: 8px 10px;
  background: var(--za-surface-muted);
}
#zotero-assistant-sidebar details summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
}
#zotero-assistant-sidebar details pre {
  margin: 8px 0 0;
  font-size: 11px;
  max-height: none;
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
}
#zotero-assistant-sidebar .za-markdown pre {
  margin: 0 0 8px;
  background: #0f172a !important;
  color: #e2e8f0 !important;
  border: none !important;
  border-radius: var(--za-radius-sm) !important;
  padding: 10px 12px !important;
  font-size: 11px !important;
}
#zotero-assistant-sidebar .za-markdown code {
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}
#zotero-assistant-sidebar .za-markdown a {
  color: var(--za-accent);
  font-weight: 600;
}
`;
      (doc.head || doc.documentElement).appendChild(style);
    }

    actionButton(doc, label, variant, onClick) {
      const button = this.html(doc, "button");
      button.type = "button";
      const text = String(label == null ? "" : label);
      button.textContent = text;
      button.setAttribute("aria-label", text);
      button.className = `za-btn za-btn-${variant || "secondary"}`;
      this.applyButtonInlineStyle(button, variant || "secondary");
      if (onClick) {
        button.addEventListener("click", onClick);
      }
      return button;
    }

    applyButtonInlineStyle(button, variant) {
      const base = [
        "font-family:system-ui,'Segoe UI','Microsoft YaHei UI','PingFang SC',sans-serif",
        "font-size:12px",
        "font-weight:600",
        "border-radius:999px",
        "padding:7px 14px",
        "cursor:pointer",
        "line-height:1.35",
        "min-height:32px",
        "-moz-appearance:none",
        "appearance:none",
        "display:inline-block",
        "box-sizing:border-box"
      ].join(";");
      const styles = {
        primary: `${base};background:#c45c26;color:#ffffff;border:1px solid #c45c26;`,
        secondary: `${base};background:#ffffff;color:#0f172a;border:1px solid rgba(15,23,42,0.14);`,
        ghost: `${base};background:#ffffff;color:#64748b;border:1px solid rgba(15,23,42,0.14);`
      };
      button.style.cssText = styles[variant] || styles.secondary;
    }

    statusPillClass(status) {
      const map = {
        running: "za-pill-running",
        waiting: "za-pill-waiting",
        paused: "za-pill-paused",
        complete: "za-pill-complete"
      };
      return map[status] || "za-pill-idle";
    }

    toastPalette(tone) {
      const palettes = {
        info: {
          background: "rgba(255, 255, 255, 0.96)",
          border: "rgba(59, 130, 246, 0.26)",
          accent: "#2563eb",
          shadow: "0 16px 34px rgba(37, 99, 235, 0.18)"
        },
        success: {
          background: "rgba(255, 255, 255, 0.96)",
          border: "rgba(34, 197, 94, 0.24)",
          accent: "#16a34a",
          shadow: "0 16px 34px rgba(22, 163, 74, 0.16)"
        },
        warning: {
          background: "rgba(255, 251, 235, 0.98)",
          border: "rgba(245, 158, 11, 0.34)",
          accent: "#d97706",
          shadow: "0 16px 34px rgba(245, 158, 11, 0.18)"
        },
        danger: {
          background: "rgba(255, 250, 250, 0.98)",
          border: "rgba(239, 68, 68, 0.30)",
          accent: "#dc2626",
          shadow: "0 16px 34px rgba(220, 38, 38, 0.18)"
        },
        neutral: {
          background: "rgba(255, 255, 255, 0.96)",
          border: "rgba(148, 163, 184, 0.26)",
          accent: "#64748b",
          shadow: "0 14px 30px rgba(15, 23, 42, 0.12)"
        }
      };
      return palettes[tone] || palettes.neutral;
    }

    toastButton(doc, label, kind, onClick) {
      const variant = kind === "primary" ? "primary" : "secondary";
      const button = this.actionButton(doc, label, variant, onClick);
      if (kind === "primary") {
        button.style.boxShadow = "0 4px 14px rgba(196, 92, 38, 0.28)";
      }
      if (kind === "danger") {
        this.applyButtonInlineStyle(button, "secondary");
        button.style.color = "#b91c1c";
        button.style.borderColor = "rgba(239,68,68,0.28)";
        button.style.background = "rgba(254,242,242,0.96)";
      }
      return button;
    }

    createToast(doc, options = {}) {
      const palette = this.toastPalette(options.tone);
      const toast = this.html(doc, "div");
      toast.style.cssText = [
        "pointer-events:auto",
        "display:flex",
        "flex-direction:column",
        "gap:8px",
        "min-width:220px",
        `max-width:${options.wide ? "100%" : "320px"}`,
        "padding:10px 12px",
        "border-radius:16px",
        `background:${palette.background}`,
        `border:1px solid ${palette.border}`,
        `box-shadow:${palette.shadow}`,
        "backdrop-filter:blur(10px)",
        "overflow:hidden"
      ].join(";");

      const accent = this.html(doc, "div");
      accent.style.cssText = `height:3px;background:${palette.accent};margin:-10px -12px 0 -12px;`;
      toast.appendChild(accent);

      const header = this.html(doc, "div");
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;";
      const titleWrap = this.html(doc, "div");
      titleWrap.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;";

      if (options.badge) {
        const badge = this.html(doc, "span");
        badge.textContent = options.badge;
        badge.style.cssText = [
          "display:inline-flex",
          "align-items:center",
          "padding:2px 8px",
          "border-radius:999px",
          "font-size:11px",
          "font-weight:700",
          `background:${palette.accent}`,
          "color:#fff",
          "flex:0 0 auto"
        ].join(";");
        titleWrap.appendChild(badge);
      }

      if (options.title) {
        const title = this.html(doc, "div");
        title.textContent = options.title;
        title.style.cssText = "font-weight:700;line-height:1.35;min-width:0;";
        titleWrap.appendChild(title);
      }
      header.appendChild(titleWrap);

      if (options.meta) {
        const meta = this.html(doc, "div");
        meta.textContent = options.meta;
        meta.style.cssText = "font-size:11px;opacity:0.72;white-space:nowrap;flex:0 0 auto;";
        header.appendChild(meta);
      }
      toast.appendChild(header);

      if (options.detail) {
        const detail = this.html(doc, "div");
        detail.textContent = options.detail;
        detail.style.cssText = "white-space:pre-wrap;line-height:1.45;";
        toast.appendChild(detail);
      }

      if (options.node) {
        toast.appendChild(options.node);
      }

      return toast;
    }

    animateToast(node, key) {
      if (!node || !node.animate || !key || this.shownToastKeys.has(key)) {
        return;
      }
      this.shownToastKeys.add(key);
      node.animate([
        { opacity: 0, transform: "translateY(10px) scale(0.98)" },
        { opacity: 1, transform: "translateY(0) scale(1)" }
      ], {
        duration: 180,
        easing: "ease-out"
      });
    }

    truncateText(value, limit = 180) {
      const text = String(value || "").trim();
      if (!text) {
        return "";
      }
      return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
    }

    isDebugModeEnabled() {
      return !!Zotero.Prefs.get(PREFS.debugMode, true);
    }

    isSessionMemoryEnabled() {
      return Zotero.Prefs.get(PREFS.sessionMemoryEnabled, true) !== false;
    }

    isAutoCompressionEnabled() {
      return Zotero.Prefs.get(PREFS.autoCompressionEnabled, true) !== false;
    }

    boundedIntPref(name, fallback, min, max) {
      const raw = Zotero.Prefs.get(name, true);
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        return fallback;
      }
      return Math.max(min, Math.min(max, Math.floor(value)));
    }

    contextCompressionTriggerChars() {
      return this.boundedIntPref(PREFS.contextCompressionTriggerChars, DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS, 10000, 500000);
    }

    contextCompressionTargetChars() {
      return this.boundedIntPref(PREFS.contextCompressionTargetChars, DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS, 1000, 50000);
    }

    contextCompressionKeepMessages() {
      return this.boundedIntPref(PREFS.contextCompressionKeepMessages, DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES, 4, 80);
    }

    contextCompressionMaxTokens() {
      const direct = this.boundedIntPref(PREFS.contextCompressionMaxTokens, 0, 0, 2000000);
      if (direct > 0) {
        return direct;
      }
      const legacyChars = this.boundedIntPref(PREFS.contextCompressionTriggerChars, DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS, 10000, 500000);
      return Math.max(8000, Math.floor(legacyChars / CHARS_PER_TOKEN_ESTIMATE));
    }

    contextCompressionTargetTokens() {
      const direct = this.boundedIntPref(PREFS.contextCompressionTargetTokens, 0, 0, 500000);
      if (direct > 0) {
        return direct;
      }
      const legacyChars = this.boundedIntPref(PREFS.contextCompressionTargetChars, DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS, 1000, 50000);
      return Math.max(1000, Math.floor(legacyChars / CHARS_PER_TOKEN_ESTIMATE));
    }

    estimateMessagesTokens(messages) {
      return Math.ceil(this.estimateMessagesChars(messages) / CHARS_PER_TOKEN_ESTIMATE);
    }

    estimateMessageTokens(message) {
      return Math.ceil(this.estimateMessageChars(message) / CHARS_PER_TOKEN_ESTIMATE);
    }

    recentContextStartByTokens(messages, maxRecentTokens) {
      const list = Array.isArray(messages) ? messages : [];
      let start = list.length;
      let budget = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        const message = list[i];
        if (this.isCompressedContextMessage(message)) {
          start = i + 1;
          break;
        }
        const cost = this.estimateMessageTokens(message);
        if (budget + cost > maxRecentTokens && start < list.length) {
          break;
        }
        budget += cost;
        start = i;
        while (start > 0 && list[start] && list[start].role === "tool") {
          start--;
        }
      }
      return Math.max(0, start);
    }

    canContinueConversationTask() {
      if (!this.task || this.task.pendingApproval) {
        return false;
      }
      if (this.task.status === "running") {
        return false;
      }
      return true;
    }

    async continueConversationWithUserMessage(state, taskText) {
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
      this.log("task.user_reply", { id: this.task.id, content: taskText, continued: true });
      this.renderAll();
      this.scheduleChatRepaint(state);
      this.runTaskLoopInBackground(state);
      return true;
    }


    getDebugOutputDir() {
      const raw = String(Zotero.Prefs.get(PREFS.debugOutputDir, true) || "").trim();
      const quoted = raw.match(/^"(.*)"$/);
      return quoted ? quoted[1] : raw;
    }

    buildDebugFileName(kind) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeKind = String(kind || "report").replace(/[^a-z0-9_-]+/gi, "-");
      return `zotero-assistant-${safeKind}-${stamp}.json`;
    }

    joinPath(...parts) {
      const filtered = parts.filter(Boolean).map((part) => String(part));
      if (!filtered.length) {
        return "";
      }
      if (typeof PathUtils !== "undefined" && typeof PathUtils.join === "function") {
        return PathUtils.join(...filtered);
      }
      if (typeof OS !== "undefined" && OS.Path && typeof OS.Path.join === "function") {
        return OS.Path.join(...filtered);
      }
      const sep = filtered[0].includes("\\") ? "\\" : "/";
      let result = filtered[0];
      for (const part of filtered.slice(1)) {
        result = (/[\\/]$/.test(result) ? result : result + sep) + part.replace(/^[\\/]+/, "");
      }
      return result;
    }

    localFile(path) {
      const file = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);
      file.initWithPath(path);
      return file;
    }

    async ensureDirectory(path) {
      const dirPath = String(path || "").trim();
      if (!dirPath) {
        throw new Error("未配置调试输出目录。");
      }
      if (typeof IOUtils !== "undefined" && typeof IOUtils.makeDirectory === "function") {
        await IOUtils.makeDirectory(dirPath, { createAncestors: true, ignoreExisting: true });
        return;
      }
      const file = this.localFile(dirPath);
      if (file.exists()) {
        if (!file.isDirectory()) {
          throw new Error("调试输出路径不是目录。");
        }
        return;
      }
      const parent = file.parent;
      if (parent && !parent.exists()) {
        await this.ensureDirectory(parent.path);
      }
      file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
    }

    async writeTextFile(path, text) {
      const content = String(text == null ? "" : text);
      if (typeof IOUtils !== "undefined") {
        if (typeof IOUtils.writeUTF8 === "function") {
          await IOUtils.writeUTF8(path, content);
          return;
        }
        if (typeof IOUtils.write === "function" && typeof TextEncoder !== "undefined") {
          await IOUtils.write(path, new TextEncoder().encode(content));
          return;
        }
      }
      if (typeof OS !== "undefined" && OS.File && typeof OS.File.writeAtomic === "function" && typeof TextEncoder !== "undefined") {
        await OS.File.writeAtomic(path, new TextEncoder().encode(content), { tmpPath: path + ".tmp" });
        return;
      }
      if (Zotero.File && typeof Zotero.File.putContentsAsync === "function") {
        await Zotero.File.putContentsAsync(path, content);
        return;
      }
      if (Zotero.File && typeof Zotero.File.putContents === "function") {
        Zotero.File.putContents(path, content);
        return;
      }
      throw new Error("当前 Zotero 环境没有可用的文件写入 API。");
    }

    debugContentPreview(content, limit = DEBUG_MESSAGE_LIMIT) {
      if (typeof content === "string") {
        return this.truncateText(content, limit);
      }
      return safeJSONStringify(content, limit);
    }

    sanitizeToolArgs(toolName, args) {
      const copy = Object.assign({}, args || {});
      if (toolName === "set_preference" && this.isSensitivePreferenceName(copy.name)) {
        copy.value = this.maskSensitiveValue(copy.value);
      }
      return copy;
    }

    sanitizeToolCalls(toolCalls) {
      if (!Array.isArray(toolCalls)) {
        return toolCalls;
      }
      return toolCalls.map((call) => {
        const next = Object.assign({}, call || {});
        if (next.function) {
          next.function = Object.assign({}, next.function);
          if (next.function.name === "set_preference") {
            let parsed = {};
            try {
              parsed = typeof next.function.arguments === "string"
                ? JSON.parse(next.function.arguments)
                : next.function.arguments || {};
            } catch (error) {
              parsed = {};
            }
            next.function.arguments = JSON.stringify(this.sanitizeToolArgs("set_preference", parsed));
          }
        }
        return next;
      });
    }

    sanitizeForLog(value, seen = new WeakSet()) {
      if (!value || typeof value !== "object") {
        return value;
      }
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
      if (Array.isArray(value)) {
        return value.map((entry) => this.sanitizeForLog(entry, seen));
      }
      const output = {};
      const toolName = value.toolName || "";
      for (const [key, entry] of Object.entries(value)) {
        if ((key === "value" || key === "before" || key === "after") && this.isSensitivePreferenceName(value.name)) {
          output[key] = this.maskSensitiveValue(entry);
        } else if (key === "args" && toolName === "set_preference") {
          output[key] = this.sanitizeToolArgs(toolName, entry);
        } else if (/api[_-]?key|apikey|password|passwd|token|secret/i.test(key)) {
          output[key] = this.maskSensitiveValue(entry);
        } else if (key === "tool_calls") {
          output[key] = this.sanitizeToolCalls(entry);
        } else {
          output[key] = this.sanitizeForLog(entry, seen);
        }
      }
      return output;
    }

    debugMessagesTail(messages, limit = DEBUG_MESSAGE_TAIL) {
      return (Array.isArray(messages) ? messages.slice(-limit) : []).map((message) => ({
        role: message && message.role ? message.role : "",
        tool_call_id: message && message.tool_call_id ? message.tool_call_id : "",
        content: this.debugContentPreview(message && message.content),
        tool_calls: message && message.tool_calls ? safeJSONStringify(this.sanitizeToolCalls(message.tool_calls), DEBUG_MESSAGE_LIMIT) : ""
      }));
    }

    modelRequestSnapshot(request) {
      return {
        model: request && request.model ? request.model : "",
        toolChoice: request && request.tool_choice ? request.tool_choice : "",
        hasTools: !!(request && Array.isArray(request.tools) && request.tools.length),
        maxTokens: request && request.max_tokens ? request.max_tokens : null,
        maxOutputTokens: request && request.max_output_tokens ? request.max_output_tokens : null,
        temperature: request && request.temperature ? request.temperature : null,
        instructionsPreview: this.debugContentPreview(request && request.instructions, DEBUG_TEXT_LIMIT),
        inputPreview: this.debugContentPreview(request && request.input, DEBUG_TEXT_LIMIT),
        promptPreview: this.debugContentPreview(request && request.prompt, DEBUG_TEXT_LIMIT),
        messageCount: request && Array.isArray(request.messages) ? request.messages.length : 0,
        messagesTail: this.debugMessagesTail(request && request.messages, 12)
      };
    }

    modelCallOptionsSnapshot(options = {}) {
      return {
        disableTools: !!options.disableTools,
        disableToolParsing: !!options.disableToolParsing,
        plainTextOnly: !!options.plainTextOnly,
        systemInstruction: this.truncateText(options.systemInstruction || "", 2000)
      };
    }

    serializeErrorForDebug(error) {
      if (!error) {
        return null;
      }
      return {
        name: error.name || "Error",
        message: String(error.message || error),
        stack: error.stack ? String(error.stack) : "",
        source: error.source || "",
        toolName: error.toolName || "",
        debugInfo: error.debugInfo || null,
        debugAttempts: error.debugAttempts || null
      };
    }

    buildTaskSnapshot() {
      if (!this.task) {
        return null;
      }
      return {
        id: this.task.id,
        prompt: this.truncateText(this.task.prompt || "", 4000),
        status: this.task.status,
        phase: this.task.phase,
        error: this.task.error || "",
        summary: this.truncateText(this.task.summary || "", 4000),
        libraryID: this.task.libraryID,
        libraryName: this.task.libraryName,
        loopCount: this.task.loopCount || 0,
        createdCollections: this.task.createdCollections || 0,
        processedItemCount: this.task.processedItems instanceof Set ? this.task.processedItems.size : 0,
        executedWriteToolCount: this.task.executedWriteToolCount || 0,
        liveSearchCount: this.task.liveSearchCount || 0,
        webFetchCount: this.task.webFetchCount || 0,
        plainAssistantTurnCount: this.task.plainAssistantTurnCount || 0,
        consecutiveToolFailures: this.task.consecutiveToolFailures || 0,
        lastToolFailure: this.task.lastToolFailure || null,
        compressionCount: this.task.compressionCount || 0,
        compressedSummaryChars: this.task.compressedSummaryChars || 0,
        canContinueAfterCompressionFailure: !!this.task.canContinueAfterCompressionFailure,
        sessionMemoryInjected: !!this.task.sessionMemoryInjected,
        sessionMemoryChars: this.task.sessionMemoryChars || 0,
        pendingApproval: this.task.pendingApproval ? {
          kind: this.task.pendingApproval.kind,
          toolName: this.task.pendingApproval.toolName,
          summary: this.task.pendingApproval.summary,
          details: this.truncateText(this.task.pendingApproval.details || "", 4000)
        } : null,
        lastDebugReportPath: this.task.lastDebugReportPath || "",
        messageCount: Array.isArray(this.task.messages) ? this.task.messages.length : 0,
        messagesTail: this.debugMessagesTail(this.task.messages)
      };
    }

    buildDebugReport(kind, payload = {}) {
      return {
        kind,
        createdAt: new Date().toISOString(),
        plugin: {
          id: this.id,
          version: this.version
        },
        zotero: {
          version: safeCall(() => Zotero.version),
          userAgent: safeCall(() => this.firstWindow() && this.firstWindow().navigator && this.firstWindow().navigator.userAgent)
        },
        settings: {
          baseURL: (Zotero.Prefs.get(PREFS.baseURL, true) || "").trim(),
          model: Zotero.Prefs.get(PREFS.model, true) || "",
          apiMode: Zotero.Prefs.get(PREFS.apiMode, true) || DEFAULT_API_MODE,
          safetyMode: Zotero.Prefs.get(PREFS.safetyMode, true) || "",
          debugMode: this.isDebugModeEnabled(),
          debugOutputDir: this.getDebugOutputDir(),
          sessionMemoryEnabled: this.isSessionMemoryEnabled(),
          autoCompressionEnabled: this.isAutoCompressionEnabled(),
          contextCompressionMaxTokens: this.contextCompressionMaxTokens(),
          contextCompressionTargetTokens: this.contextCompressionTargetTokens(),
          contextCompressionKeepMessages: this.contextCompressionKeepMessages()
        },
        task: this.buildTaskSnapshot(),
        payload: this.sanitizeForLog(payload)
      };
    }

    async maybeWriteDebugReport(kind, payload = {}) {
      if (!this.isDebugModeEnabled()) {
        return null;
      }
      const dir = this.getDebugOutputDir();
      if (!dir) {
        this.log("debug.report_failed", { kind, error: "未配置调试输出目录。" });
        return null;
      }
      try {
        await this.ensureDirectory(dir);
        const reportPath = this.joinPath(dir, this.buildDebugFileName(kind));
        const report = this.buildDebugReport(kind, payload);
        await this.writeTextFile(reportPath, JSON.stringify(report, null, 2));
        if (this.task) {
          this.task.lastDebugReportPath = reportPath;
        }
        this.log("debug.report_written", { kind, path: reportPath });
        this.renderAll();
        return reportPath;
      } catch (error) {
        this.log("debug.report_failed", { kind, error: String(error), path: dir });
        this.renderAll();
        return null;
      }
    }

    makeModelError(message, debugInfo) {
      const error = new Error(message);
      error.source = "model";
      error.debugInfo = debugInfo || null;
      return error;
    }

    preferenceBranch() {
      if (typeof Services === "undefined" || !Services.prefs) {
        throw new Error("当前 Zotero 环境没有可用的 preference 服务。");
      }
      return Services.prefs;
    }

    prefConstant(branch, name, fallback) {
      return typeof branch[name] === "number" ? branch[name] : fallback;
    }

    allPreferenceNames() {
      const branch = this.preferenceBranch();
      try {
        return Array.from(branch.getChildList("", {}));
      } catch (error) {
        try {
          return Array.from(branch.getChildList(""));
        } catch (innerError) {
          return [];
        }
      }
    }

    normalizePreferenceName(name) {
      const raw = String(name || "").trim();
      if (!raw) {
        return "";
      }
      return raw.includes(".") ? raw : PREF_PREFIX + raw;
    }

    normalizePreferencePrefix(prefix) {
      const raw = String(prefix || "").trim();
      if (!raw) {
        return "";
      }
      return raw.endsWith(".") ? raw : raw + ".";
    }

    isMozillaInternalPreference(name) {
      return /^(browser|network|security|privacy|dom|gfx|layout|media|javascript|toolkit|services|app|datareporting|devtools|extensions\.webextensions)\./.test(String(name || ""));
    }

    isAllowedPreferenceNamespace(name) {
      const prefName = String(name || "");
      if (!prefName || this.isMozillaInternalPreference(prefName)) {
        return false;
      }
      return prefName.startsWith("extensions.") || prefName.startsWith("zotero.");
    }

    isSensitivePreferenceName(name) {
      const prefName = String(name || "");
      return /api[_-]?key|apikey|password|passwd|token|secret/i.test(prefName);
    }

    knownVisiblePreferenceNames() {
      return new Set([
        PREFS.baseURL,
        PREFS.model,
        PREFS.apiMode,
        PREFS.apiKey,
        PREFS.safetyMode,
        PREFS.debugMode,
        PREFS.debugOutputDir,
        PREFS.braveSearchApiKey,
        PREFS.webSearchProvider,
        PREFS.sessionMemoryEnabled,
        PREFS.autoCompressionEnabled,
        PREFS.contextCompressionTriggerChars,
        PREFS.contextCompressionTargetChars,
        PREFS.contextCompressionKeepMessages
      ]);
    }

    isKnownVisiblePreference(name) {
      return this.knownVisiblePreferenceNames().has(String(name || ""));
    }

    sourcePrefixForPreference(name) {
      const prefName = String(name || "");
      const parts = prefName.split(".");
      if (parts.length >= 2) {
        return `${parts[0]}.${parts[1]}.`;
      }
      return prefName ? prefName + "." : "";
    }

    preferenceTypeName(type) {
      const branch = this.preferenceBranch();
      if (type === this.prefConstant(branch, "PREF_BOOL", 128)) {
        return "boolean";
      }
      if (type === this.prefConstant(branch, "PREF_INT", 64)) {
        return "number";
      }
      if (type === this.prefConstant(branch, "PREF_STRING", 32)) {
        return "string";
      }
      return "invalid";
    }

    preferenceExists(name) {
      const branch = this.preferenceBranch();
      const invalid = this.prefConstant(branch, "PREF_INVALID", 0);
      try {
        return branch.getPrefType(name) !== invalid;
      } catch (error) {
        return false;
      }
    }

    readPreferenceRaw(name) {
      const branch = this.preferenceBranch();
      const type = branch.getPrefType(name);
      if (type === this.prefConstant(branch, "PREF_BOOL", 128)) {
        return branch.getBoolPref(name);
      }
      if (type === this.prefConstant(branch, "PREF_INT", 64)) {
        return branch.getIntPref(name);
      }
      if (type === this.prefConstant(branch, "PREF_STRING", 32)) {
        return branch.getStringPref(name);
      }
      return null;
    }

    setPreferenceRaw(name, value) {
      const branch = this.preferenceBranch();
      const type = branch.getPrefType(name);
      if (type === this.prefConstant(branch, "PREF_BOOL", 128)) {
        if (typeof value !== "boolean") {
          throw new Error("该设置当前类型为 boolean，写入值也必须是 boolean。");
        }
        branch.setBoolPref(name, value);
        return;
      }
      if (type === this.prefConstant(branch, "PREF_INT", 64)) {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          throw new Error("该设置当前类型为 number，写入值也必须是整数 number。");
        }
        branch.setIntPref(name, value);
        return;
      }
      if (type === this.prefConstant(branch, "PREF_STRING", 32)) {
        if (typeof value !== "string") {
          throw new Error("该设置当前类型为 string，写入值也必须是 string。");
        }
        branch.setStringPref(name, value);
        return;
      }
      throw new Error("不支持的 preference 类型。");
    }

    validatePreferenceWrite(meta, value) {
      if (meta.name === PREFS.safetyMode && !["confirm", "review", "open"].includes(value)) {
        throw new Error("safetyMode 只能是 confirm、review 或 open。");
      }
      if (meta.name === PREFS.apiMode && !["auto", "chat", "responses", "completions"].includes(value)) {
        throw new Error("apiMode 只能是 auto、chat、responses 或 completions。");
      }
      if (meta.name === PREFS.webSearchProvider && !["auto", "brave", "duckduckgo"].includes(value)) {
        throw new Error("webSearchProvider 只能是 auto、brave 或 duckduckgo。");
      }
      if (meta.name === PREFS.contextCompressionTriggerChars && (typeof value !== "number" || value < 10000 || value > 500000)) {
        throw new Error("contextCompressionTriggerChars 必须是 10000 到 500000 之间的整数。");
      }
      if (meta.name === PREFS.contextCompressionTargetChars && (typeof value !== "number" || value < 1000 || value > 50000)) {
        throw new Error("contextCompressionTargetChars 必须是 1000 到 50000 之间的整数。");
      }
      if (meta.name === PREFS.contextCompressionKeepMessages && (typeof value !== "number" || value < 4 || value > 80)) {
        throw new Error("contextCompressionKeepMessages 必须是 4 到 80 之间的整数。");
      }
    }

    maskSensitiveValue(value) {
      const text = String(value == null ? "" : value);
      if (!text) {
        return "未配置";
      }
      if (text.length <= 8) {
        return "已配置";
      }
      return `${text.slice(0, 4)}...${text.slice(-4)}`;
    }

    preferenceRiskLevel(meta) {
      if (!meta || !meta.isWritable || meta.isSensitive) {
        return "blocked";
      }
      if (meta.isHiddenOrInternal) {
        return "high";
      }
      if ([PREFS.baseURL, PREFS.model, PREFS.apiMode, PREFS.safetyMode, PREFS.debugOutputDir].includes(meta.name)) {
        return "high";
      }
      if ([
        PREFS.webSearchProvider,
        PREFS.debugMode,
        PREFS.sessionMemoryEnabled,
        PREFS.autoCompressionEnabled,
        PREFS.contextCompressionTriggerChars,
        PREFS.contextCompressionTargetChars,
        PREFS.contextCompressionKeepMessages
      ].includes(meta.name)) {
        return "low";
      }
      return "high";
    }

    preferenceMetadata(name) {
      const prefName = this.normalizePreferenceName(name);
      const exists = this.preferenceExists(prefName);
      const allowedNamespace = this.isAllowedPreferenceNamespace(prefName);
      const isSensitive = this.isSensitivePreferenceName(prefName);
      let type = 0;
      let rawValue = null;
      let hasUserValue = false;
      if (exists) {
        const branch = this.preferenceBranch();
        type = branch.getPrefType(prefName);
        rawValue = this.readPreferenceRaw(prefName);
        try {
          hasUserValue = branch.prefHasUserValue(prefName);
        } catch (error) {
          hasUserValue = false;
        }
      }
      const typeName = this.preferenceTypeName(type);
      const isKnownVisible = this.isKnownVisiblePreference(prefName);
      const meta = {
        name: prefName,
        exists,
        value: isSensitive ? this.maskSensitiveValue(rawValue) : rawValue,
        configured: isSensitive ? !!String(rawValue == null ? "" : rawValue) : undefined,
        type: typeName,
        hasUserValue,
        isSensitive,
        isWritable: exists && allowedNamespace && !isSensitive && typeName !== "invalid",
        isHiddenOrInternal: !isKnownVisible,
        sourcePrefix: this.sourcePrefixForPreference(prefName),
        allowedNamespace
      };
      meta.riskLevel = this.preferenceRiskLevel(meta);
      return meta;
    }

    preferenceMatchesQuery(meta, query) {
      const needle = String(query || "").trim().toLowerCase();
      if (!needle) {
        return true;
      }
      if (String(meta.name || "").toLowerCase().includes(needle)) {
        return true;
      }
      if (!meta.isSensitive && String(meta.value == null ? "" : meta.value).toLowerCase().includes(needle)) {
        return true;
      }
      return false;
    }

    preferenceLimit(value, fallback = DEFAULT_PREF_PAGE_SIZE) {
      return Math.min(Math.max(Number(value || fallback), 1), MAX_PREF_PAGE_SIZE);
    }

    preferenceNamesUnderPrefix(prefix) {
      const normalizedPrefix = this.normalizePreferencePrefix(prefix);
      return this.allPreferenceNames()
        .filter((name) => this.isAllowedPreferenceNamespace(name))
        .filter((name) => !normalizedPrefix || name.startsWith(normalizedPrefix))
        .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    }

    async toolBrowsePreferences(args) {
      const prefix = this.normalizePreferencePrefix(args.prefix || "");
      const query = String(args.query || "").trim();
      const limit = this.preferenceLimit(args.limit);
      const names = this.preferenceNamesUnderPrefix(prefix)
        .map((name) => this.preferenceMetadata(name))
        .filter((meta) => this.preferenceMatchesQuery(meta, query));
      const children = new Map();
      const direct = [];
      for (const meta of names) {
        const remainder = prefix ? meta.name.slice(prefix.length) : meta.name;
        if (!remainder) {
          continue;
        }
        const dot = remainder.indexOf(".");
        if (dot >= 0) {
          const childPrefix = prefix + remainder.slice(0, dot + 1);
          const current = children.get(childPrefix) || { prefix: childPrefix, count: 0, examples: [] };
          current.count++;
          if (current.examples.length < 3) {
            current.examples.push(meta.name);
          }
          children.set(childPrefix, current);
        } else {
          direct.push(meta);
        }
      }
      const childPrefixes = Array.from(children.values())
        .sort((a, b) => a.prefix.localeCompare(b.prefix, "zh-Hans-CN"))
        .slice(0, limit);
      return {
        ok: true,
        prefix,
        query,
        childPrefixes,
        preferences: direct.slice(0, limit),
        totalDescendantCount: names.length,
        limitApplied: childPrefixes.length < children.size || direct.length > limit
      };
    }

    async toolSearchPreferences(args) {
      const query = String(args.query || "").trim();
      if (!query) {
        return { ok: false, error: "搜索关键词为空。" };
      }
      const limit = this.preferenceLimit(args.limit);
      const prefix = this.normalizePreferencePrefix(args.prefix || "");
      const preferences = this.preferenceNamesUnderPrefix(prefix)
        .map((name) => this.preferenceMetadata(name))
        .filter((meta) => this.preferenceMatchesQuery(meta, query))
        .slice(0, limit);
      return {
        ok: true,
        query,
        prefix,
        preferences,
        count: preferences.length
      };
    }

    async toolReadPreferences(args) {
      const limit = this.preferenceLimit(args.limit, 100);
      let names = [];
      if (Array.isArray(args.names) && args.names.length) {
        names = args.names.map((name) => this.normalizePreferenceName(name));
      } else {
        names = this.preferenceNamesUnderPrefix(args.prefix || "").slice(0, limit);
      }
      const preferences = names
        .map((name) => this.preferenceMetadata(name))
        .filter((meta) => meta.allowedNamespace)
        .slice(0, limit);
      return {
        ok: true,
        prefix: args.prefix || "",
        preferences,
        count: preferences.length,
        limitApplied: names.length > limit
      };
    }

    async toolListPreferencePanes(args) {
      const data = this.listPreferencePanes(args || {});
      return { ok: true, ...data };
    }

    async toolOpenZoteroPreferences(args) {
      const state = this.firstState();
      if (!state) {
        return { ok: false, error: "没有可用的 Zotero 主窗口。" };
      }
      const opened = this.openPreferencesPaneById(args && args.pane_id, {
        scroll_to: args && args.scroll_to
      });
      if (!opened.ok) {
        return opened;
      }
      const reason = args && args.reason ? String(args.reason).trim() : "";
      const label = opened.label || opened.pane_id;
      return {
        ok: true,
        pane_id: opened.pane_id,
        label,
        summary: reason || `已打开 Zotero 设置：${label}（${opened.pane_id}）。请用户在界面中手动完成配置。`
      };
    }

    async toolRequestZoteroRestart(args) {
      const startup = typeof Services !== "undefined" && Services.startup;
      if (!startup || typeof startup.quit !== "function") {
        return { ok: false, error: "当前 Zotero 环境不支持从插件请求重启。" };
      }
      const appStartup = Components.interfaces.nsIAppStartup;
      const flags = appStartup.eAttemptQuit | appStartup.eRestart;
      const win = this.firstWindow();
      const restart = () => startup.quit(flags);
      if (win && typeof win.setTimeout === "function") {
        win.setTimeout(restart, 250);
      } else {
        restart();
      }
      return { ok: true, restartRequested: true, summary: args.reason || "已请求重启 Zotero。" };
    }

    preferenceApprovalPrefix(args) {
      const meta = this.preferenceMetadata(args.name);
      const proposed = this.normalizePreferencePrefix(args.rememberPrefix || "");
      if (proposed && meta.name.startsWith(proposed) && this.isAllowedPreferenceNamespace(proposed)) {
        return proposed;
      }
      return meta.sourcePrefix || "";
    }

    hasPreferencePrefixGrant(prefName) {
      const name = this.normalizePreferenceName(prefName);
      for (const prefix of this.sessionPreferenceApprovals) {
        if (name.startsWith(prefix)) {
          return true;
        }
      }
      return false;
    }

    grantPreferencePrefix(prefix) {
      const normalized = this.normalizePreferencePrefix(prefix);
      if (!normalized) {
        return;
      }
      this.sessionPreferenceApprovals.add(normalized);
      this.log("preference.prefix_granted", { prefix: normalized });
      this.renderAll();
    }

    revokePreferencePrefix(prefix) {
      const normalized = this.normalizePreferencePrefix(prefix);
      if (!this.sessionPreferenceApprovals.delete(normalized)) {
        return;
      }
      this.log("preference.prefix_revoked", { prefix: normalized });
      this.renderAll();
    }

    summarizeToolArgs(toolName, args) {
      const safeArgs = args || {};
      switch (toolName) {
        case "request_expanded_context":
          return this.truncateText(safeArgs.reason || "需要整库视角。", 140);
        case "create_collection":
          return `新建 collection：${safeArgs.name || "未命名"}`;
        case "add_items_to_collection":
          return `加入 ${Array.isArray(safeArgs.itemKeys) ? safeArgs.itemKeys.length : 0} 条到 ${safeArgs.collectionKey || safeArgs.collectionName || "目标 collection"}`;
        case "add_tags":
          return `标签：${Array.isArray(safeArgs.tags) ? safeArgs.tags.join("，") : ""}`;
        case "create_note":
        case "append_note":
          return `目标条目：${safeArgs.parentItemKey || safeArgs.itemKey || "未指定"}`;
        case "create_parent_item":
          return `为附件 ${safeArgs.attachmentKey || ""} 创建 ${safeArgs.itemType || "父条目"}`;
        case "update_metadata":
          return `修改条目 ${safeArgs.itemKey || ""} 的元数据`;
        case "set_preference":
          return `修改设置 ${safeArgs.name || ""}`;
        case "browse_preferences":
          return `浏览设置前缀：${safeArgs.prefix || "根"}`;
        case "search_preferences":
          return `搜索设置：${safeArgs.query || ""}`;
        case "read_preferences":
          return `读取设置：${Array.isArray(safeArgs.names) ? safeArgs.names.join("，") : (safeArgs.prefix || "根")}`;
        case "list_preference_panes":
          return "列出设置面板";
        case "open_zotero_preferences":
          return args.pane_id ? `打开设置：${args.pane_id}` : "打开 Zotero 设置页";
        case "request_zotero_restart":
          return `请求重启 Zotero：${safeArgs.reason || ""}`;
        case "move_to_trash":
          return `移到回收站：${Array.isArray(safeArgs.itemKeys) ? safeArgs.itemKeys.length : 0} 条`;
        case "trigger_plugin_command":
          return `调用命令：${safeArgs.commandId || ""}`;
        case "browse_library_items":
          return this.truncateText(JSON.stringify({
            query: safeArgs.query || "",
            collectionKey: safeArgs.collectionKey || "",
            tag: safeArgs.tag || "",
            creator: safeArgs.creator || "",
            year: safeArgs.year || "",
            page: safeArgs.page || 1
          }), 160);
        case "read_fulltext_page":
        case "read_fulltext":
          return `全文分页：${safeArgs.itemKey || ""}`;
        case "read_item_fields":
          return `读取条目右侧字段：${safeArgs.itemKey || ""}`;
        case "live_search":
          return this.truncateText(safeArgs.query || "", 160);
        case "web_fetch":
          return this.truncateText(`${safeArgs.url || ""} — ${safeArgs.prompt || ""}`, 200);
        case "finish_task":
          return this.truncateText(safeArgs.summary || "结束任务。", 160);
        default:
          return this.truncateText(JSON.stringify(safeArgs), 160);
      }
    }

    summarizeToolResult(result) {
      if (!result) {
        return "未返回结果。";
      }
      if (result.ok === false) {
        return this.truncateText(result.error || "工具执行失败。", 220);
      }
      if (result.waitingForUser) {
        return "已暂停，等待你补充信息。";
      }
      if (result.collection) {
        return `已创建 collection：${result.collection.name || result.collection.key || ""}`;
      }
      if (result.parentItem) {
        return `已创建 ${result.parentItem.itemType || "父条目"}：${result.parentItem.title || result.parentItem.key || ""}`;
      }
      if (typeof result.addedCount === "number") {
        return `已加入 ${result.addedCount} 条目。`;
      }
      if (result.item && result.metadata) {
        return `已读取 ${result.item.title || result.item.key || ""} 的右侧元数据字段。`;
      }
      if (typeof result.changedCount === "number") {
        return `已更新 ${result.changedCount} 条。`;
      }
      if (typeof result.trashedCount === "number") {
        return `已移到回收站 ${result.trashedCount} 条。`;
      }
      if (result.noteKey) {
        return `已写入笔记 ${result.noteKey}。`;
      }
      if (result.commandId) {
        return `已触发命令 ${result.commandId}。`;
      }
      if (Array.isArray(result.commands)) {
        return `发现 ${result.commands.length} 个可调用命令。`;
      }
      if (Array.isArray(result.childPrefixes)) {
        return `返回 ${result.childPrefixes.length} 个设置前缀。`;
      }
      if (Array.isArray(result.preferences)) {
        return `返回 ${result.preferences.length} 个设置。`;
      }
      if (result.restartRequested) {
        return "已请求重启 Zotero。";
      }
      if (result.pageInfo && typeof result.pageInfo.page === "number") {
        return `返回第 ${result.pageInfo.page} 页。`;
      }
      if (Array.isArray(result.items)) {
        return `返回 ${result.items.length} 条结果。`;
      }
      if (Array.isArray(result.results)) {
        return `搜索到 ${result.results.length} 条网页结果。`;
      }
      if (typeof result.markdown === "string" && result.markdown.length) {
        return `已抓取页面（约 ${result.markdown.length} 字符）。`;
      }
      if (result.summary) {
        return this.truncateText(result.summary, 220);
      }
      if (result.ok === true) {
        return "执行成功。";
      }
      return this.truncateText(JSON.stringify(result), 220);
    }

    formatLogEvent(event) {
      const data = event.data || {};
      const time = new Date(event.time).toLocaleTimeString();
      switch (event.type) {
        case "task.started":
          return { tone: "info", badge: "任务", title: "开始新任务", detail: this.truncateText(data.prompt || "", 220), meta: time };
        case "task.user_reply":
          return { tone: "info", badge: "继续", title: "用户补充了任务信息", detail: this.truncateText(data.content || "", 220), meta: time };
        case "task.context.injected":
          return {
            tone: "neutral",
            badge: "上下文",
            title: "已注入本轮上下文",
            detail: [
              data.sessionMetadataAccess ? "包含整库鸟瞰图。" : "仅包含当前选择和当前 collection。",
              data.sessionMemoryChars ? `会话记忆 ${data.sessionMemoryChars} 字符。` : ""
            ].filter(Boolean).join(" "),
            meta: time
          };
        case "task.context.compressed":
          return { tone: "warning", badge: "压缩", title: "已自动压缩任务上下文", detail: `覆盖 ${data.coveredMessages || 0} 条消息，摘要 ${data.summaryChars || 0} 字符。`, meta: time };
        case "task.context.trimmed_after_compression_failure":
          return { tone: "warning", badge: "压缩", title: "压缩失败后已裁剪旧上下文", detail: `${data.beforeMessages || 0} 条变为 ${data.afterMessages || 0} 条。`, meta: time };
        case "task.loop.starting":
          return { tone: "info", badge: "循环", title: "准备启动任务循环", detail: this.truncateText(data.phase || "", 120), meta: time };
        case "task.loop.entered":
          return { tone: "info", badge: "循环", title: "任务循环已进入", detail: this.truncateText(data.phase || "", 120), meta: time };
        case "model.request.started":
          return { tone: "info", badge: "模型", title: "模型请求已发送", detail: `${data.variant || ""} · ${data.model || ""}`.trim(), meta: time };
        case "model.response.headers":
          return { tone: data.ok ? "info" : "warning", badge: "模型", title: "已收到模型响应头", detail: `HTTP ${data.status || ""} ${data.contentType || ""}`.trim(), meta: time };
        case "model.response.body_read":
          return { tone: "success", badge: "模型", title: "已读取模型响应正文", detail: `${data.rawTextLength || 0} 字符`, meta: time };
        case "model.retry":
          return { tone: "warning", badge: "重试", title: `模型调用重试 ${Number(data.attempt || 0) + 1}`, detail: this.truncateText(data.error || "", 220), meta: time };
        case "model.variant_fallback":
          return { tone: "warning", badge: "兼容", title: "切换到了兼容响应模式", detail: this.truncateText(data.variant || "", 160), meta: time };
        case "model.unrecognized_response":
          return {
            tone: "danger",
            badge: "模型",
            title: "模型返回了未识别格式",
            detail: this.truncateText(`${data.variant || ""} ${data.preview || ""}`.trim(), 240),
            meta: time
          };
        case "approval.requested":
          return { tone: "warning", badge: "审批", title: "AI 请求授权", detail: this.truncateText(data.summary || "", 220), meta: time };
        case "approval.rejected":
          return { tone: "danger", badge: "审批", title: "授权被拒绝", detail: this.truncateText(data.summary || data.toolName || "", 220), meta: time };
        case "approval.granted":
          return { tone: "success", badge: "审批", title: "授权已通过", detail: this.truncateText(data.summary || data.toolName || "", 220), meta: time };
        case "tool.started":
          return { tone: "info", badge: "工具", title: `开始执行 ${data.toolName || "工具"}`, detail: this.summarizeToolArgs(data.toolName, data.args), meta: time };
        case "tool.finished":
          return {
            tone: data.result && data.result.ok === false ? "danger" : "success",
            badge: data.result && data.result.ok === false ? "失败" : "完成",
            title: `${data.toolName || "工具"} 已返回`,
            detail: this.summarizeToolResult(data.result),
            meta: time
          };
        case "tool.retry_requested":
          return { tone: "warning", badge: "调整", title: "工具失败，已要求模型改方案", detail: this.truncateText(data.error || "", 220), meta: time };
        case "assistant.message":
          return {
            tone: data.needsUserReply ? "info" : "neutral",
            badge: "AI",
            title: data.needsUserReply ? "AI 需要你继续提供信息" : "AI 返回了一条消息",
            detail: this.truncateText(data.text || "", 240),
            meta: time
          };
        case "task.paused":
          return { tone: "danger", badge: "暂停", title: "任务已暂停", detail: this.truncateText(data.reason || "", 240), meta: time };
        case "library.read_grant.granted":
          return { tone: "success", badge: "权限", title: "已开放整库元数据读取", detail: this.truncateText(data.libraryName || "", 180), meta: time };
        case "library.read_grant.revoked":
          return { tone: "warning", badge: "权限", title: "已收回整库元数据读取", detail: this.truncateText(data.libraryName || "", 180), meta: time };
        case "undo.started":
          return { tone: "info", badge: "撤销", title: "开始撤销最近操作", detail: this.truncateText(data.type || "", 180), meta: time };
        case "undo.finished":
          return { tone: "success", badge: "撤销", title: "撤销完成", detail: this.truncateText(data.type || "", 180), meta: time };
        case "task.context.cleared":
          return { tone: "warning", badge: "上下文", title: "已清除当前任务", detail: this.truncateText(data.libraryName || "", 180), meta: time };
        case "session_memory.updated":
          return { tone: "success", badge: "记忆", title: "已更新本库会话记忆", detail: `摘要 ${data.summaryChars || 0} 字符，版本 ${data.version || 0}。`, meta: time };
        case "session_memory.update_failed":
          return { tone: "warning", badge: "记忆", title: "会话记忆更新失败", detail: this.truncateText(data.error || "", 220), meta: time };
        case "session_memory.cleared":
          return { tone: "warning", badge: "记忆", title: "已清除本库会话记忆", detail: this.truncateText(data.libraryName || "", 180), meta: time };
        case "session_memory.copied":
          return { tone: "success", badge: "记忆", title: "已复制本库会话记忆", detail: `${data.summaryChars || 0} 字符。`, meta: time };
        case "session_memory.copy_failed":
          return { tone: "warning", badge: "记忆", title: "复制本库会话记忆失败", detail: this.truncateText(data.error || "", 220), meta: time };
        case "preference.changed":
          return { tone: "warning", badge: "设置", title: "设置已修改", detail: this.truncateText(data.name || "", 220), meta: time };
        case "preference.prefix_granted":
          return { tone: "success", badge: "设置", title: "已记住设置前缀", detail: this.truncateText(data.prefix || "", 220), meta: time };
        case "preference.prefix_revoked":
          return { tone: "warning", badge: "设置", title: "已收回设置前缀", detail: this.truncateText(data.prefix || "", 220), meta: time };
        case "debug.report_written":
          return { tone: "success", badge: "调试", title: "已写入调试文件", detail: this.truncateText(data.path || "", 240), meta: time };
        case "debug.report_failed":
          return { tone: "warning", badge: "调试", title: "调试文件写入失败", detail: this.truncateText(data.error || data.path || "", 240), meta: time };
        case "plugin.started":
          return { tone: "neutral", badge: "插件", title: "插件已启动", detail: `版本 ${data.version || ""}`.trim(), meta: time };
        default:
          return {
            tone: "neutral",
            badge: "事件",
            title: event.type,
            detail: this.truncateText(JSON.stringify(data), 220),
            meta: time
          };
      }
    }

    ensurePopupHost(state) {
      if (state.popupHost && state.popupHost.parentNode) {
        return state.popupHost;
      }
      const doc = state.doc;
      const host = doc.createXULElement ? doc.createXULElement("popupset") : doc.createElement("popupset");
      host.setAttribute("id", "zotero-assistant-popupset");
      doc.documentElement.appendChild(host);
      state.popupHost = host;
      return host;
    }

    createNativePopup(state, id, persistent) {
      const host = this.ensurePopupHost(state);
      const doc = state.doc;
      const panel = doc.createXULElement ? doc.createXULElement("panel") : doc.createElement("panel");
      panel.setAttribute("id", id);
      panel.setAttribute("level", "top");
      panel.setAttribute("animate", "true");
      panel.setAttribute("noautofocus", "true");
      if (persistent) {
        panel.setAttribute("noautohide", "true");
      }
      panel.style.cssText = "padding:0;border:none;background:transparent;appearance:none;";
      const content = this.html(doc, "div");
      content.style.cssText = "padding:0;margin:0;background:transparent;";
      panel.appendChild(content);
      host.appendChild(panel);
      return panel;
    }

    ensureApprovalPopup(state) {
      if (!state.approvalPopup || !state.approvalPopup.parentNode) {
        state.approvalPopup = this.createNativePopup(state, "zotero-assistant-approval-popup", true);
      }
      return state.approvalPopup;
    }

    ensureLogPopup(state) {
      if (!state.logPopup || !state.logPopup.parentNode) {
        state.logPopup = this.createNativePopup(state, "zotero-assistant-log-popup", false);
      }
      return state.logPopup;
    }

    getAnchorRect(state) {
      if (state.container && state.container.style.display !== "none") {
        return state.container.getBoundingClientRect();
      }
      if (state.launcher) {
        return state.launcher.getBoundingClientRect();
      }
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    popupScreenOrigin(win) {
      return {
        x: typeof win.mozInnerScreenX === "number" ? win.mozInnerScreenX : (typeof win.screenX === "number" ? win.screenX : 0),
        y: typeof win.mozInnerScreenY === "number" ? win.mozInnerScreenY : (typeof win.screenY === "number" ? win.screenY : 0)
      };
    }

    openPopupAtPosition(panel, state, kind) {
      const win = state.win;
      const rect = this.getAnchorRect(state);
      const origin = this.popupScreenOrigin(win);
      const popupWidth = kind === "approval" ? 340 : 320;
      const popupHeight = kind === "approval" ? 220 : 180;
      const x = Math.max(16, Math.round(origin.x + rect.left - popupWidth - 14));
      const y = Math.max(16, Math.round(origin.y + rect.top + (kind === "approval" ? 64 : Math.max(80, rect.height - popupHeight - 96))));
      if (panel.state === "open" || panel.state === "showing") {
        if (typeof panel.moveTo === "function") {
          panel.moveTo(x, y);
        }
        return;
      }
      if (typeof panel.openPopupAtScreen === "function") {
        panel.openPopupAtScreen(x, y, false);
        return;
      }
      const anchor = state.container && state.container.style.display !== "none" ? state.container : state.launcher;
      if (anchor && typeof panel.openPopup === "function") {
        panel.openPopup(anchor, "before_start", -popupWidth - 14, kind === "approval" ? 64 : -160, false, false);
      }
    }

    hidePopup(panel) {
      if (panel && (panel.state === "open" || panel.state === "showing") && typeof panel.hidePopup === "function") {
        panel.hidePopup();
      }
    }

    renderApprovalPopup(state) {
      if (state.approvalPopup) {
        this.hidePopup(state.approvalPopup);
      }
      if (state.logPopup) {
        this.hidePopup(state.logPopup);
      }
    }

    renderLogPopup(state) {
      if (state && state.logPopup) {
        this.hidePopup(state.logPopup);
      }
    }

    async startTaskFromInput(state) {
      const text = (state.inputNode && state.inputNode.value || "").trim();
      const accepted = await this.startTaskFromText(state, text);
      if (accepted && state.inputNode) {
        state.inputNode.value = "";
      }
    }

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
        ? "上次任务卡在「启动」阶段（循环未真正开始）。已改为 paused，请重新发送或清除当前任务。"
        : "上次任务循环已中断，但状态仍为 running。已自动修复为 paused，请重新发送或清除当前任务。";
      this.log("task.orphan_running_repaired", { id: this.task.id, phase: this.task.phase });
      return true;
    }

    async startTaskFromText(state, text) {
      state = this.resolveChatState(state);
      const taskText = String(text || "").trim();
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
        return await this.continueConversationWithUserMessage(state, taskText);
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
        sessionMemoryChars: 0
      };
      this.log("task.started", { id: this.task.id, prompt: taskText, libraryID, libraryName, status: this.task.status });
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
    }

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
    }

    showChatNotice(state, message) {
      if (state) {
        state.chatNotice = String(message || "");
        this.showChatPanel(state);
        this.renderChatPanel(state);
      }
      if (state && state.logNode) {
        this.showMessage(state, message);
      }
    }

    async sendChatInput(state) {
      const chatState = this.resolveChatState(state);
      const text = (chatState && chatState.chatInputNode && chatState.chatInputNode.value || "").trim();
      if (!text) {
        return;
      }
      if (chatState.chatInputNode) {
        chatState.chatInputNode.value = "";
      }
      chatState.chatNotice = "";
      this.showChatPanel(chatState);
      try {
        await this.startTaskFromText(chatState, text);
      } catch (error) {
        Zotero.debug(`Zotero Assistant sendChatInput failed: ${error}`);
      } finally {
        this.flushChatTurnToDisplay();
        this.renderAll();
        this.scheduleChatRepaint(chatState);
      }
    }

    async runTaskLoop() {
      if (!this.task || this.task.status !== "running") {
        this.log("task.loop.aborted_not_running", {
          hasTask: !!this.task,
          status: this.task && this.task.status
        });
        return;
      }
      const state = this.firstState();
      try {
        this.task.phase = "injecting_context";
        this.renderChatPanelIfOpen();
        await this.injectTaskContext();
        while (this.task && this.task.status === "running") {
          this.task.loopCount++;
          if (this.task.loopCount > MAX_TASK_LOOPS) {
            await this.finishAfterLoopLimit();
            break;
          }
          await this.ensureTaskContextBudget();
          this.task.phase = "calling_model";
          this.renderChatPanelIfOpen();
          const response = await this.callModelWithRetries(this.task.messages);
          await this.handleModelResponse(response);
        }
      } catch (error) {
        this.task.status = "paused";
        this.task.phase = error && error.source === "tool"
          ? "tool_failed"
          : error && error.source === "compression"
            ? "compression_failed"
            : "model_failed";
        this.task.error = String(error);
        if (error && error.source === "compression") {
          this.task.canContinueAfterCompressionFailure = true;
          this.task.compressionFailure = {
            error: String(error),
            debugInfo: error.debugInfo || null,
            time: new Date().toISOString()
          };
        }
        this.log("task.paused", {
          id: this.task.id,
          reason: String(error),
          source: error && error.source ? error.source : "unknown",
          toolName: error && error.toolName ? error.toolName : null
        });
        await this.maybeWriteDebugReport("task_paused", {
          reason: String(error),
          source: error && error.source ? error.source : "unknown",
          toolName: error && error.toolName ? error.toolName : null,
          error: this.serializeErrorForDebug(error)
        });
        await this.safeUpdateSessionMemoryForTask(this.task.phase);
        if (state) {
          const prefix = error && error.source === "tool"
            ? "工具执行失败"
            : error && error.source === "compression"
              ? "上下文压缩失败"
              : "模型调用失败";
          const detail = `${prefix}：${error}`;
          this.showMessage(state, detail);
          if (state.chatOpen) {
            state.chatNotice = detail;
          }
          this.pushChatTurnReadable(`【任务已暂停】${detail}`);
          this.flushChatTurnToDisplay();
        }
      } finally {
        this.flushChatTurnToDisplay();
        this.renderChatPanelIfOpen();
        this.renderAll();
      }
    }

    async finishAfterLoopLimit() {
      if (!this.task) {
        return;
      }
      const finalInstruction = [
        `The task has reached the maximum loop limit (${MAX_TASK_LOOPS}).`,
        "Tool use is now disabled.",
        "Do not call any tools and do not return JSON.",
        "Return a concise Chinese final result that states: what has already been done, what remains unfinished or uncertain, and what the user should check next."
      ].join(" ");
      this.task.phase = "loop_limit_summary";
      this.log("task.loop_limit_summary", { id: this.task.id, loopCount: this.task.loopCount });
      try {
        const response = await this.callModelWithRetries(this.task.messages, {
          disableTools: true,
          disableToolParsing: true,
          systemInstruction: finalInstruction,
          plainTextOnly: true
        });
        const text = response && typeof response.content === "string" ? response.content.trim() : "";
        if (!text) {
          this.task.status = "paused";
          this.task.phase = "loop_limit";
          this.task.error = "达到轮次上限后，最终总结轮没有返回可用文本。";
          this.log("task.paused", { id: this.task.id, reason: "loop_limit_final_text_missing" });
          await this.maybeWriteDebugReport("loop_limit_final_text_missing", {
            reason: this.task.error,
            loopCount: this.task.loopCount
          });
          await this.safeUpdateSessionMemoryForTask("loop_limit_final_text_missing");
          return;
        }
        this.task.messages.push({
          role: "assistant",
          content: text,
          tool_calls: []
        });
        this.absorbAssistantMessageForChatDisplay({
          role: "assistant",
          content: text,
          tool_calls: []
        });
        this.flushChatTurnToDisplay();
        this.task.summary = text;
        this.task.error = null;
        this.task.status = "complete";
        this.task.phase = "loop_limit_complete";
        this.log("task.completed", { id: this.task.id, reason: "loop_limit_complete" });
        await this.safeUpdateSessionMemoryForTask("loop_limit_complete");
      } catch (error) {
        this.task.status = "paused";
        this.task.phase = "loop_limit";
        this.task.error = `达到轮次上限后，最终总结轮失败：${error}`;
        this.log("task.paused", {
          id: this.task.id,
          reason: this.task.error,
          source: error && error.source ? error.source : "model"
        });
        await this.maybeWriteDebugReport("loop_limit_final_text_failed", {
          reason: this.task.error,
          loopCount: this.task.loopCount,
          error: this.serializeErrorForDebug(error)
        });
        await this.safeUpdateSessionMemoryForTask("loop_limit_failed");
      }
    }

    stringifyContextObject(value) {
      try {
        const seen = new WeakSet();
        return JSON.stringify(value, (key, current) => {
          if (typeof current === "function") {
            return "[Function]";
          }
          if (current instanceof Set) {
            return Array.from(current);
          }
          if (current instanceof Map) {
            return Array.from(current.entries());
          }
          if (current && typeof current === "object") {
            if (seen.has(current)) {
              return "[Circular]";
            }
            seen.add(current);
          }
          return current;
        }, 2);
      } catch (error) {
        return String(value);
      }
    }

    messageContentForSummary(message, limit) {
      let content = message && message.content;
      if (message && message.role === "tool" && typeof content === "string") {
        try {
          content = this.sanitizeForLog(JSON.parse(content));
        } catch (error) {
          // Keep the raw string when a tool result is not JSON.
        }
      }
      const text = typeof content === "string" ? content : this.stringifyContextObject(content || "");
      return limit ? this.truncateText(text, limit) : text;
    }

    serializeMessageForSummary(message, contentLimit = MEMORY_MESSAGE_SERIALIZE_LIMIT) {
      const output = {
        role: message && message.role ? message.role : "assistant",
        content: this.messageContentForSummary(message, contentLimit)
      };
      if (message && message.tool_call_id) {
        output.tool_call_id = message.tool_call_id;
      }
      if (message && Array.isArray(message.tool_calls)) {
        output.tool_calls = this.truncateText(this.stringifyContextObject(this.sanitizeToolCalls(message.tool_calls)), 4000);
      }
      return output;
    }

    serializeMessagesForSummary(messages, contentLimit = MEMORY_MESSAGE_SERIALIZE_LIMIT) {
      return this.stringifyContextObject((Array.isArray(messages) ? messages : []).map((message) => this.serializeMessageForSummary(message, contentLimit)));
    }

    estimateMessageChars(message) {
      if (!message) {
        return 0;
      }
      let total = String(message.role || "").length + String(message.tool_call_id || "").length;
      total += this.messageContentForSummary(message, 0).length;
      if (Array.isArray(message.tool_calls)) {
        total += this.stringifyContextObject(this.sanitizeToolCalls(message.tool_calls)).length;
      }
      return total;
    }

    estimateMessagesChars(messages) {
      return (Array.isArray(messages) ? messages : []).reduce((sum, message) => sum + this.estimateMessageChars(message), 0);
    }

    isCompressedContextMessage(message) {
      return !!(message && message.role === "system" && typeof message.content === "string" && message.content.startsWith(COMPRESSED_CONTEXT_MARKER));
    }

    recentContextStart(messages, keepMessages) {
      const list = Array.isArray(messages) ? messages : [];
      let start = Math.max(0, list.length - keepMessages);
      while (start > 0 && list[start] && list[start].role === "tool") {
        start--;
      }
      return start;
    }

    async ensureTaskContextBudget() {
      if (!this.task || !this.isAutoCompressionEnabled() || this.task.canContinueAfterCompressionFailure) {
        return;
      }
      const messages = Array.isArray(this.task.messages) ? this.task.messages : [];
      if (messages.length <= 4) {
        return;
      }
      const maxTokens = this.contextCompressionMaxTokens();
      const targetTokens = this.contextCompressionTargetTokens();
      const totalTokens = this.estimateMessagesTokens(messages);
      if (totalTokens <= maxTokens) {
        return;
      }
      const keepMessages = this.contextCompressionKeepMessages();
      await this.compressTaskContext({
        totalTokens,
        totalChars: this.estimateMessagesChars(messages),
        messageCount: messages.length,
        maxTokens,
        targetTokens,
        keepMessages
      });
    }

    compressionSystemInstruction(targetTokens) {
      const targetChars = Math.max(2000, targetTokens * CHARS_PER_TOKEN_ESTIMATE);
      return [
        "You compress Zotero Assistant task context for future model turns.",
        `Return a concise Chinese action summary of about ${targetTokens} tokens (${targetChars} characters) or less.`,
        "Preserve: user goal, explicit user preferences, key questions and answers, Zotero operations already executed, approvals, important item keys or collection names, errors, unfinished work, and next checks.",
        "Do not preserve full text, large metadata dumps, full tool outputs, API keys, tokens, passwords, or secrets.",
        "Return plain Markdown text only. Do not call tools. Do not return JSON."
      ].join("\n");
    }

    async compressTaskContext(stats) {
      const task = this.task;
      if (!task || !Array.isArray(task.messages)) {
        return;
      }
      const maxTokens = stats.maxTokens || this.contextCompressionMaxTokens();
      const targetTokens = stats.targetTokens || this.contextCompressionTargetTokens();
      const keepMessages = stats.keepMessages || this.contextCompressionKeepMessages();
      const recentTokenBudget = Math.max(targetTokens * 2, keepMessages * 800);
      let start = this.recentContextStartByTokens(task.messages, recentTokenBudget);
      if (start <= 0) {
        start = this.recentContextStart(task.messages, keepMessages);
      }
      const olderMessages = task.messages.slice(0, start);
      const recentMessages = task.messages.slice(start).filter((message) => !this.isCompressedContextMessage(message));
      if (!olderMessages.length) {
        return;
      }

      const previousPhase = task.phase;
      task.phase = "compressing_context";
      this.renderAll();
      const targetChars = Math.max(2000, targetTokens * CHARS_PER_TOKEN_ESTIMATE);
      const compressionPayload = [
        `Task ID: ${task.id}`,
        `Library: ${task.libraryName || ""} (${task.libraryID || ""})`,
        `Original prompt: ${task.prompt || ""}`,
        `Current visible task summary: ${task.summary || ""}`,
        `Last error: ${task.error || ""}`,
        `Messages to compress (${olderMessages.length}):`,
        this.serializeMessagesForSummary(olderMessages, COMPRESSION_MESSAGE_SERIALIZE_LIMIT)
      ].join("\n\n");

      try {
        const response = await this.callModelWithRetries([{ role: "user", content: compressionPayload }], {
          disableTools: true,
          disableToolParsing: true,
          plainTextOnly: true,
          systemInstruction: this.compressionSystemInstruction(targetTokens)
        });
        const summary = response && typeof response.content === "string" ? response.content.trim() : "";
        if (!summary) {
          throw new Error("压缩模型没有返回摘要文本。");
        }
        const clippedSummary = this.truncateText(summary, targetChars);
        const summaryMessage = {
          role: "system",
          content: [
            COMPRESSED_CONTEXT_MARKER,
            `Created: ${new Date().toISOString()}`,
            `Covered messages: ${olderMessages.length}`,
            `Approx original chars: ${stats.totalChars || this.estimateMessagesChars(olderMessages)}`,
            "",
            clippedSummary
          ].join("\n")
        };
        task.messages = [summaryMessage, ...recentMessages];
        task.phase = previousPhase === "compressing_context" ? "running" : previousPhase;
        task.compressionCount = (task.compressionCount || 0) + 1;
        task.compressedSummaryChars = clippedSummary.length;
        task.lastCompressionAt = new Date().toISOString();
        task.canContinueAfterCompressionFailure = false;
        task.compressionFailure = null;
        this.log("task.context.compressed", {
          id: task.id,
          beforeChars: stats.totalChars || 0,
          beforeMessages: stats.messageCount || 0,
          coveredMessages: olderMessages.length,
          retainedMessages: recentMessages.length,
          summaryChars: clippedSummary.length,
          compressionCount: task.compressionCount
        });
      } catch (error) {
        task.phase = previousPhase;
        const wrapped = new Error(`上下文压缩失败：${error}`);
        wrapped.source = "compression";
        wrapped.debugInfo = {
          totalChars: stats.totalChars || 0,
          messageCount: stats.messageCount || 0,
          keepMessages,
          triggerChars: stats.triggerChars || 0,
          triggerMessages: stats.triggerMessages || 0,
          originalError: this.serializeErrorForDebug(error)
        };
        throw wrapped;
      }
    }

    trimTaskMessagesAfterCompressionFailure() {
      if (!this.task || !Array.isArray(this.task.messages)) {
        return { beforeMessages: 0, afterMessages: 0 };
      }
      const task = this.task;
      const beforeMessages = task.messages.length;
      const beforeChars = this.estimateMessagesChars(task.messages);
      const keepMessages = this.contextCompressionKeepMessages();
      const recentStart = this.recentContextStart(task.messages, keepMessages);
      const recentMessages = task.messages.slice(recentStart).filter((message) => !this.isCompressedContextMessage(message));
      const existingSummary = task.messages.filter((message) => this.isCompressedContextMessage(message)).slice(-1);
      const promptAlreadyRecent = recentMessages.some((message) => message.role === "user" && message.content === task.prompt);
      const nextMessages = [
        {
          role: "system",
          content: [
            "Context compression failed and the user chose to continue after trimming older heavy context.",
            "Older raw messages are no longer available. Use the task snapshot, any compressed summary, and recent messages below. If important information is missing, ask the user or re-read Zotero context with tools."
          ].join("\n")
        },
        {
          role: "system",
          content: `Task snapshot after trim:\n${this.stringifyContextObject({
            id: task.id,
            prompt: task.prompt,
            libraryID: task.libraryID,
            libraryName: task.libraryName,
            visibleSummary: task.summary || "",
            lastError: task.error || "",
            lastToolFailure: task.lastToolFailure || null,
            executedWriteToolCount: task.executedWriteToolCount || 0,
            processedItemCount: task.processedItems instanceof Set ? task.processedItems.size : 0
          })}`
        },
        ...existingSummary
      ];
      if (!promptAlreadyRecent && task.prompt) {
        nextMessages.push({ role: "user", content: task.prompt });
      }
      nextMessages.push(...recentMessages);
      task.messages = nextMessages;
      task.canContinueAfterCompressionFailure = false;
      task.compressionFailure = null;
      task.compressionTrimCount = (task.compressionTrimCount || 0) + 1;
      return {
        beforeMessages,
        afterMessages: task.messages.length,
        beforeChars,
        afterChars: this.estimateMessagesChars(task.messages)
      };
    }

    async continueAfterCompressionFailure() {
      if (!this.task || !this.task.canContinueAfterCompressionFailure) {
        return;
      }
      const stats = this.trimTaskMessagesAfterCompressionFailure();
      this.task.status = "running";
      this.task.phase = "resumed_after_compression_failure";
      this.task.error = null;
      this.log("task.context.trimmed_after_compression_failure", Object.assign({ id: this.task.id }, stats));
      this.renderAll();
      this.runTaskLoopInBackground(this.firstState());
    }

    getSessionMemory(libraryID) {
      return this.sessionMemoryByLibraryID.get(String(libraryID || ""));
    }

    setSessionMemory(libraryID, memory) {
      this.sessionMemoryByLibraryID.set(String(libraryID || ""), memory);
    }

    sessionMemorySystemInstruction(targetChars) {
      return [
        "You update Zotero Assistant session memory for one Zotero library.",
        `Return a Chinese action memory summary of about ${targetChars} characters or less.`,
        "Preserve user goals, durable preferences, important questions and answers, completed Zotero actions, approvals, errors, unresolved work, and suggested next steps.",
        "Merge the previous memory with the latest task. Remove stale duplicates.",
        "Do not include full tool outputs, full document text, large metadata dumps, API keys, tokens, passwords, or secrets.",
        "Return plain Markdown text only. Do not call tools. Do not return JSON."
      ].join("\n");
    }

    buildTaskMemoryPayload(task, reason, previousMemory) {
      const recentMessages = Array.isArray(task.messages) ? task.messages.slice(-MEMORY_RECENT_MESSAGE_LIMIT) : [];
      return [
        `Update reason: ${reason}`,
        `Library: ${task.libraryName || ""} (${task.libraryID || ""})`,
        "",
        "Previous session memory:",
        previousMemory && previousMemory.summary ? previousMemory.summary : "(none)",
        "",
        "Current task snapshot:",
        this.stringifyContextObject({
          id: task.id,
          prompt: task.prompt,
          status: task.status,
          phase: task.phase,
          visibleSummary: task.summary || "",
          error: task.error || "",
          lastToolFailure: task.lastToolFailure || null,
          createdCollections: task.createdCollections || 0,
          executedWriteToolCount: task.executedWriteToolCount || 0,
          processedItemCount: task.processedItems instanceof Set ? task.processedItems.size : 0,
          liveSearchCount: task.liveSearchCount || 0,
          webFetchCount: task.webFetchCount || 0
        }),
        "",
        `Recent task messages (${recentMessages.length}):`,
        this.serializeMessagesForSummary(recentMessages, MEMORY_MESSAGE_SERIALIZE_LIMIT)
      ].join("\n");
    }

    async safeUpdateSessionMemoryForTask(reason) {
      if (!this.isSessionMemoryEnabled() || !this.task || !this.task.libraryID || !Zotero.Prefs.get(PREFS.apiKey, true)) {
        return;
      }
      const task = this.task;
      const previousMemory = this.getSessionMemory(task.libraryID);
      const targetChars = this.contextCompressionTargetChars();
      const payload = this.buildTaskMemoryPayload(task, reason, previousMemory);
      try {
        const response = await this.callModelWithRetries([{ role: "user", content: payload }], {
          disableTools: true,
          disableToolParsing: true,
          plainTextOnly: true,
          systemInstruction: this.sessionMemorySystemInstruction(targetChars)
        });
        const summary = response && typeof response.content === "string" ? response.content.trim() : "";
        if (!summary) {
          throw new Error("会话记忆模型没有返回摘要文本。");
        }
        const clippedSummary = this.truncateText(summary, targetChars);
        const memory = {
          libraryID: String(task.libraryID),
          libraryName: task.libraryName || this.getLibraryName(task.libraryID),
          summary: clippedSummary,
          updatedAt: new Date().toISOString(),
          updateReason: reason,
          taskID: task.id,
          version: previousMemory ? (Number(previousMemory.version || 0) + 1) : 1
        };
        this.setSessionMemory(task.libraryID, memory);
        this.log("session_memory.updated", {
          libraryID: memory.libraryID,
          libraryName: memory.libraryName,
          reason,
          summaryChars: clippedSummary.length,
          version: memory.version
        });
        this.renderAll();
      } catch (error) {
        this.log("session_memory.update_failed", {
          libraryID: task.libraryID,
          libraryName: task.libraryName,
          reason,
          error: String(error)
        });
        await this.maybeWriteDebugReport("session_memory_update_failed", {
          reason,
          error: this.serializeErrorForDebug(error),
          previousMemory: previousMemory ? {
            libraryID: previousMemory.libraryID,
            libraryName: previousMemory.libraryName,
            updatedAt: previousMemory.updatedAt,
            version: previousMemory.version,
            summary: previousMemory.summary
          } : null
        });
      }
    }

    clearSessionMemoryForLibrary(libraryID) {
      const key = String(libraryID || "");
      const memory = this.sessionMemoryByLibraryID.get(key);
      if (!memory) {
        return;
      }
      this.sessionMemoryByLibraryID.delete(key);
      this.log("session_memory.cleared", {
        libraryID: key,
        libraryName: memory.libraryName || this.getLibraryName(libraryID),
        summaryChars: memory.summary ? memory.summary.length : 0
      });
      this.renderAll();
    }

    async copyTextToClipboard(text) {
      const value = String(text || "");
      const win = this.firstWindow();
      if (win && win.navigator && win.navigator.clipboard && typeof win.navigator.clipboard.writeText === "function") {
        await win.navigator.clipboard.writeText(value);
        return;
      }
      if (typeof Components !== "undefined" && Components.classes["@mozilla.org/widget/clipboardhelper;1"]) {
        const helper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
          .getService(Components.interfaces.nsIClipboardHelper);
        helper.copyString(value);
        return;
      }
      throw new Error("当前 Zotero 环境没有可用的剪贴板 API。");
    }

    async copySessionMemoryForLibrary(libraryID) {
      const memory = this.getSessionMemory(libraryID);
      if (!memory || !memory.summary) {
        return;
      }
      try {
        await this.copyTextToClipboard(memory.summary);
        this.log("session_memory.copied", {
          libraryID: String(libraryID || ""),
          libraryName: memory.libraryName || this.getLibraryName(libraryID),
          summaryChars: memory.summary.length
        });
      } catch (error) {
        this.log("session_memory.copy_failed", {
          libraryID: String(libraryID || ""),
          libraryName: memory.libraryName || this.getLibraryName(libraryID),
          error: String(error)
        });
      } finally {
        this.renderAll();
      }
    }

    async callModelWithRetries(messages, options = {}) {
      let lastError;
      const attempts = [];
      for (let attempt = 0; attempt <= MAX_MODEL_RETRIES; attempt++) {
        try {
          return await this.callModel(messages, options);
        } catch (error) {
          lastError = error;
          attempts.push({
            attempt,
            error: String(error),
            source: error && error.source ? error.source : "model",
            debugInfo: error && error.debugInfo ? error.debugInfo : null
          });
          this.log("model.retry", { attempt, error: String(error) });
        }
      }
      if (lastError) {
        lastError.source = lastError.source || "model";
        lastError.debugAttempts = attempts;
      }
      throw lastError;
    }

    async callModel(messages, options = {}) {
      const apiKey = Zotero.Prefs.get(PREFS.apiKey, true);
      if (!apiKey) {
        throw new Error("尚未配置 API key。");
      }
      const baseURL = (Zotero.Prefs.get(PREFS.baseURL, true) || DEFAULT_BASE_URL).trim();
      const model = Zotero.Prefs.get(PREFS.model, true) || DEFAULT_MODEL;
      const apiMode = Zotero.Prefs.get(PREFS.apiMode, true) || DEFAULT_API_MODE;
      const endpoint = this.resolveModelEndpoint(baseURL, apiMode);
      const fetchImpl = this.getFetch();
      const variants = this.buildRequestVariants(endpoint, model, messages, options);
      let lastError = null;
      for (const variant of variants) {
        const debugInfo = {
          variant: variant.label,
          requestMode: variant.mode,
          endpointMode: endpoint.mode,
          apiMode: endpoint.apiMode,
          endpointUrl: endpoint.url,
          model,
          usedAsFallback: !!variant.usedAsFallback,
          options: this.modelCallOptionsSnapshot(options),
          request: this.modelRequestSnapshot(variant.request)
        };
        let response;
        let rawText = "";
        try {
          this.log("model.request.started", {
            variant: variant.label,
            requestMode: variant.mode,
            endpointMode: endpoint.mode,
            apiMode: endpoint.apiMode,
            model
          });
          const result = await this.fetchModelResponseTextWithTimeout(fetchImpl, endpoint.url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(variant.request)
          }, {
            variant: variant.label,
            requestMode: variant.mode,
            endpointMode: endpoint.mode,
            apiMode: endpoint.apiMode,
            model
          });
          response = result.response;
          rawText = result.rawText;
        } catch (error) {
          const errorMessage = error && error.source === "model"
            ? `${variant.label} ${error.message || error}`
            : `${variant.label} 请求失败：${error}`;
          lastError = this.makeModelError(errorMessage, {
            ...debugInfo,
            transportError: String(error),
            innerDebugInfo: error && error.debugInfo ? error.debugInfo : null
          });
          continue;
        }
        debugInfo.response = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText || "",
          url: response.url || endpoint.url,
          contentType: response.headers && typeof response.headers.get === "function"
            ? response.headers.get("content-type") || ""
            : ""
        };
        debugInfo.response.rawTextLength = rawText.length;
        debugInfo.response.rawTextPreview = truncateText(rawText, DEBUG_TEXT_LIMIT);
        if (!response.ok) {
          lastError = this.makeModelError(`${variant.label} 请求返回 HTTP ${response.status}${rawText ? `: ${rawText.slice(0, 300)}` : ""}`, debugInfo);
          continue;
        }
        let json = null;
        try {
          json = rawText ? JSON.parse(rawText) : null;
        } catch (error) {
          lastError = this.makeModelError(`${variant.label} 请求成功，但返回不是合法 JSON。`, {
            ...debugInfo,
            parseError: String(error)
          });
          continue;
        }
        debugInfo.response.jsonPreview = safeJSONStringify(json, DEBUG_TEXT_LIMIT);
        const normalized = this.normalizeModelResponse(json, variant.mode, options);
        if (normalized) {
          if (variant.usedAsFallback) {
            this.log("model.variant_fallback", { endpointMode: endpoint.mode, variant: variant.label });
          }
          return normalized;
        }
        this.log("model.unrecognized_response", {
          variant: variant.label,
          preview: safeJSONStringify(json, 800)
        });
        lastError = this.makeModelError(`${variant.label} 请求成功，但响应无法识别。`, debugInfo);
      }
      throw lastError || this.makeModelError("模型响应无法识别。请检查 endpoint 路径、模型返回格式，或让模型返回文本、tool_calls、或 JSON 工具计划。", {
        endpointMode: endpoint.mode,
        endpointUrl: endpoint.url,
        model,
        options: this.modelCallOptionsSnapshot(options)
      });
    }

    systemPrompt() {
      return [
        "You are Zotero Assistant running inside a Zotero desktop plugin.",
        "Never assume a default task. Wait for and follow the user's explicit task.",
        "If the task is ambiguous in a high-impact way, call request_clarification before changing Zotero.",
        "Each task is bound to the Zotero library that was active when the task started. Do not silently switch libraries mid-task.",
        "Default context is the current selection, current collection, and visible item summary inside the bound library.",
        "You may receive compressed task context and same-library session memory. Treat them as summaries of earlier work; if exact current Zotero state matters, verify with tools.",
        "If session-scoped metadata access for the bound library has not been granted and you need broad library context, call request_expanded_context.",
        "Once metadata access is granted, use read_library_overview and browse_library_items for broad context.",
        "When a user wants you to supplement the Zotero right-pane metadata, first inspect the item with read_item_fields, then update fields and creators with update_metadata.",
        "Full text reading is low risk but must be explicit. Use read_fulltext_page one item at a time and only after metadata suggests it is necessary.",
        "Settings: use browse_preferences to drill down from the top-level preference tree, search_preferences to find settings, and read_preferences to inspect exact values. Sensitive settings are masked; never ask the user to reveal API keys, tokens, passwords, or secrets to you.",
        "Settings UI: call list_preference_panes to discover built-in and plugin preference pane ids; call open_zotero_preferences with optional pane_id to open a specific page (another plugin or Zotero General/Sync/Export/etc.). Omit pane_id for this assistant pane.",
        "Settings writes: use set_preference only for existing non-sensitive Zotero or plugin preferences. Preserve the existing value type. For sensitive settings, call open_zotero_preferences and ask the user to configure them manually.",
        "If a setting change needs restart, call request_zotero_restart with a reason; Zotero restart requires explicit user authorization.",
        `Web: use live_search for public web queries (max ${MAX_LIVE_SEARCH_PER_TASK}/task). The old tool name web_search is invalid — if you tried web_search, call live_search instead. Use web_fetch to read a specific public URL as markdown (max ${MAX_WEB_FETCH_PER_TASK}/task). Cite sources in your summary. Do not fetch login-only or private URLs.`,
        "Low-risk writes may be proposed directly: create small numbers of collections, add tags, create or append notes, and add items to collections.",
        "Do not try to change itemType through update_metadata. If a top-level attachment needs to become a bibliographic parent-child structure, use create_parent_item.",
        "Never remove items from old collections unless explicitly approved. Never permanently delete anything.",
        `Limits: at most ${MAX_COLLECTIONS_PER_TASK} new collections and ${MAX_ITEMS_PER_TASK} processed items per task.`,
        "Prefer tool calls. If your provider ignores tool definitions, output JSON only in one of these shapes:",
        "{\"tool_calls\":[{\"name\":\"read_library_overview\",\"arguments\":{}}]}",
        "{\"actions\":[{\"tool\":\"finish_task\",\"args\":{\"summary\":\"...\"}}]}",
        "{\"name\":\"finish_task\",\"arguments\":{\"summary\":\"...\"}}",
        "User-visible messages (mandatory): You MUST communicate with the user in Chinese before ending. Either send a normal assistant message (plain text in the same turn as tools, or request_clarification), or end with finish_task.summary that clearly explains outcomes. Never end a task with only silent tool calls and an empty or one-word summary.",
        "finish_task is rejected if summary is missing/too short, or if this task has zero prior user-facing messages and summary is under 24 characters — in that case, reply to the user first, then call finish_task again."
      ].join("\n");
    }

    getFetch() {
      const win = this.firstWindow();
      if (win && typeof win.fetch === "function") {
        return win.fetch.bind(win);
      }
      if (typeof fetch === "function") {
        return fetch;
      }
      throw new Error("当前 Zotero 环境没有可用的 fetch 实现。");
    }

    normalizeAPIMode(value) {
      const mode = String(value || DEFAULT_API_MODE).trim().toLowerCase();
      if (mode === "chat" || mode === "responses" || mode === "completions") {
        return mode;
      }
      return DEFAULT_API_MODE;
    }

    resolveModelEndpoint(value, apiMode = DEFAULT_API_MODE) {
      const trimmed = String(value || DEFAULT_BASE_URL).replace(/\s+$/, "");
      const normalizedMode = this.normalizeAPIMode(apiMode);
      if (normalizedMode === "auto") {
        if (/\/responses(?:\?|$)/.test(trimmed)) {
          return { url: trimmed, mode: "responses", apiMode: normalizedMode };
        }
        if (/\/chat\/completions(?:\?|$)/.test(trimmed)) {
          return { url: trimmed, mode: "chat", apiMode: normalizedMode };
        }
        if (/\/completions(?:\?|$)/.test(trimmed)) {
          return { url: trimmed, mode: "completion", apiMode: normalizedMode };
        }
        return {
          url: trimmed.replace(/\/+$/, "") + "/chat/completions",
          mode: "chat",
          apiMode: normalizedMode
        };
      }

      const endpointPath = normalizedMode === "responses"
        ? "/responses"
        : normalizedMode === "chat"
          ? "/chat/completions"
          : "/completions";
      const mode = normalizedMode === "completions" ? "completion" : normalizedMode;
      const endpointMatch = trimmed.match(/^(.*?)(\/(?:chat\/completions|responses|completions))(\?.*)?$/);
      const root = endpointMatch ? endpointMatch[1] : trimmed.replace(/\/+$/, "");
      const query = endpointMatch && endpointMatch[3] ? endpointMatch[3] : "";
      return {
        url: root.replace(/\/+$/, "") + endpointPath + query,
        mode,
        apiMode: normalizedMode
      };
    }

    buildRequestVariants(endpoint, model, messages, options = {}) {
      const systemMessages = [
        {
          role: "system",
          content: this.systemPrompt()
        }
      ];
      if (options.systemInstruction) {
        systemMessages.push({
          role: "system",
          content: options.systemInstruction
        });
      }
      const chatRequest = {
        model,
        messages: [
          ...systemMessages,
          ...messages
        ]
      };
      if (!options.disableTools) {
        chatRequest.tools = TOOL_DEFINITIONS;
        chatRequest.tool_choice = "auto";
      }
      const responsesRequest = {
        model,
        instructions: this.buildResponsesInstructions(options),
        input: this.buildResponsesInput(messages)
      };
      if (!options.disableTools) {
        responsesRequest.tools = this.responsesToolDefinitions();
        responsesRequest.tool_choice = "auto";
      }
      const completionRequest = {
        model,
        prompt: this.buildCompletionPrompt(messages, options),
        max_tokens: 2000,
        temperature: 0.2
      };
      if (endpoint.mode === "chat") {
        return [{ label: "chat", mode: "chat", request: chatRequest, usedAsFallback: false }];
      }
      if (endpoint.mode === "responses") {
        return [{ label: "responses", mode: "responses", request: responsesRequest, usedAsFallback: false }];
      }
      return [
        { label: "chat-compatible completions", mode: "chat", request: chatRequest, usedAsFallback: false },
        { label: "plain completions fallback", mode: "completion", request: completionRequest, usedAsFallback: true }
      ];
    }

    buildResponsesInstructions(options = {}) {
      return [
        this.systemPrompt(),
        options.systemInstruction ? options.systemInstruction : ""
      ].filter(Boolean).join("\n\n");
    }

    responsesToolDefinitions() {
      return TOOL_DEFINITIONS
        .filter((definition) => definition && definition.type === "function" && definition.function)
        .map((definition) => ({
          type: "function",
          name: definition.function.name,
          description: definition.function.description || "",
          parameters: definition.function.parameters || { type: "object", properties: {} },
          strict: false
        }));
    }

    buildResponsesInput(messages) {
      const input = [];
      for (const message of Array.isArray(messages) ? messages : []) {
        if (!message) {
          continue;
        }
        if (message.role === "tool") {
          input.push({
            type: "function_call_output",
            call_id: message.tool_call_id || `tool-output-${input.length}`,
            output: this.normalizeTextContent(message.content) || this.debugContentPreview(message.content, DEBUG_MESSAGE_LIMIT)
          });
          continue;
        }
        if (message.role === "assistant") {
          const content = this.normalizeTextContent(message.content);
          if (content) {
            input.push({ role: "assistant", content });
          }
          if (Array.isArray(message.tool_calls)) {
            for (const call of message.tool_calls) {
              const functionCall = this.responsesFunctionCallInput(call, input.length);
              if (functionCall) {
                input.push(functionCall);
              }
            }
          }
          continue;
        }
        const content = this.normalizeTextContent(message.content) || this.debugContentPreview(message.content, DEBUG_MESSAGE_LIMIT);
        if (!content) {
          continue;
        }
        if (message.role === "system") {
          input.push({ role: "user", content: `[Internal instruction]\n${content}` });
        } else {
          input.push({ role: "user", content });
        }
      }
      return input.length ? input : [{ role: "user", content: "" }];
    }

    responsesFunctionCallInput(call, index) {
      const fn = call && call.function ? call.function : {};
      const name = call && (call.name || fn.name);
      if (!name) {
        return null;
      }
      const callID = call.call_id || call.id || `responses-call-${Date.now()}-${index}`;
      const args = fn.arguments !== undefined ? fn.arguments : call.arguments;
      const argsText = typeof args === "string" ? args : JSON.stringify(args || {});
      return {
        type: "function_call",
        id: call.id || callID,
        call_id: callID,
        name,
        arguments: argsText
      };
    }

    buildCompletionPrompt(messages, options = {}) {
      const transcript = [
        this.systemPrompt(),
        options.systemInstruction ? options.systemInstruction : "",
        "",
        "Conversation:",
        ...messages.map((message) => `${message.role || "assistant"}: ${typeof message.content === "string" ? message.content : JSON.stringify(message.content)}`),
        "",
        options.plainTextOnly ? "Return plain text only." : "Return JSON only."
      ];
      return transcript.filter(Boolean).join("\n");
    }

    normalizeModelResponse(json, mode, options = {}) {
      if (mode === "responses") {
        return this.normalizeResponsesModelResponse(json, options);
      }
      if (mode === "chat") {
        const message = json && json.choices && json.choices[0] && json.choices[0].message;
        if (!options.disableToolParsing && message && Array.isArray(message.tool_calls) && message.tool_calls.length) {
          return {
            role: message.role || "assistant",
            content: this.normalizeTextContent(message.content),
            tool_calls: message.tool_calls
          };
        }
        const content = this.normalizeTextContent(message && message.content);
        if (options.disableToolParsing) {
          return this.normalizePlainAssistantMessage(content);
        }
        return this.normalizeContentToolPlan(content) || this.normalizePlainAssistantMessage(content);
      }
      const choice = json && json.choices && json.choices[0];
      const text = this.normalizeTextContent(
        choice && (choice.text || choice.message && choice.message.content)
      );
      if (options.disableToolParsing) {
        return this.normalizePlainAssistantMessage(text);
      }
      return this.normalizeContentToolPlan(text) || this.normalizePlainAssistantMessage(text);
    }

    normalizeResponsesModelResponse(json, options = {}) {
      const choice = json && json.choices && json.choices[0];
      if (choice) {
        return this.normalizeModelResponse(json, choice.message ? "chat" : "completion", options);
      }

      const text = this.extractResponsesOutputText(json);
      if (options.disableToolParsing) {
        return this.normalizePlainAssistantMessage(text);
      }

      const tool_calls = this.extractResponsesToolCalls(json);
      if (tool_calls.length) {
        return {
          role: "assistant",
          content: text,
          tool_calls
        };
      }

      return this.normalizeContentToolPlan(text) || this.normalizePlainAssistantMessage(text);
    }

    extractResponsesOutputText(json) {
      if (!json || typeof json !== "object") {
        return "";
      }
      const direct = this.normalizeTextContent(json.output_text);
      if (direct) {
        return direct;
      }
      const parts = [];
      const output = Array.isArray(json.output) ? json.output : [];
      for (const item of output) {
        const text = this.extractResponsesTextPart(item);
        if (text) {
          parts.push(text);
        }
      }
      return parts.join("\n").trim();
    }

    extractResponsesTextPart(part) {
      if (!part) {
        return "";
      }
      if (typeof part === "string") {
        return part;
      }
      if (typeof part.text === "string") {
        return part.text;
      }
      if (typeof part.output_text === "string") {
        return part.output_text;
      }
      if (typeof part.refusal === "string") {
        return part.refusal;
      }
      if (Array.isArray(part.content)) {
        return part.content
          .map((entry) => this.extractResponsesTextPart(entry))
          .filter(Boolean)
          .join("\n");
      }
      return "";
    }

    extractResponsesToolCalls(json) {
      const calls = [];
      const output = Array.isArray(json && json.output) ? json.output : [];
      for (const item of output) {
        const call = this.toInternalToolCallFromResponses(item, calls.length);
        if (call) {
          calls.push(call);
        }
      }
      const directCalls = Array.isArray(json && json.tool_calls) ? json.tool_calls : [];
      for (const item of directCalls) {
        const call = this.toInternalToolCallFromResponses(item, calls.length);
        if (call) {
          calls.push(call);
        }
      }
      return calls;
    }

    toInternalToolCallFromResponses(item, index) {
      if (!item || typeof item !== "object") {
        return null;
      }
      const fn = item.function || {};
      const name = item.name || fn.name;
      const looksLikeFunctionCall = item.type === "function_call" || !!(name && (item.arguments !== undefined || fn.arguments !== undefined));
      if (!name || !looksLikeFunctionCall) {
        return null;
      }
      const rawArgs = item.arguments !== undefined ? item.arguments : fn.arguments;
      const args = typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs || {});
      return {
        id: item.call_id || item.id || `responses-call-${Date.now()}-${index}`,
        type: "function",
        function: {
          name,
          arguments: args
        }
      };
    }

    normalizePlainAssistantMessage(content) {
      const text = typeof content === "string" ? content.trim() : "";
      if (!text) {
        return null;
      }
      return {
        role: "assistant",
        content: text,
        tool_calls: []
      };
    }

    normalizeTextContent(content) {
      if (typeof content === "string") {
        return content.trim();
      }
      if (!Array.isArray(content)) {
        return "";
      }
      return content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }
          if (part && typeof part.text === "string") {
            return part.text;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n")
        .trim();
    }

    looksLikeToolPlanJson(candidate) {
      if (!candidate || typeof candidate !== "string") {
        return false;
      }
      let parsed = null;
      try {
        parsed = JSON.parse(candidate);
      } catch (error) {
        return false;
      }
      if (!parsed || typeof parsed !== "object") {
        return false;
      }
      let actions = [];
      if (Array.isArray(parsed)) {
        actions = parsed;
      } else if (Array.isArray(parsed.tool_calls)) {
        actions = parsed.tool_calls;
      } else if (Array.isArray(parsed.actions)) {
        actions = parsed.actions;
      } else if (parsed.name || parsed.tool) {
        actions = [parsed];
      } else {
        return false;
      }
      return actions.some((action) => action && (action.name || action.tool || (action.function && action.function.name)));
    }

    stripJsonToolPlanFromAssistantText(content) {
      let text = typeof content === "string" ? content : this.normalizeTextContent(content);
      if (!text) {
        return "";
      }
      text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, (match, inner) => {
        return this.looksLikeToolPlanJson(String(inner || "").trim()) ? "" : match;
      });
      const lines = text.split("\n");
      const kept = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && this.looksLikeToolPlanJson(trimmed)) {
          continue;
        }
        kept.push(line);
      }
      text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      if (text && this.looksLikeToolPlanJson(text)) {
        return "";
      }
      return text;
    }

    normalizeContentToolPlan(content) {
      if (!content || typeof content !== "string") {
        return null;
      }
      const candidates = [content.trim()];
      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenced && fenced[1]) {
        candidates.push(fenced[1].trim());
      }
      let parsed = null;
      for (const candidate of candidates) {
        try {
          parsed = JSON.parse(candidate);
          break;
        } catch (error) {
          continue;
        }
      }
      if (!parsed) {
        return null;
      }
      let actions = [];
      if (Array.isArray(parsed)) {
        actions = parsed;
      } else if (Array.isArray(parsed.tool_calls)) {
        actions = parsed.tool_calls;
      } else if (Array.isArray(parsed.actions)) {
        actions = parsed.actions;
      } else if (parsed.name || parsed.tool) {
        actions = [parsed];
      } else {
        return null;
      }
      const tool_calls = actions
        .map((action, index) => this.toToolCall(action, index))
        .filter(Boolean);
      if (!tool_calls.length) {
        return null;
      }
      const prose = this.stripJsonToolPlanFromAssistantText(content);
      return {
        role: "assistant",
        content: prose,
        tool_calls
      };
    }

    toToolCall(action, index) {
      const name = action.name || action.tool || action.function && action.function.name;
      if (!name) {
        return null;
      }
      let args = action.arguments || action.args || action.parameters || action.function && action.function.arguments || {};
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch (error) {
          args = {};
        }
      }
      return {
        id: `json-plan-${Date.now()}-${index}`,
        type: "function",
        function: {
          name,
          arguments: JSON.stringify(args || {})
        }
      };
    }

    async handleModelResponse(message) {
      this.task.messages.push(message);
      this.absorbAssistantMessageForChatDisplay(message);
      if (!Array.isArray(message.tool_calls) || !message.tool_calls.length) {
        await this.handlePlainAssistantMessage(message.content);
        return;
      }
      for (const call of message.tool_calls) {
        const name = call.function && call.function.name;
        const args = this.parseArguments(call.function && call.function.arguments);
        if (!name) {
          continue;
        }
        const approval = this.evaluateApproval(name, args);
        if (approval.required && !approval.allowed) {
          this.task.status = "waiting";
          this.task.pendingApproval = this.buildPendingApproval(call.id, name, args);
          this.log("approval.requested", this.task.pendingApproval);
          this.flushChatTurnToDisplay();
          this.renderAll();
          return;
        }
        const result = await this.executeTool(name, args);
        this.task.messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result)
        });
        if (result && result.ok === false) {
          this.task.messages.push({
            role: "system",
            content: `The tool ${name} failed with error: ${result.error || "unknown error"}. Adjust the plan and retry. Consecutive tool failures: ${this.task.consecutiveToolFailures || 1}/3.`
          });
          this.log("tool.retry_requested", {
            toolName: name,
            retryCount: this.task.consecutiveToolFailures || 1,
            error: result.error || "unknown error"
          });
          if ((this.task.consecutiveToolFailures || 0) >= 3) {
            this.task.status = "paused";
            this.task.phase = "tool_failed";
            this.task.error = `工具连续失败 3 次：${name} - ${result.error || "unknown error"}`;
            this.log("task.paused", {
              id: this.task.id,
              reason: this.task.error,
              source: "tool",
              toolName: name
            });
            await this.maybeWriteDebugReport("tool_failed", {
              reason: this.task.error,
              toolName: name,
              result,
              consecutiveToolFailures: this.task.consecutiveToolFailures || 0
            });
            await this.safeUpdateSessionMemoryForTask("tool_failed");
          }
          this.flushChatTurnToDisplay();
          return;
        }
      }
      if (this.task && this.task.status === "running") {
        this.renderChatPanelIfOpen();
        this.renderAll();
      } else if (this.task && (this.task.status === "waiting" || this.task.status === "complete" || this.task.status === "paused")) {
        this.flushChatTurnToDisplay();
        this.renderChatPanelIfOpen();
        this.renderAll();
      }
    }

    renderChatPanelIfOpen() {
      for (const state of this.windows.values()) {
        if (state && state.chatOpen) {
          this.renderChatPanel(state);
        }
      }
    }

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
    }

    async fetchModelResponseTextWithTimeout(fetchImpl, url, init, meta = {}) {
      const win = this.firstWindow();
      const supportsAbort = typeof AbortController !== "undefined";
      const controller = supportsAbort ? new AbortController() : null;
      let stage = "request";
      let timedOut = false;
      let responseInfo = null;
      let timer = null;
      const makeTimeoutError = () => this.makeModelError(
        stage === "body"
          ? `模型响应正文读取超时（超过 ${Math.round(MAX_MODEL_FETCH_MS / 1000)} 秒）。端点可能返回了响应头但没有结束正文，请检查是否启用了流式返回或兼容层卡住。`
          : `模型请求超时（超过 ${Math.round(MAX_MODEL_FETCH_MS / 1000)} 秒）。请检查网络、API 地址与密钥，或换更小的任务重试。`,
        {
          source: "model",
          timeoutMs: MAX_MODEL_FETCH_MS,
          stage,
          response: responseInfo,
          ...meta
        }
      );
      const timeoutPromise = new Promise((resolve, reject) => {
        const setTimer = win && typeof win.setTimeout === "function" ? win.setTimeout.bind(win) : setTimeout;
        timer = setTimer(() => {
          timedOut = true;
          if (controller) {
            controller.abort();
          }
          reject(makeTimeoutError());
        }, MAX_MODEL_FETCH_MS);
      });
      const workPromise = (async () => {
        const response = await fetchImpl(url, controller ? { ...init, signal: controller.signal } : init);
        if (timedOut) {
          throw makeTimeoutError();
        }
        const contentType = response.headers && typeof response.headers.get === "function"
          ? response.headers.get("content-type") || ""
          : "";
        responseInfo = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText || "",
          url: response.url || url,
          contentType
        };
        this.log("model.response.headers", {
          ...meta,
          ok: response.ok,
          status: response.status,
          contentType
        });
        stage = "body";
        const rawText = await response.text();
        if (timedOut) {
          throw makeTimeoutError();
        }
        this.log("model.response.body_read", {
          ...meta,
          ok: response.ok,
          status: response.status,
          rawTextLength: rawText.length
        });
        return { response, rawText };
      })();
      try {
        return await Promise.race([workPromise, timeoutPromise]);
      } catch (error) {
        if (error && (error.name === "AbortError" || String(error).includes("abort"))) {
          throw makeTimeoutError();
        }
        throw error;
      } finally {
        if (timer != null) {
          const clearTimer = win && typeof win.clearTimeout === "function" ? win.clearTimeout.bind(win) : clearTimeout;
          clearTimer(timer);
        }
      }
    }

    async handlePlainAssistantMessage(content) {
      const text = this.stripJsonToolPlanFromAssistantText(content);
      if (!text) {
        const pending = this.chatTurnPending;
        const hasPendingChat = pending && ((pending.aiReadable && pending.aiReadable.length) || (pending.process && pending.process.length));
        if (hasPendingChat) {
          this.flushChatTurnToDisplay();
          this.renderAll();
          return;
        }
        this.task.status = "paused";
        this.task.phase = "empty_response";
        this.task.error = "模型没有返回可显示文本，也没有返回工具调用。";
        this.log("task.paused", { id: this.task.id, reason: "empty_response" });
        await this.maybeWriteDebugReport("empty_response", {
          reason: this.task.error
        });
        await this.safeUpdateSessionMemoryForTask("empty_response");
        this.renderAll();
        return;
      }
      const state = this.firstState();
      const needsUserReply = /[?？]\s*$/.test(text) || /请问|需要你|请提供|请说明|告诉我/.test(text);
      this.task.summary = text;
      this.task.pendingApproval = null;
      this.task.plainAssistantTurnCount = (this.task.plainAssistantTurnCount || 0) + 1;
      if (needsUserReply) {
        this.task.error = null;
        this.task.status = "waiting";
        this.task.phase = "needs_user";
      } else {
        this.task.error = null;
        this.task.status = "running";
        this.task.phase = "awaiting_finish_task";
        this.task.messages.push({
          role: "system",
          content: "Plain assistant text was received, but the task must not end unless you explicitly call finish_task. If more work remains, continue with tools. If the task is complete, call finish_task with a concise final summary."
        });
      }
      this.flushChatTurnToDisplay();
      this.log("assistant.message", {
        id: this.task.id,
        needsUserReply,
        requiresExplicitFinish: !needsUserReply,
        text
      });
      if (state) {
        this.showMessage(state, text);
      }
      this.renderAll();
    }

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
    }

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
    }

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
    }

    resetChatTurnPending() {
      this.chatTurnPending = { userText: "", aiReadable: [], process: [] };
    }

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
    }

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
    }

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
    }

    pushChatTurnProcess(line) {
      const raw = String(line || "").trim();
      if (!raw || !this.chatTurnPending) {
        return;
      }
      this.chatTurnPending.process.push(raw);
    }

    compressProcessLinesForChat(lines) {
      const items = Array.isArray(lines) ? lines.filter(Boolean) : [];
      if (!items.length) {
        return "";
      }
      const maxLines = 10;
      const head = items.slice(0, maxLines);
      const tail = items.length > maxLines ? `\n… 另有 ${items.length - maxLines} 步未展开` : "";
      return ["【本回合后台操作】", ...head.map((line, index) => `${index + 1}. ${line}`)].join("\n") + tail;
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

    isChatTaskBusy() {
      return !!(this.task && this.task.status === "running");
    }

    resolveChatState(preferredState) {
      if (preferredState && preferredState.chatPanel) {
        return preferredState;
      }
      return this.firstState();
    }

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
    }

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
    }

    evaluateApproval(toolName, args) {
      const mode = Zotero.Prefs.get(PREFS.safetyMode, true) || DEFAULT_SAFETY_MODE;
      if (toolName === SESSION_GRANT_TOOL) {
        return {
          required: !this.hasSessionReadGrant(this.currentTaskLibraryID()),
          allowed: this.hasSessionReadGrant(this.currentTaskLibraryID())
        };
      }
      if (toolName === "request_zotero_restart") {
        return { required: true, allowed: false };
      }
      if (READ_TOOLS.has(toolName) || toolName === "request_clarification" || toolName === "finish_task") {
        return { required: false, allowed: true };
      }
      if (toolName === "set_preference") {
        const meta = this.preferenceMetadata(args && args.name);
        if (!meta.isWritable) {
          return { required: false, allowed: true };
        }
        if (meta.isHiddenOrInternal) {
          return { required: true, allowed: false };
        }
        const rememberedPreferencePrefix = this.hasPreferencePrefixGrant(meta.name);
        if (mode === "confirm") {
          return { required: true, allowed: rememberedPreferencePrefix };
        }
        if (mode === "open") {
          return { required: false, allowed: true };
        }
        if (meta.riskLevel === "low") {
          return { required: false, allowed: true };
        }
        return { required: true, allowed: rememberedPreferencePrefix };
      }
      const rememberKey = this.approvalKey(toolName, args);
      const remembered = !!this.rememberedApprovals[rememberKey];
      if (mode === "confirm") {
        return { required: true, allowed: remembered };
      }
      if (mode === "open") {
        return { required: false, allowed: true };
      }
      if (LOW_RISK_WRITE_TOOLS.has(toolName)) {
        return { required: false, allowed: true };
      }
      if (HIGH_RISK_WRITE_TOOLS.has(toolName)) {
        return { required: true, allowed: remembered };
      }
      return { required: false, allowed: true };
    }

    approvalKey(toolName, args) {
      if (toolName === "set_preference") {
        return `set_preference_prefix:${this.preferenceApprovalPrefix(args || {})}`;
      }
      if (toolName === "trigger_plugin_command") {
        return `${toolName}:${args.commandId || ""}`;
      }
      return toolName;
    }

    approvalSummary(toolName, args) {
      const summaries = {
        request_expanded_context: `AI 请求开放“${this.getLibraryName(this.currentTaskLibraryID())}”在本会话中的整库元数据读取。原因：${args.reason || "未说明"}`,
        create_parent_item: `AI 请求为附件 ${args.attachmentKey || ""} 创建一个 ${args.itemType || ""} 父条目，并将该附件挂到新父条目下。`,
        update_metadata: `AI 请求修改条目 ${args.itemKey || ""} 的元数据${Array.isArray(args.creators) ? " 和 creators" : ""}。`,
        set_preference: `AI 请求修改设置 ${args.name || ""}。原因：${args.reason || "未说明"}`,
        request_zotero_restart: `AI 请求重启 Zotero。原因：${args.reason || "未说明"}`,
        move_to_trash: `AI 请求将 ${args.itemKeys ? args.itemKeys.length : 0} 个条目移到回收站。原因：${args.reason || "未说明"}`,
        trigger_plugin_command: `AI 请求触发其他插件命令：${args.commandId || ""}。${args.summary || ""}`
      };
      return summaries[toolName] || `AI 请求执行 ${toolName}。`;
    }

    async executeTool(toolName, args) {
      this.log("tool.started", { toolName, args });
      let result;
      try {
        switch (toolName) {
          case "request_clarification":
            result = await this.toolRequestClarification(args);
            break;
          case "search_items":
            result = await this.toolSearchItems(args);
            break;
          case "read_current_context":
            result = await this.readCurrentContext(this.currentTaskLibraryID());
            break;
          case "read_item_fields":
            result = await this.toolReadItemFields(args);
            break;
          case "request_expanded_context":
            result = await this.toolExpandedContext(args);
            break;
          case "read_library_overview":
            result = await this.toolReadLibraryOverview(args);
            break;
          case "browse_library_items":
            result = await this.toolBrowseLibraryItems(args);
            break;
          case "read_fulltext_page":
          case "read_fulltext":
            result = await this.toolReadFulltextPage(args);
            break;
          case "live_search":
            result = await this.toolLiveSearch(args);
            break;
          case "web_search":
            result = {
              ok: false,
              error: "工具已更名为 live_search。请勿调用 web_search，请改用 live_search 并传入相同参数（如 query）。"
            };
            break;
          case "web_fetch":
            result = await this.toolWebFetch(args);
            break;
          case "create_collection":
            result = await this.toolCreateCollection(args);
            break;
          case "add_items_to_collection":
            result = await this.toolAddItemsToCollection(args);
            break;
          case "add_tags":
            result = await this.toolAddTags(args);
            break;
          case "create_note":
          case "append_note":
            result = await this.toolCreateNote(args);
            break;
          case "create_parent_item":
            result = await this.toolCreateParentItem(args);
            break;
          case "update_metadata":
            result = await this.toolUpdateMetadata(args);
            break;
          case "browse_preferences":
            result = await this.toolBrowsePreferences(args);
            break;
          case "search_preferences":
            result = await this.toolSearchPreferences(args);
            break;
          case "read_preferences":
            result = await this.toolReadPreferences(args);
            break;
          case "list_preference_panes":
            result = await this.toolListPreferencePanes(args);
            break;
          case "open_zotero_preferences":
            result = await this.toolOpenZoteroPreferences(args);
            break;
          case "set_preference":
            result = await this.toolSetPreference(args);
            break;
          case "request_zotero_restart":
            result = await this.toolRequestZoteroRestart(args);
            break;
          case "list_plugin_commands":
            result = await this.toolListPluginCommands();
            break;
          case "move_to_trash":
            result = await this.toolMoveToTrash(args);
            break;
          case "trigger_plugin_command":
            result = await this.toolTriggerPluginCommand(args);
            break;
          case "finish_task":
            result = await this.toolFinishTask(args);
            break;
          default:
            result = { ok: false, error: `未知工具：${toolName}` };
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

    async toolRequestClarification(args) {
      this.task.status = "waiting";
      this.task.phase = "needs_user";
      this.task.pendingApproval = null;
      const questionText = [
        args.question || "需要你补充任务目标。",
        args.recommendedAnswer ? `推荐：${args.recommendedAnswer}` : ""
      ].filter(Boolean).join("\n");
      this.flushChatTurnToDisplay();
      const state = this.firstState();
      if (state) {
        this.showMessage(state, questionText);
      }
      return { ok: true, waitingForUser: true };
    }

    currentTaskLibraryID() {
      return this.task && this.task.libraryID ? this.task.libraryID : this.getActiveLibraryID();
    }

    getActiveLibraryID(win = this.firstWindow()) {
      const pane = win && win.ZoteroPane;
      const libraryID = safeCall(() => pane.getSelectedLibraryID && pane.getSelectedLibraryID());
      if (libraryID) {
        return libraryID;
      }
      const selectedCollection = safeCall(() => pane.getSelectedCollection && pane.getSelectedCollection());
      if (selectedCollection && selectedCollection.libraryID) {
        return selectedCollection.libraryID;
      }
      const selectedItems = safeCall(() => pane.getSelectedItems && pane.getSelectedItems());
      if (selectedItems && selectedItems[0] && selectedItems[0].libraryID) {
        return selectedItems[0].libraryID;
      }
      return Zotero.Libraries.userLibraryID;
    }

    getLibrary(libraryID) {
      return Zotero.Libraries && Zotero.Libraries.get ? Zotero.Libraries.get(libraryID) : null;
    }

    getLibraryName(libraryID) {
      const library = this.getLibrary(libraryID);
      if (!library) {
        return `Library ${libraryID}`;
      }
      return library.name || library.treeViewID || `Library ${libraryID}`;
    }

    hasSessionReadGrant(libraryID) {
      return this.sessionReadGrants.has(String(libraryID));
    }

    grantSessionRead(libraryID) {
      const key = String(libraryID);
      if (this.sessionReadGrants.has(key)) {
        return;
      }
      this.sessionReadGrants.add(key);
      this.log("library.read_grant.granted", { libraryID, libraryName: this.getLibraryName(libraryID) });
      this.renderAll();
    }

    revokeSessionRead(libraryID) {
      const key = String(libraryID);
      if (!this.sessionReadGrants.delete(key)) {
        return;
      }
      this.log("library.read_grant.revoked", { libraryID, libraryName: this.getLibraryName(libraryID) });
      this.renderAll();
    }

    markAllIndexesDirty() {
      for (const index of this.libraryIndexes.values()) {
        index.dirty = true;
      }
    }

    markLibraryIndexDirty(libraryID) {
      if (!libraryID) {
        this.markAllIndexesDirty();
        return;
      }
      const index = this.libraryIndexes.get(String(libraryID));
      if (index) {
        index.dirty = true;
      }
    }

    buildPendingApproval(callID, toolName, args) {
      if (toolName === SESSION_GRANT_TOOL) {
        const libraryID = this.currentTaskLibraryID();
        return {
          id: callID,
          kind: "session_library_read",
          toolName,
          args,
          libraryID,
          summary: this.approvalSummary(toolName, args),
          details: JSON.stringify({
            libraryID,
            libraryName: this.getLibraryName(libraryID),
            scope: args.scope || "当前激活库整库元数据",
            reason: args.reason || ""
          }, null, 2),
          approveLabel: "允许本会话读取整库元数据",
          allowRemember: false,
          rememberKey: ""
        };
      }
      if (toolName === "set_preference") {
        const meta = this.preferenceMetadata(args.name);
        const rememberPrefix = this.preferenceApprovalPrefix(args);
        return {
          id: callID,
          kind: "preference_write",
          toolName,
          args,
          summary: this.approvalSummary(toolName, args),
          details: JSON.stringify({
            name: meta.name,
            currentValue: meta.value,
            newValue: meta.isSensitive ? this.maskSensitiveValue(args.value) : args.value,
            type: meta.type,
            riskLevel: meta.riskLevel,
            isSensitive: meta.isSensitive,
            isHiddenOrInternal: meta.isHiddenOrInternal,
            sourcePrefix: meta.sourcePrefix,
            proposedRememberPrefix: rememberPrefix,
            reason: args.reason || ""
          }, null, 2),
          approveLabel: "允许本次设置修改",
          allowRemember: meta.isWritable && !meta.isHiddenOrInternal && !!rememberPrefix,
          rememberKey: `set_preference_prefix:${rememberPrefix}`,
          rememberPrefix,
          rememberLabel: "记住此前缀"
        };
      }
      if (toolName === "request_zotero_restart") {
        return {
          id: callID,
          kind: "zotero_restart",
          toolName,
          args,
          summary: this.approvalSummary(toolName, args),
          details: JSON.stringify({ reason: args.reason || "" }, null, 2),
          approveLabel: "允许重启 Zotero",
          allowRemember: false,
          rememberKey: ""
        };
      }
      return {
        id: callID,
        kind: "write_or_command",
        toolName,
        args,
        summary: this.approvalSummary(toolName, args),
        details: JSON.stringify(args, null, 2),
        approveLabel: "允许本次",
        allowRemember: true,
        rememberKey: this.approvalKey(toolName, args)
      };
    }

    normalizeWebUrl(raw) {
      const trimmed = String(raw || "").trim();
      if (!trimmed) {
        return null;
      }
      let url;
      try {
        url = new URL(trimmed);
      } catch (error) {
        return null;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }
      const host = (url.hostname || "").toLowerCase();
      if (
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host === "127.0.0.1" ||
        host === "0.0.0.0" ||
        host === "::1" ||
        host.startsWith("127.") ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      ) {
        return null;
      }
      return url.toString();
    }

    hostnameMatchesDomain(hostname, domain) {
      const h = String(hostname || "").toLowerCase();
      const d = String(domain || "").toLowerCase().replace(/^\.+/, "");
      if (!h || !d) {
        return false;
      }
      return h === d || h.endsWith("." + d);
    }

    filterWebSearchResults(results, allowed, blocked) {
      const allowList = Array.isArray(allowed) ? allowed.filter(Boolean) : [];
      const blockList = Array.isArray(blocked) ? blocked.filter(Boolean) : [];
      return results.filter((row) => {
        let host = "";
        try {
          host = new URL(row.url).hostname;
        } catch (error) {
          return false;
        }
        if (blockList.some((d) => this.hostnameMatchesDomain(host, d))) {
          return false;
        }
        if (allowList.length && !allowList.some((d) => this.hostnameMatchesDomain(host, d))) {
          return false;
        }
        return true;
      });
    }

    resolveWebSearchProvider() {
      const pref = (Zotero.Prefs.get(PREFS.webSearchProvider, true) || "auto").trim().toLowerCase();
      const braveKey = (Zotero.Prefs.get(PREFS.braveSearchApiKey, true) || "").trim();
      if (pref === "brave") {
        return braveKey ? "brave" : "duckduckgo";
      }
      if (pref === "duckduckgo") {
        return "duckduckgo";
      }
      return braveKey ? "brave" : "duckduckgo";
    }

    async fetchWithTimeout(url, options = {}) {
      const fetchImpl = this.getFetch();
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      let timer = null;
      if (controller) {
        timer = setTimeout(() => controller.abort(), options.timeoutMs || WEB_FETCH_TIMEOUT_MS);
      }
      try {
        const response = await fetchImpl(url, {
          method: options.method || "GET",
          headers: options.headers || {},
          signal: controller ? controller.signal : undefined,
          redirect: "follow"
        });
        return response;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    async readResponseTextLimited(response, maxBytes) {
      if (!response || !response.body || typeof response.body.getReader !== "function") {
        const text = await response.text();
        return text.length > maxBytes ? text.slice(0, maxBytes) : text;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let received = 0;
      let chunks = "";
      while (received < maxBytes) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        received += value.length;
        if (received > maxBytes) {
          chunks += decoder.decode(value.slice(0, value.length - (received - maxBytes)), { stream: true });
          try {
            await reader.cancel();
          } catch (error) {
            /* ignore */
          }
          break;
        }
        chunks += decoder.decode(value, { stream: true });
      }
      chunks += decoder.decode();
      return chunks;
    }

    htmlToMarkdownLite(html) {
      let text = String(html || "");
      text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
      text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
      text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
      text = text.replace(/<!--[\s\S]*?-->/g, "");
      text = text.replace(/<br\s*\/?>/gi, "\n");
      text = text.replace(/<\/(p|div|section|article|header|footer|li|tr|h[1-6])>/gi, "\n\n");
      text = text.replace(/<h1[^>]*>/gi, "\n\n# ");
      text = text.replace(/<h2[^>]*>/gi, "\n\n## ");
      text = text.replace(/<h3[^>]*>/gi, "\n\n### ");
      text = text.replace(/<h4[^>]*>/gi, "\n\n#### ");
      text = text.replace(/<li[^>]*>/gi, "\n- ");
      text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, label) => {
        const inner = stripHTML(label).trim();
        return inner ? `[${inner}](${href})` : href;
      });
      text = text.replace(/<[^>]+>/g, " ");
      text = stripHTML(text);
      text = text.replace(/\n{3,}/g, "\n\n");
      return text.trim();
    }

    async toolLiveSearch(args) {
      if (!this.task) {
        return { ok: false, error: "没有活动任务。" };
      }
      const query = String(args.query || "").trim();
      if (query.length < 2) {
        return { ok: false, error: "搜索关键词至少需要 2 个字符。" };
      }
      if ((this.task.liveSearchCount || 0) >= MAX_LIVE_SEARCH_PER_TASK) {
        return { ok: false, error: `本次任务已达到最多 ${MAX_LIVE_SEARCH_PER_TASK} 次 live_search 限制。` };
      }
      const provider = this.resolveWebSearchProvider();
      let results = [];
      let providerLabel = provider;
      try {
        if (provider === "brave") {
          const apiKey = (Zotero.Prefs.get(PREFS.braveSearchApiKey, true) || "").trim();
          const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_WEB_SEARCH_RESULTS}`;
          const response = await this.fetchWithTimeout(endpoint, {
            timeoutMs: WEB_FETCH_TIMEOUT_MS,
            headers: {
              Accept: "application/json",
              "X-Subscription-Token": apiKey
            }
          });
          if (!response.ok) {
            const errText = await response.text();
            return {
              ok: false,
              error: `Brave Search HTTP ${response.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`
            };
          }
          const json = await response.json();
          const web = (json && json.web && json.web.results) || [];
          results = web.slice(0, MAX_WEB_SEARCH_RESULTS).map((row) => ({
            title: row.title || "",
            url: row.url || "",
            snippet: row.description || (row.extra_snippets && row.extra_snippets[0]) || ""
          }));
          providerLabel = "brave";
        } else {
          const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
          const response = await this.fetchWithTimeout(endpoint, {
            timeoutMs: WEB_FETCH_TIMEOUT_MS,
            headers: { Accept: "application/json" }
          });
          if (!response.ok) {
            return { ok: false, error: `DuckDuckGo HTTP ${response.status}` };
          }
          const json = await response.json();
          const related = Array.isArray(json.RelatedTopics) ? json.RelatedTopics : [];
          const flat = [];
          for (const topic of related) {
            if (topic.FirstURL && topic.Text) {
              flat.push({
                title: topic.Text.split(" - ")[0] || topic.Text,
                url: topic.FirstURL,
                snippet: topic.Text
              });
            }
            if (Array.isArray(topic.Topics)) {
              for (const sub of topic.Topics) {
                if (sub.FirstURL && sub.Text) {
                  flat.push({
                    title: sub.Text.split(" - ")[0] || sub.Text,
                    url: sub.FirstURL,
                    snippet: sub.Text
                  });
                }
              }
            }
          }
          if (json.AbstractURL && json.Abstract) {
            flat.unshift({
              title: json.Heading || query,
              url: json.AbstractURL,
              snippet: json.Abstract
            });
          }
          results = flat.slice(0, MAX_WEB_SEARCH_RESULTS);
          providerLabel = "duckduckgo_instant";
        }
      } catch (error) {
        return { ok: false, error: `网络搜索失败：${error}` };
      }
      results = results.filter((row) => row.url);
      results = this.filterWebSearchResults(results, args.allowed_domains, args.blocked_domains);
      this.task.liveSearchCount = (this.task.liveSearchCount || 0) + 1;
      this.log("live.search", { query, provider: providerLabel, count: results.length });
      return {
        ok: true,
        query,
        provider: providerLabel,
        results,
        note: providerLabel === "duckduckgo_instant"
          ? "Instant Answer API 结果可能较少；可在设置中配置 Brave Search API key 以获得完整网页结果。"
          : ""
      };
    }

    async toolWebFetch(args) {
      if (!this.task) {
        return { ok: false, error: "没有活动任务。" };
      }
      const prompt = String(args.prompt || "").trim();
      if (!prompt) {
        return { ok: false, error: "web_fetch 需要 prompt，说明要从页面提取什么。" };
      }
      const url = this.normalizeWebUrl(args.url);
      if (!url) {
        return { ok: false, error: "无效或不允许的 URL（仅支持 http/https，且禁止访问本机/内网地址）。" };
      }
      if ((this.task.webFetchCount || 0) >= MAX_WEB_FETCH_PER_TASK) {
        return { ok: false, error: `本次任务已达到最多 ${MAX_WEB_FETCH_PER_TASK} 次 web_fetch 限制。` };
      }
      let markdown = "";
      let contentType = "";
      try {
        const response = await this.fetchWithTimeout(url, {
          timeoutMs: WEB_FETCH_TIMEOUT_MS,
          headers: {
            Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8",
            "User-Agent": WEB_SEARCH_USER_AGENT
          }
        });
        if (!response.ok) {
          return { ok: false, error: `HTTP ${response.status} ${response.statusText || ""}`.trim() };
        }
        contentType = (response.headers && response.headers.get("content-type")) || "";
        const raw = await this.readResponseTextLimited(response, WEB_FETCH_MAX_BYTES);
        if (/application\/json/i.test(contentType)) {
          try {
            markdown = "```json\n" + JSON.stringify(JSON.parse(raw), null, 2) + "\n```";
          } catch (error) {
            markdown = raw;
          }
        } else if (/text\/plain/i.test(contentType)) {
          markdown = raw;
        } else {
          markdown = this.htmlToMarkdownLite(raw);
        }
        if (markdown.length > WEB_FETCH_MAX_CHARS) {
          markdown = markdown.slice(0, WEB_FETCH_MAX_CHARS) + "\n\n…（内容已截断）";
        }
      } catch (error) {
        return { ok: false, error: `抓取失败：${error}` };
      }
      this.task.webFetchCount = (this.task.webFetchCount || 0) + 1;
      this.log("web.fetch", { url, prompt: this.truncateText(prompt, 120), chars: markdown.length });
      return {
        ok: true,
        url,
        prompt,
        contentType,
        markdown,
        instruction: "根据上方 markdown 正文回答 prompt；若信息不足请说明并建议改用 live_search 或其他 URL。"
      };
    }

    async injectTaskContext() {
      if (!this.task || this.task.contextInjected) {
        return;
      }
      const currentContext = await this.readCurrentContext(this.task.libraryID);
      this.task.messages.push({
        role: "system",
        content: `Bound Zotero library for this task:\n${JSON.stringify({
          id: this.task.libraryID,
          name: this.task.libraryName,
          sessionMetadataAccess: this.hasSessionReadGrant(this.task.libraryID)
        })}`
      });
      const sessionMemory = this.isSessionMemoryEnabled() ? this.getSessionMemory(this.task.libraryID) : null;
      if (sessionMemory && sessionMemory.summary) {
        this.task.messages.push({
          role: "system",
          content: [
            "Session memory for this Zotero library from earlier tasks in the current Zotero session:",
            `Updated: ${sessionMemory.updatedAt || ""}`,
            `Reason: ${sessionMemory.updateReason || ""}`,
            "",
            sessionMemory.summary
          ].join("\n")
        });
        this.task.sessionMemoryInjected = true;
        this.task.sessionMemoryChars = sessionMemory.summary.length;
      }
      this.task.messages.push({
        role: "system",
        content: `Current Zotero context for this task:\n${JSON.stringify(currentContext)}`
      });
      if (this.hasSessionReadGrant(this.task.libraryID)) {
        const overview = await this.getLibraryOverviewPayload(this.task.libraryID);
        this.task.messages.push({
          role: "system",
          content: `Library overview for this task:\n${JSON.stringify(overview)}`
        });
      }
      this.task.contextInjected = true;
      this.log("task.context.injected", {
        id: this.task.id,
        libraryID: this.task.libraryID,
        sessionMetadataAccess: this.hasSessionReadGrant(this.task.libraryID),
        sessionMemoryChars: sessionMemory && sessionMemory.summary ? sessionMemory.summary.length : 0
      });
    }

    async readCurrentContext(libraryID = this.currentTaskLibraryID()) {
      const win = this.firstWindow();
      const pane = win && win.ZoteroPane;
      const activeLibraryID = this.getActiveLibraryID(win);
      const sameLibrary = activeLibraryID === libraryID;
      const selectedItems = sameLibrary && pane && pane.getSelectedItems ? pane.getSelectedItems() : [];
      const selectedCollection = sameLibrary && pane && pane.getSelectedCollection ? pane.getSelectedCollection() : null;
      const items = selectedItems.slice(0, MAX_ITEMS_PER_TASK).map((item) => this.itemSummary(item));
      return {
        boundLibrary: {
          id: libraryID,
          name: this.getLibraryName(libraryID)
        },
        activeLibrary: {
          id: activeLibraryID,
          name: this.getLibraryName(activeLibraryID)
        },
        activeLibraryMatchesTask: sameLibrary,
        selectedCollection: selectedCollection ? this.collectionSummary(selectedCollection) : null,
        selectedItems: items,
        selectedItemCount: selectedItems.length,
        limitApplied: selectedItems.length > MAX_ITEMS_PER_TASK,
        note: sameLibrary ? "" : "The Zotero UI focus moved to another library after this task started, so selection-based context is suppressed."
      };
    }

    async toolSearchItems(args) {
      const query = String(args.query || "").trim();
      const limit = Math.min(Math.max(Number(args.limit || DEFAULT_BROWSE_PAGE_SIZE), 1), MAX_ITEMS_PER_TASK);
      if (!query) {
        return { ok: false, error: "搜索关键词为空。" };
      }
      const search = new Zotero.Search();
      search.libraryID = this.currentTaskLibraryID();
      search.addCondition("quicksearch-titleCreatorYear", "contains", query);
      const ids = await search.search();
      const items = Zotero.Items.get(ids.slice(0, limit)).map((item) => this.itemSummary(item));
      return {
        ok: true,
        library: {
          id: this.currentTaskLibraryID(),
          name: this.getLibraryName(this.currentTaskLibraryID())
        },
        query,
        count: ids.length,
        limitApplied: ids.length > limit,
        items
      };
    }

    async toolReadItemFields(args) {
      const itemKey = String(args.itemKey || "").trim();
      if (!itemKey) {
        return { ok: false, error: "itemKey 为空。" };
      }
      const item = await this.getItemByKey(itemKey);
      if (!item) {
        return { ok: false, error: "找不到条目。" };
      }
      return {
        ok: true,
        library: {
          id: this.currentTaskLibraryID(),
          name: this.getLibraryName(this.currentTaskLibraryID())
        },
        item: this.itemSummary(item),
        metadata: this.itemMetadataSnapshot(item)
      };
    }

    itemSummary(item, extra = {}) {
      const summary = {
        key: item.key,
        id: item.id,
        libraryID: item.libraryID,
        itemType: item.itemType,
        title: safeCall(() => item.getField("title")) || safeCall(() => item.getDisplayTitle()) || `[${item.itemType}]`,
        creators: safeCall(() => item.getCreators()).map((creator) => creator.lastName || creator.name).filter(Boolean),
        year: safeCall(() => item.getField("date")),
        publicationTitle: safeCall(() => item.getField("publicationTitle")),
        abstractNote: truncateText(safeCall(() => item.getField("abstractNote")), ABSTRACT_PREVIEW_LENGTH),
        tags: safeCall(() => item.getTags()).map((tag) => tag.tag),
        collections: safeCall(() => item.getCollections()).map((id) => {
          const collection = Zotero.Collections.get(id);
          return collection ? { id: collection.id, key: collection.key, name: collection.name } : null;
        }).filter(Boolean),
        notes: { count: 0, previews: [] },
        annotations: { count: 0, previews: [] }
      };
      return Object.assign(summary, extra);
    }

    creatorTypeName(value) {
      if (!value && value !== 0) {
        return "";
      }
      if (typeof value === "string") {
        return value;
      }
      try {
        if (Zotero.CreatorTypes && typeof Zotero.CreatorTypes.getName === "function") {
          return Zotero.CreatorTypes.getName(value) || String(value);
        }
      } catch (error) {
      }
      return String(value);
    }

    creatorSnapshot(creator) {
      if (!creator || typeof creator !== "object") {
        return null;
      }
      const out = {
        creatorType: this.creatorTypeName(creator.creatorType || creator.creatorTypeID),
        firstName: String(creator.firstName || "").trim(),
        lastName: String(creator.lastName || "").trim(),
        name: String(creator.name || "").trim(),
        fieldMode: creator.fieldMode ? 1 : 0
      };
      return out;
    }

    itemFieldDescriptors(item) {
      const descriptors = [];
      const fieldIDs = safeCall(() => Zotero.ItemFields.getItemTypeFields(item.itemTypeID));
      if (!Array.isArray(fieldIDs)) {
        return descriptors;
      }
      for (const fieldID of fieldIDs) {
        try {
          const name = Zotero.ItemFields.getName(fieldID);
          if (!name) {
            continue;
          }
          descriptors.push({
            id: fieldID,
            name,
            label: typeof Zotero.ItemFields.getLocalizedString === "function"
              ? (Zotero.ItemFields.getLocalizedString(fieldID) || name)
              : name
          });
        } catch (error) {
        }
      }
      return descriptors;
    }

    itemMetadataSnapshot(item) {
      const descriptors = this.itemFieldDescriptors(item);
      const fields = descriptors.map((descriptor) => {
        const value = safeCall(() => item.getField(descriptor.name));
        return {
          name: descriptor.name,
          label: descriptor.label,
          value: value == null ? "" : String(value),
          isEmpty: !String(value || "").trim()
        };
      });
      const nonEmptyFields = fields.filter((field) => !field.isEmpty);
      const emptyFields = fields.filter((field) => field.isEmpty).map((field) => ({
        name: field.name,
        label: field.label
      }));
      const creators = safeCall(() => item.getCreators());
      return {
        itemType: item.itemType,
        fields,
        nonEmptyFields,
        emptyFields,
        creators: Array.isArray(creators) ? creators.map((creator) => this.creatorSnapshot(creator)).filter(Boolean) : [],
        tags: this.itemTagNames(item),
        collectionCount: this.itemCollectionIDs(item).length
      };
    }

    collectionSummary(collection) {
      const parent = collection.parentID ? Zotero.Collections.get(collection.parentID) : null;
      return {
        id: collection.id,
        key: collection.key,
        name: collection.name,
        libraryID: collection.libraryID,
        parentID: collection.parentID || null,
        parentKey: parent ? parent.key : null
      };
    }

    async toolExpandedContext(args) {
      const libraryID = this.currentTaskLibraryID();
      if (!this.hasSessionReadGrant(libraryID)) {
        return {
          ok: false,
          error: "当前库尚未开放本会话整库元数据读取。"
        };
      }
      const overview = await this.getLibraryOverviewPayload(libraryID);
      return {
        ok: true,
        granted: true,
        library: {
          id: libraryID,
          name: this.getLibraryName(libraryID)
        },
        requestedScope: args.scope || "当前激活库整库元数据",
        reason: args.reason || "",
        overview
      };
    }

    async toolReadLibraryOverview() {
      const libraryID = this.currentTaskLibraryID();
      if (!this.hasSessionReadGrant(libraryID)) {
        return {
          ok: false,
          error: "当前库尚未开放本会话整库元数据读取。请先调用 request_expanded_context。"
        };
      }
      return this.getLibraryOverviewPayload(libraryID);
    }

    async toolBrowseLibraryItems(args) {
      const libraryID = this.currentTaskLibraryID();
      if (!this.hasSessionReadGrant(libraryID)) {
        return {
          ok: false,
          error: "当前库尚未开放本会话整库元数据读取。请先调用 request_expanded_context。"
        };
      }
      const index = await this.ensureLibraryIndex(libraryID);
      const pageSize = Math.min(Math.max(Number(args.pageSize || DEFAULT_BROWSE_PAGE_SIZE), 1), MAX_BROWSE_PAGE_SIZE);
      const page = Math.max(Number(args.page || 1), 1);
      const filtered = this.filterLibraryItems(index, args);
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return {
        ok: true,
        library: {
          id: libraryID,
          name: this.getLibraryName(libraryID)
        },
        page,
        pageSize,
        totalCount: filtered.length,
        hasMore: start + pageSize < filtered.length,
        appliedFilters: {
          query: args.query || "",
          collectionKey: args.collectionKey || "",
          includeDescendants: args.includeDescendants !== false,
          tag: args.tag || "",
          creator: args.creator || "",
          year: args.year || ""
        },
        items
      };
    }

    async toolReadFulltextPage(args) {
      const itemKey = String(args.itemKey || "").trim();
      if (!itemKey) {
        return { ok: false, error: "itemKey 为空。" };
      }
      const item = await this.getItemByKey(itemKey);
      if (!item) {
        return { ok: false, error: "找不到条目。" };
      }
      const target = this.resolveFulltextTarget(item);
      if (!target) {
        return { ok: false, error: "该条目没有可读取全文的附件。" };
      }
      const fulltextResult = await this.readFulltextText(target);
      if (!fulltextResult.ok) {
        return fulltextResult;
      }
      const text = fulltextResult.text;
      if (!text) {
        return { ok: false, error: "该条目没有可用全文内容。" };
      }
      const offset = Math.max(Number(args.cursor || 0) || 0, 0);
      const slice = text.slice(offset, offset + FULLTEXT_PAGE_CHARS);
      const nextOffset = offset + slice.length;
      const owner = this.resolveOwningItem(item);
      return {
        ok: true,
        library: {
          id: this.currentTaskLibraryID(),
          name: this.getLibraryName(this.currentTaskLibraryID())
        },
        itemKey: owner ? owner.key : item.key,
        attachmentKey: target.key,
        title: owner ? (safeCall(() => owner.getField("title")) || safeCall(() => owner.getDisplayTitle())) : (safeCall(() => item.getField("title")) || safeCall(() => item.getDisplayTitle())),
        cursor: String(offset),
        nextCursor: nextOffset < text.length ? String(nextOffset) : null,
        hasMore: nextOffset < text.length,
        text: slice,
        totalLength: text.length,
        fulltextSource: fulltextResult.source || "unknown",
        indexedOnDemand: !!fulltextResult.indexedOnDemand
      };
    }

    async ensureLibraryIndex(libraryID) {
      const key = String(libraryID);
      const existing = this.libraryIndexes.get(key);
      if (existing && !existing.dirty) {
        return existing;
      }
      const index = await this.buildLibraryIndex(libraryID);
      this.libraryIndexes.set(key, index);
      return index;
    }

    async buildLibraryIndex(libraryID) {
      const topLevelItems = await Zotero.Items.getAll(libraryID, true);
      const allItems = await Zotero.Items.getAll(libraryID);
      const collections = Zotero.Collections.getByLibrary ? Zotero.Collections.getByLibrary(libraryID, true) : [];
      const topLevelSummaries = topLevelItems.map((item) => this.itemSummary(item));
      const topLevelMap = new Map(topLevelSummaries.map((summary) => [summary.id, summary]));
      const allItemsByID = new Map(allItems.map((item) => [item.id, item]));
      let noteCount = 0;
      let annotationCount = 0;

      for (const item of allItems) {
        if (!item || !item.parentID) {
          continue;
        }
        const owner = this.findTopLevelSummary(item, allItemsByID, topLevelMap);
        if (!owner) {
          continue;
        }
        if (this.isNoteItem(item)) {
          noteCount++;
          owner.notes.count++;
          if (owner.notes.previews.length < 3) {
            owner.notes.previews.push({
              key: item.key,
              preview: this.notePreview(item)
            });
          }
          continue;
        }
        if (this.isAnnotationItem(item)) {
          annotationCount++;
          owner.annotations.count++;
          if (owner.annotations.previews.length < 3) {
            owner.annotations.previews.push({
              key: item.key,
              preview: this.annotationPreview(item)
            });
          }
        }
      }

      const collectionMap = new Map();
      const childrenByParentID = new Map();
      for (const collection of collections) {
        const parent = collection.parentID ? Zotero.Collections.get(collection.parentID) : null;
        const node = {
          id: collection.id,
          key: collection.key,
          name: collection.name,
          parentID: collection.parentID || null,
          parentKey: parent ? parent.key : null,
          level: typeof collection.level === "number" ? collection.level : 0,
          exactItemCount: 0,
          itemCount: 0,
          childCollectionCount: 0
        };
        collectionMap.set(node.id, node);
        if (node.parentID) {
          if (!childrenByParentID.has(node.parentID)) {
            childrenByParentID.set(node.parentID, []);
          }
          childrenByParentID.get(node.parentID).push(node.id);
        }
      }

      const tagCounts = new Map();
      const itemTypeCounts = new Map();
      for (const item of topLevelSummaries) {
        itemTypeCounts.set(item.itemType, (itemTypeCounts.get(item.itemType) || 0) + 1);
        for (const tag of item.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
        for (const collection of item.collections) {
          const node = collectionMap.get(collection.id);
          if (node) {
            node.exactItemCount++;
          }
        }
      }

      const collectionsByDepth = Array.from(collectionMap.values()).sort((a, b) => b.level - a.level);
      const descendantKeysByKey = new Map();
      for (const node of collectionsByDepth) {
        const childIDs = childrenByParentID.get(node.id) || [];
        node.childCollectionCount = childIDs.length;
        let total = node.exactItemCount;
        const descendantKeys = new Set();
        for (const childID of childIDs) {
          const child = collectionMap.get(childID);
          if (!child) {
            continue;
          }
          total += child.itemCount;
          descendantKeys.add(child.key);
          const nested = descendantKeysByKey.get(child.key) || [];
          for (const key of nested) {
            descendantKeys.add(key);
          }
        }
        node.itemCount = total;
        descendantKeysByKey.set(node.key, Array.from(descendantKeys));
      }

      const sortedItems = topLevelSummaries.sort((a, b) => {
        const left = (a.title || "").toLowerCase();
        const right = (b.title || "").toLowerCase();
        return left.localeCompare(right, "zh-Hans-CN");
      });

      return {
        libraryID,
        libraryName: this.getLibraryName(libraryID),
        builtAt: Date.now(),
        dirty: false,
        items: sortedItems,
        collections: Array.from(collectionMap.values()).sort((a, b) => {
          if (a.level !== b.level) {
            return a.level - b.level;
          }
          return a.name.localeCompare(b.name, "zh-Hans-CN");
        }),
        descendantKeysByKey,
        tagStats: mapCountsToSortedPairs(tagCounts),
        itemTypeStats: mapCountsToSortedPairs(itemTypeCounts),
        noteCount,
        annotationCount
      };
    }

    filterLibraryItems(index, args) {
      const query = String(args.query || "").trim().toLowerCase();
      const tag = String(args.tag || "").trim().toLowerCase();
      const creator = String(args.creator || "").trim().toLowerCase();
      const year = String(args.year || "").trim();
      const collectionKey = String(args.collectionKey || "").trim();
      const includeDescendants = args.includeDescendants !== false;
      let allowedCollectionKeys = null;
      if (collectionKey) {
        allowedCollectionKeys = new Set([collectionKey]);
        if (includeDescendants) {
          const descendants = index.descendantKeysByKey.get(collectionKey) || [];
          for (const key of descendants) {
            allowedCollectionKeys.add(key);
          }
        }
      }

      return index.items.filter((item) => {
        if (allowedCollectionKeys && !item.collections.some((collection) => allowedCollectionKeys.has(collection.key))) {
          return false;
        }
        if (tag && !item.tags.some((value) => value.toLowerCase().includes(tag))) {
          return false;
        }
        if (creator && !item.creators.some((value) => value.toLowerCase().includes(creator))) {
          return false;
        }
        if (year && extractYear(item.year) !== year) {
          return false;
        }
        if (query) {
          const haystack = [
            item.title,
            item.publicationTitle,
            item.abstractNote,
            item.creators.join(" "),
            item.tags.join(" "),
            item.notes.previews.map((value) => value.preview).join(" "),
            item.annotations.previews.map((value) => value.preview).join(" ")
          ].join(" ").toLowerCase();
          if (!haystack.includes(query)) {
            return false;
          }
        }
        return true;
      });
    }

    async getLibraryOverviewPayload(libraryID) {
      const index = await this.ensureLibraryIndex(libraryID);
      return {
        ok: true,
        library: {
          id: libraryID,
          name: index.libraryName
        },
        builtAt: index.builtAt,
        totals: {
          topLevelItems: index.items.length,
          collections: index.collections.length,
          notes: index.noteCount,
          annotations: index.annotationCount
        },
        itemTypes: index.itemTypeStats,
        topTags: index.tagStats.slice(0, MAX_OVERVIEW_TAGS),
        collectionTree: index.collections.slice(0, MAX_OVERVIEW_COLLECTIONS).map((collection) => ({
          key: collection.key,
          name: collection.name,
          level: collection.level,
          itemCount: collection.itemCount,
          childCollectionCount: collection.childCollectionCount
        })),
        collectionTreeTruncated: index.collections.length > MAX_OVERVIEW_COLLECTIONS
      };
    }

    findTopLevelSummary(item, allItemsByID, topLevelMap) {
      let cursor = item;
      const visited = new Set();
      while (cursor && cursor.parentID && !visited.has(cursor.id)) {
        visited.add(cursor.id);
        const parent = allItemsByID.get(cursor.parentID);
        if (!parent) {
          break;
        }
        if (topLevelMap.has(parent.id)) {
          return topLevelMap.get(parent.id);
        }
        cursor = parent;
      }
      return null;
    }

    isNoteItem(item) {
      return item && item.itemType === "note";
    }

    isAnnotationItem(item) {
      return item && item.itemType === "annotation";
    }

    notePreview(item) {
      return truncateText(stripHTML(safeCall(() => item.getNote())), NOTE_PREVIEW_LENGTH);
    }

    annotationPreview(item) {
      const text = [
        safeCall(() => item.annotationText),
        safeCall(() => item.annotationComment),
        safeCall(() => item.getField && item.getField("annotationText")),
        safeCall(() => item.getField && item.getField("annotationComment"))
      ].filter(Boolean).join(" ");
      return truncateText(stripHTML(text), NOTE_PREVIEW_LENGTH);
    }

    getFulltextAPI() {
      return Zotero.FullText || Zotero.Fulltext || null;
    }

    async pathExists(path) {
      if (!path) {
        return false;
      }
      try {
        if (typeof OS !== "undefined" && OS.File && typeof OS.File.exists === "function") {
          return await OS.File.exists(path);
        }
        if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") {
          return await IOUtils.exists(path);
        }
      } catch (error) {
      }
      return false;
    }

    async readAttachmentTextFromPath(path, charset) {
      if (!path || !Zotero.File || typeof Zotero.File.getContentsAsync !== "function") {
        return "";
      }
      try {
        const content = await Zotero.File.getContentsAsync(path, charset || undefined);
        return normalizeFulltextContent(content);
      } catch (error) {
        return "";
      }
    }

    async readFulltextFromModernAPI(fulltext, item) {
      const contentType = String(item && item.attachmentContentType || "").trim();
      if (!fulltext || typeof fulltext.getItemCacheFile !== "function") {
        return { text: "", source: "", usedCache: false };
      }

      const cacheFile = fulltext.getItemCacheFile(item);
      const cachePath = cacheFile && cacheFile.path;
      if (cachePath && await this.pathExists(cachePath)) {
        const text = await this.readAttachmentTextFromPath(cachePath, "utf-8");
        if (text) {
          return { text, source: "zotero9-cache", usedCache: true };
        }
      }

      const isTextType = !!(Zotero.MIME && typeof Zotero.MIME.isTextType === "function" && Zotero.MIME.isTextType(contentType));
      if (isTextType && typeof item.getFilePathAsync === "function") {
        const filePath = await item.getFilePathAsync();
        if (filePath && await this.pathExists(filePath)) {
          const text = await this.readAttachmentTextFromPath(filePath, item.attachmentCharset);
          if (text) {
            return { text, source: "zotero9-source-file", usedCache: false };
          }
        }
      }

      return { text: "", source: "", usedCache: false };
    }

    async readFulltextText(item) {
      const fulltext = this.getFulltextAPI();
      if (!fulltext) {
        return { ok: false, error: "当前 Zotero 环境没有可用的 FullText 接口。" };
      }

      if (typeof fulltext.getItemCacheFile === "function") {
        let modern = await this.readFulltextFromModernAPI(fulltext, item);
        if (modern.text) {
          return { ok: true, text: modern.text, source: modern.source, indexedOnDemand: false };
        }
        if (typeof fulltext.indexItems === "function") {
          try {
            await fulltext.indexItems([item.id], { ignoreErrors: true });
          } catch (error) {
          }
          modern = await this.readFulltextFromModernAPI(fulltext, item);
          if (modern.text) {
            return { ok: true, text: modern.text, source: modern.source, indexedOnDemand: true };
          }
        }
        const contentType = String(item && item.attachmentContentType || "").trim() || "unknown";
        return {
          ok: false,
          error: `Zotero 9 未返回可读全文内容。附件类型：${contentType}。若这是 PDF，通常表示全文索引或文本缓存尚未生成。`
        };
      }

      if (typeof fulltext.getItemContent === "function") {
        const legacy = await fulltext.getItemContent(item.id);
        const text = normalizeFulltextContent(legacy);
        if (text) {
          return { ok: true, text, source: "legacy-getItemContent", indexedOnDemand: false };
        }
        return { ok: false, error: "旧版 Fulltext 接口返回了空内容。" };
      }

      return { ok: false, error: "当前 Zotero 环境存在 FullText 对象，但没有可读全文的方法。" };
    }

    resolveFulltextTarget(item) {
      if (!item) {
        return null;
      }
      if (isAttachmentItem(item)) {
        return item;
      }
      const attachmentIDs = safeCall(() => item.getAttachments());
      for (const id of attachmentIDs || []) {
        const attachment = Zotero.Items.get(id);
        if (attachment && isAttachmentItem(attachment)) {
          return attachment;
        }
      }
      return null;
    }

    resolveOwningItem(item) {
      if (!item) {
        return null;
      }
      if (!item.parentID) {
        return item;
      }
      const parent = Zotero.Items.get(item.parentID);
      return parent ? this.resolveOwningItem(parent) : item;
    }

    isSupportedParentItemType(itemType) {
      const normalized = String(itemType || "").trim();
      if (!normalized) {
        return false;
      }
      if (normalized === "attachment" || normalized === "note" || normalized === "annotation") {
        return false;
      }
      try {
        const probe = new Zotero.Item(normalized);
        return !isAttachmentItem(probe) && !this.isNoteItem(probe) && !this.isAnnotationItem(probe);
      } catch (error) {
        return false;
      }
    }

    normalizeCreators(creators) {
      const normalized = [];
      for (const creator of Array.isArray(creators) ? creators : []) {
        if (!creator || typeof creator !== "object") {
          continue;
        }
        const creatorType = String(creator.creatorType || "author").trim() || "author";
        const name = String(creator.name || "").trim();
        const firstName = String(creator.firstName || "").trim();
        const lastName = String(creator.lastName || "").trim();
        if (name) {
          normalized.push({
            creatorType,
            name,
            fieldMode: 1
          });
        } else if (firstName || lastName) {
          normalized.push({
            creatorType,
            firstName,
            lastName
          });
        }
      }
      return normalized;
    }

    currentCreatorsSnapshot(item) {
      const creators = safeCall(() => item.getCreators());
      return Array.isArray(creators) ? creators.map((creator) => this.creatorSnapshot(creator)).filter(Boolean) : [];
    }

    itemTagNames(item) {
      const tags = safeCall(() => item.getTags());
      return Array.isArray(tags) ? tags.map((tag) => tag.tag).filter(Boolean) : [];
    }

    itemCollectionIDs(item) {
      const collections = safeCall(() => item.getCollections());
      return Array.isArray(collections) ? collections.filter(Boolean) : [];
    }

    defaultParentTitleForAttachment(attachment) {
      return safeCall(() => attachment.getField("title"))
        || safeCall(() => attachment.getDisplayTitle())
        || safeCall(() => attachment.attachmentFilename)
        || "Imported attachment";
    }

    async addItemToCollectionIDs(itemID, collectionIDs) {
      const uniqueIDs = Array.from(new Set((collectionIDs || []).filter(Boolean)));
      if (!uniqueIDs.length) {
        return;
      }
      await Zotero.DB.executeTransaction(async () => {
        for (const collectionID of uniqueIDs) {
          const collection = Zotero.Collections.get(collectionID);
          if (collection) {
            await collection.addItems([itemID]);
          }
        }
      });
    }

    async toolCreateCollection(args) {
      if (this.task.createdCollections >= MAX_COLLECTIONS_PER_TASK) {
        return { ok: false, error: "本次任务已达到最多 5 个新建 collections 的限制。" };
      }
      const collection = new Zotero.Collection();
      collection.libraryID = this.currentTaskLibraryID();
      collection.name = args.name;
      if (args.parentKey) {
        const parent = await this.getCollectionByKey(args.parentKey);
        if (parent) {
          collection.parentID = parent.id;
        }
      }
      await collection.saveTx();
      this.task.createdCollections++;
      this.undoStack.push({
        type: "delete_collection",
        collectionID: collection.id,
        summary: `撤销创建 collection：${collection.name}`
      });
      this.markLibraryIndexDirty(this.currentTaskLibraryID());
      return { ok: true, collection: this.collectionSummary(collection) };
    }

    async toolAddItemsToCollection(args) {
      const collection = await this.getCollectionByKey(args.collectionKey);
      if (!collection) {
        return { ok: false, error: "找不到目标 collection。" };
      }
      const itemIDs = [];
      for (const key of args.itemKeys || []) {
        const item = await this.getItemByKey(key);
        if (item) {
          itemIDs.push(item.id);
        }
      }
      if (itemIDs.length > MAX_ITEMS_PER_TASK) {
        return { ok: false, error: "本次任务处理条目超过 100 条限制。" };
      }
      const before = new Set(collection.getChildItems(true));
      await Zotero.DB.executeTransaction(async () => {
        await collection.addItems(itemIDs);
      });
      await collection.loadDataType("childItems", true);
      const after = new Set(collection.getChildItems(true));
      const added = itemIDs.filter((id) => after.has(id) && !before.has(id));
      const missing = itemIDs.filter((id) => !after.has(id));
      this.undoStack.push({
        type: "remove_items_from_collection",
        collectionID: collection.id,
        itemIDs: added,
        summary: `撤销加入 ${collection.name} 的 ${added.length} 个条目`
      });
      this.markLibraryIndexDirty(this.currentTaskLibraryID());
      return {
        ok: missing.length === 0,
        addedCount: added.length,
        skippedCount: itemIDs.length - added.length - missing.length,
        missingItemIDs: missing,
        error: missing.length ? `有 ${missing.length} 个条目未能加入目标 collection。` : null
      };
    }

    async toolAddTags(args) {
      const changed = [];
      for (const key of args.itemKeys || []) {
        const item = await this.getItemByKey(key);
        if (!item) {
          continue;
        }
        const before = item.getTags().map((tag) => tag.tag);
        for (const tag of args.tags || []) {
          item.addTag(tag);
        }
        await item.saveTx();
        changed.push({ itemID: item.id, before, tags: args.tags || [] });
      }
      this.undoStack.push({ type: "restore_tags", changed, summary: `撤销添加标签到 ${changed.length} 个条目` });
      this.markLibraryIndexDirty(this.currentTaskLibraryID());
      return { ok: true, changedCount: changed.length };
    }

    async toolCreateNote(args) {
      const parent = await this.getItemByKey(args.parentItemKey);
      if (!parent) {
        return { ok: false, error: "找不到父条目。" };
      }
      const note = new Zotero.Item("note");
      note.parentID = parent.id;
      note.setNote(args.html || "");
      await note.saveTx();
      this.undoStack.push({ type: "trash_item", itemID: note.id, summary: "撤销创建笔记" });
      this.markLibraryIndexDirty(this.currentTaskLibraryID());
      return { ok: true, noteKey: note.key };
    }

    async toolCreateParentItem(args) {
      const attachment = await this.getItemByKey(args.attachmentKey);
      if (!attachment) {
        return { ok: false, error: "找不到附件条目。" };
      }
      if (!isAttachmentItem(attachment)) {
        return { ok: false, error: "create_parent_item 只支持附件条目。" };
      }
      if (attachment.parentID) {
        return { ok: false, error: "该附件已经有父条目，不能重复创建父条目。" };
      }
      const itemType = String(args.itemType || "").trim();
      if (!this.isSupportedParentItemType(itemType)) {
        return { ok: false, error: `不支持的父条目类型：${itemType || "空值"}。请使用 Zotero 常规顶层类型，例如 book、journalArticle、report、thesis、document、webpage。` };
      }

      const fields = Object.assign({}, args.fields || {});
      if (args.title && !fields.title) {
        fields.title = args.title;
      }
      if (!fields.title) {
        fields.title = this.defaultParentTitleForAttachment(attachment);
      }
      if (Object.prototype.hasOwnProperty.call(fields, "itemType")) {
        delete fields.itemType;
      }
      if (Object.prototype.hasOwnProperty.call(fields, "itemTypeID")) {
        delete fields.itemTypeID;
      }

      const creators = this.normalizeCreators(args.creators);
      const copyCollections = args.copyCollections !== false;
      const copyTags = args.copyTags !== false;
      const attachmentCollectionIDs = this.itemCollectionIDs(attachment);
      const copiedTags = copyTags ? this.itemTagNames(attachment) : [];

      const parent = new Zotero.Item(itemType);
      parent.libraryID = attachment.libraryID;
      for (const [field, value] of Object.entries(fields)) {
        if (value === undefined || value === null) {
          continue;
        }
        try {
          parent.setField(field, value);
        } catch (error) {
          return { ok: false, error: `字段 ${field} 不能用于 ${itemType}：${error}` };
        }
      }
      if (creators.length && typeof parent.setCreators === "function") {
        parent.setCreators(creators);
      }
      for (const tag of copiedTags) {
        parent.addTag(tag);
      }
      await parent.saveTx();
      if (copyCollections && attachmentCollectionIDs.length) {
        await this.addItemToCollectionIDs(parent.id, attachmentCollectionIDs);
      }

      attachment.parentID = parent.id;
      await attachment.saveTx();

      this.undoStack.push({
        type: "detach_attachment_from_parent_item",
        parentItemID: parent.id,
        attachmentItemID: attachment.id,
        attachmentCollectionIDs,
        summary: `撤销为附件创建 ${itemType} 父条目`
      });
      this.markLibraryIndexDirty(this.currentTaskLibraryID());
      return {
        ok: true,
        parentItem: this.itemSummary(parent),
        attachment: this.itemSummary(attachment, {
          parentItemKey: parent.key,
          parentItemID: parent.id
        }),
        copiedCollections: copyCollections ? attachmentCollectionIDs.length : 0,
        copiedTags: copiedTags.length
      };
    }

    async toolUpdateMetadata(args) {
      const item = await this.getItemByKey(args.itemKey);
      if (!item) {
        return { ok: false, error: "找不到条目。" };
      }
      const hasFields = !!(args.fields && typeof args.fields === "object");
      const hasCreators = Array.isArray(args.creators);
      if (!hasFields && !hasCreators) {
        return { ok: false, error: "update_metadata 至少需要 fields 或 creators 之一。" };
      }
      if (args.fields && (Object.prototype.hasOwnProperty.call(args.fields, "itemType") || Object.prototype.hasOwnProperty.call(args.fields, "itemTypeID"))) {
        return { ok: false, error: "update_metadata 不能修改 itemType。要把顶层附件变成书籍/文章父条目，请改用 create_parent_item。" };
      }
      const before = {};
      for (const [field, value] of Object.entries(args.fields || {})) {
        before[field] = item.getField(field);
        item.setField(field, value);
      }
      let beforeCreators = null;
      if (hasCreators) {
        beforeCreators = this.currentCreatorsSnapshot(item);
        const creators = this.normalizeCreators(args.creators);
        if (typeof item.setCreators === "function") {
          item.setCreators(creators);
        }
      }
      await item.saveTx();
      this.undoStack.push({
        type: "restore_fields",
        itemID: item.id,
        before,
        beforeCreators,
        summary: "撤销元数据修改"
      });
      this.markLibraryIndexDirty(this.currentTaskLibraryID());
      return {
        ok: true,
        changedFieldNames: Object.keys(args.fields || {}),
        changedCreators: hasCreators,
        item: this.itemSummary(item)
      };
    }

    async toolSetPreference(args) {
      const prefName = this.normalizePreferenceName(args.name);
      const meta = this.preferenceMetadata(prefName);
      if (!meta.exists) {
        return { ok: false, error: `设置不存在，第一版不允许新建 preference：${prefName}` };
      }
      if (!meta.allowedNamespace) {
        return { ok: false, error: "只允许修改 Zotero 原生和插件相关 preference，不允许修改 Firefox/Mozilla 内部 preference。" };
      }
      if (meta.isSensitive) {
        return {
          ok: false,
          error: "该设置被识别为密钥/令牌/密码/secret，AI 不能读取或写入原文。请调用 open_zotero_preferences，让用户手动配置。",
          manualConfigurationRequired: true,
          preference: meta
        };
      }
      if (!meta.isWritable) {
        return { ok: false, error: "该设置当前不可写。", preference: meta };
      }
      const branch = this.preferenceBranch();
      const before = this.readPreferenceRaw(prefName);
      const beforeHadUserValue = branch.prefHasUserValue(prefName);
      const beforeMeta = this.preferenceMetadata(prefName);
      this.validatePreferenceWrite(beforeMeta, args.value);
      this.setPreferenceRaw(prefName, args.value);
      const afterMeta = this.preferenceMetadata(prefName);
      this.undoStack.push({
        type: "restore_pref",
        prefName,
        before,
        beforeHadUserValue,
        summary: `撤销设置修改：${prefName}`
      });
      this.log("preference.changed", {
        name: prefName,
        before: beforeMeta.value,
        after: afterMeta.value,
        type: afterMeta.type,
        riskLevel: beforeMeta.riskLevel,
        sourcePrefix: beforeMeta.sourcePrefix,
        isHiddenOrInternal: beforeMeta.isHiddenOrInternal
      });
      return {
        ok: true,
        preference: afterMeta,
        changed: {
          name: prefName,
          before: beforeMeta.value,
          after: afterMeta.value,
          type: afterMeta.type,
          riskLevel: beforeMeta.riskLevel
        },
        restartMayBeRequired: beforeMeta.isHiddenOrInternal || beforeMeta.riskLevel === "high"
      };
    }

    async toolListPluginCommands() {
      const win = this.firstWindow();
      const doc = win && win.document;
      if (!doc) {
        return { ok: false, error: "没有可用的 Zotero 主窗口。" };
      }
      const commands = Array.from(doc.querySelectorAll("menuitem[id]"))
        .map((node) => ({
          id: node.id,
          label: node.getAttribute("label") || node.textContent || "",
          disabled: node.hasAttribute("disabled")
        }))
        .filter((command) => command.id !== "zotero-assistant-tools-menu" && command.label)
        .slice(0, 200);
      return { ok: true, commands };
    }

    async toolMoveToTrash(args) {
      const trashed = [];
      for (const key of args.itemKeys || []) {
        const item = await this.getItemByKey(key);
        if (item) {
          await item.trashTx();
          trashed.push(item.id);
        }
      }
      this.undoStack.push({ type: "restore_trashed_items", itemIDs: trashed, summary: `撤销移到回收站：${trashed.length} 个条目` });
      this.markLibraryIndexDirty(this.currentTaskLibraryID());
      return { ok: true, trashedCount: trashed.length };
    }

    async toolTriggerPluginCommand(args) {
      const win = this.firstWindow();
      const doc = win && win.document;
      const node = doc && doc.getElementById(args.commandId);
      if (!node) {
        return { ok: false, error: "找不到已发现的插件命令。" };
      }
      node.dispatchEvent(new win.Event("command", { bubbles: true, cancelable: true }));
      this.markAllIndexesDirty();
      return { ok: true, commandId: args.commandId };
    }

    async toolFinishTask(args) {
      if (this.task && this.task.lastToolFailure) {
        return {
          ok: false,
          error: `最近一次工具失败：${this.task.lastToolFailure.toolName} - ${this.task.lastToolFailure.error}`
        };
      }
      const rule = this.finishTaskSummaryMeetsUserMessageRule(args && args.summary);
      if (!rule.ok) {
        if (this.task) {
          this.task.status = "running";
          this.task.phase = "must_message_user";
          this.task.messages.push({
            role: "system",
            content: `${rule.error} Do not call finish_task again until the user has a proper Chinese explanation.`
          });
          this.log("finish_task.rejected", { reason: rule.error, userFacingMessageCount: this.task.userFacingMessageCount || 0 });
        }
        return {
          ok: false,
          error: rule.error,
          mustMessageUserFirst: !!rule.mustMessageUserFirst
        };
      }
      const summaryText = rule.summary;
      this.task.status = "complete";
      this.task.phase = "complete";
      this.task.summary = summaryText;
      this.pushChatTurnReadable(summaryText);
      this.flushChatTurnToDisplay();
      this.renderChatPanelIfOpen();
      await this.safeUpdateSessionMemoryForTask("completed");
      return { ok: true, summary: summaryText };
    }

    isWriteTool(toolName) {
      return LOW_RISK_WRITE_TOOLS.has(toolName) || HIGH_RISK_WRITE_TOOLS.has(toolName);
    }

    renderMarkdownInto(container, markdown) {
      container.textContent = "";
      const blocks = parseMarkdownBlocks(markdown);
      for (const block of blocks) {
        let node;
        switch (block.type) {
          case "code":
            node = this.html(container.ownerDocument, "pre");
            const code = this.html(container.ownerDocument, "code");
            code.textContent = block.text;
            node.appendChild(code);
            break;
          case "ul":
          case "ol":
            node = this.html(container.ownerDocument, block.type);
            node.style.margin = "0 0 8px 18px";
            for (const itemText of block.items) {
              const li = this.html(container.ownerDocument, "li");
              li.style.marginBottom = "4px";
              this.appendInlineMarkdown(li, itemText);
              node.appendChild(li);
            }
            break;
          case "heading":
            node = this.html(container.ownerDocument, `h${block.level}`);
            node.style.cssText = "margin:0 0 8px 0;font-size:14px;";
            this.appendInlineMarkdown(node, block.text);
            break;
          default:
            node = this.html(container.ownerDocument, "p");
            node.style.margin = "0 0 8px 0";
            this.appendInlineMarkdown(node, block.text);
            break;
        }
        container.appendChild(node);
      }
    }

    appendInlineMarkdown(parent, text) {
      const doc = parent.ownerDocument;
      const lines = String(text || "").split("\n");
      lines.forEach((line, lineIndex) => {
        const tokens = tokenizeInlineMarkdown(line);
        for (const token of tokens) {
          if (token.type === "text") {
            parent.appendChild(doc.createTextNode(token.text));
            continue;
          }
          const node = this.html(doc, token.type === "link" ? "a" : token.type);
          if (token.type === "link") {
            node.setAttribute("href", token.href);
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noreferrer noopener");
          }
          if (token.type === "code") {
            node.style.fontFamily = "monospace";
          }
          node.textContent = token.text;
          parent.appendChild(node);
        }
        if (lineIndex < lines.length - 1) {
          parent.appendChild(this.html(doc, "br"));
        }
      });
    }

    async getItemByKey(key) {
      if (!key) {
        return null;
      }
      const libraryID = this.currentTaskLibraryID();
      return Zotero.Items.getByLibraryAndKeyAsync
        ? Zotero.Items.getByLibraryAndKeyAsync(libraryID, key)
        : Zotero.Items.getByLibraryAndKey(libraryID, key);
    }

    async getCollectionByKey(key) {
      if (!key) {
        return null;
      }
      const libraryID = this.currentTaskLibraryID();
      return Zotero.Collections.getByLibraryAndKeyAsync
        ? Zotero.Collections.getByLibraryAndKeyAsync(libraryID, key)
        : Zotero.Collections.getByLibraryAndKey(libraryID, key);
    }

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
      }
      this.log("undo.finished", op);
      if (this.task && this.task.libraryID) {
        this.markLibraryIndexDirty(this.task.libraryID);
      }
      this.renderAll();
    }

    approvePending(remember) {
      if (!this.task || !this.task.pendingApproval) {
        return;
      }
      const pending = this.task.pendingApproval;
      this.log("approval.granted", {
        id: pending.id,
        toolName: pending.toolName,
        summary: pending.summary,
        remember: !!remember
      });
      if (pending.kind === "session_library_read") {
        this.grantSessionRead(pending.libraryID);
      }
      if (remember && pending.kind === "preference_write" && pending.rememberPrefix) {
        this.grantPreferencePrefix(pending.rememberPrefix);
      } else if (remember && pending.allowRemember && pending.rememberKey) {
        this.rememberedApprovals[pending.rememberKey] = true;
        this.writeJSONPref(PREFS.rememberedApprovals, this.rememberedApprovals);
      }
      const task = this.task;
      task.pendingApproval = null;
      task.status = "running";
      this.renderAll();
      this.executeTool(pending.toolName, pending.args)
        .then((result) => {
          task.messages.push({
            role: "tool",
            tool_call_id: pending.id,
            content: JSON.stringify(result)
          });
          this.flushChatTurnToDisplay();
          this.renderAll();
          if (task.status === "running") {
            this.runTaskLoopInBackground(this.firstState());
          }
        })
        .catch((error) => {
          task.status = "paused";
          task.phase = error && error.source === "tool" ? "tool_failed" : "model_failed";
          task.error = String(error);
          this.log("task.paused", {
            id: task.id,
            reason: String(error),
            source: error && error.source ? error.source : "unknown",
            toolName: error && error.toolName ? error.toolName : null
          });
          this.maybeWriteDebugReport("approval_resume_failed", {
            reason: String(error),
            source: error && error.source ? error.source : "unknown",
            toolName: error && error.toolName ? error.toolName : null,
            error: this.serializeErrorForDebug(error)
          })
            .then(() => this.safeUpdateSessionMemoryForTask("approval_resume_failed"))
            .finally(() => this.renderAll());
        });
    }

    async rejectPending() {
      if (!this.task || !this.task.pendingApproval) {
        return;
      }
      const pending = this.task.pendingApproval;
      this.log("approval.rejected", pending);
      this.task.pendingApproval = null;
      this.task.status = "paused";
      this.task.phase = "approval_rejected";
      await this.safeUpdateSessionMemoryForTask("approval_rejected");
      this.renderAll();
    }

    renderAll() {
      for (const state of this.windows.values()) {
        this.render(state);
      }
    }

    render(state) {
      this.renderChatPanel(state);
      this.renderStatus(state);
      this.renderGrantState(state);
      this.renderApprovals(state);
      this.renderLog(state);
      this.renderApprovalPopup(state);
    }

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
    }

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
    }

    renderChatApprovalCard(state) {
      if (!state.chatApprovalNode) {
        return;
      }
      const body = state.chatApprovalNode;
      body.textContent = "";
      if (!this.task || !this.task.pendingApproval) {
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
    }

    renderStatus(state) {
      const body = state.statusNode.querySelector(".zotero-assistant-panel-body");
      body.textContent = "";
      if (!this.task) {
        const empty = this.el(state.doc, "p", "za-empty", "");
        empty.textContent = "打开聊天窗并输入明确任务后开始。助手不会默认整理书架或执行任何操作。";
        body.appendChild(empty);
        return;
      }
      const row = this.html(state.doc, "div");
      row.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;";
      const pill = this.el(state.doc, "span", `za-pill ${this.statusPillClass(this.task.status)}`, this.task.status);
      row.appendChild(pill);
      const phase = this.el(state.doc, "span", "za-muted", `阶段 · ${this.task.phase}`);
      row.appendChild(phase);
      body.appendChild(row);
      if (this.task.error) {
        const error = this.el(state.doc, "div", "za-error", `错误：${this.task.error}`);
        body.appendChild(error);
      }
      if (this.task.lastDebugReportPath) {
        const debugPath = this.el(state.doc, "div", "za-muted", `调试文件：${this.task.lastDebugReportPath}`);
        debugPath.style.marginTop = "8px";
        debugPath.style.wordBreak = "break-all";
        body.appendChild(debugPath);
      }
      if (this.task.summary) {
        const summary = this.html(state.doc, "div");
        summary.className = "za-markdown";
        summary.style.marginTop = "10px";
        this.renderMarkdownInto(summary, this.task.summary);
        body.appendChild(summary);
      }
      if (this.task.libraryName) {
        const library = this.el(state.doc, "div", "za-muted", `绑定库：${this.task.libraryName}`);
        library.style.marginTop = "8px";
        body.appendChild(library);
      }
      const actions = this.el(state.doc, "div", "za-btn-row", "");
      if (this.task.canContinueAfterCompressionFailure) {
        actions.appendChild(this.actionButton(state.doc, "裁剪后继续任务", "primary", () => this.continueAfterCompressionFailure()));
      }
      actions.appendChild(this.actionButton(state.doc, "清除当前任务", "ghost", () => this.clearCurrentTask()));
      const undoButton = this.actionButton(state.doc, "撤销最近操作", "secondary", () => this.undoLast());
      undoButton.disabled = this.undoStack.length === 0;
      actions.appendChild(undoButton);
      body.appendChild(actions);
    }

    renderGrantState(state) {
      const body = state.grantNode.querySelector(".zotero-assistant-panel-body");
      body.textContent = "";
      const activeLibraryID = this.getActiveLibraryID(state.win);
      const activeLibraryName = this.getLibraryName(activeLibraryID);
      const activeGranted = this.hasSessionReadGrant(activeLibraryID);
      body.appendChild(this.el(state.doc, "div", "", `界面库：${activeLibraryName}`));
      const grantLine = this.el(
        state.doc,
        "div",
        activeGranted ? "za-grant-on" : "za-grant-off",
        activeGranted ? "整库元数据读取 · 已开放" : "整库元数据读取 · 未开放"
      );
      grantLine.style.marginTop = "6px";
      body.appendChild(grantLine);
      if (this.task && this.task.libraryID && this.task.libraryID !== activeLibraryID) {
        const taskLine = this.el(state.doc, "div", "za-muted", `任务绑定库：${this.task.libraryName}`);
        taskLine.style.marginTop = "6px";
        body.appendChild(taskLine);
      }
      if (activeGranted) {
        const row = this.el(state.doc, "div", "za-btn-row", "");
        row.appendChild(this.actionButton(state.doc, "收回整库读取权限", "secondary", () => this.revokeSessionRead(activeLibraryID)));
        body.appendChild(row);
      }

      const memoryTitle = this.el(state.doc, "div", "za-muted", "本库会话记忆");
      memoryTitle.style.marginTop = "10px";
      body.appendChild(memoryTitle);
      if (!this.isSessionMemoryEnabled()) {
        const disabled = this.el(state.doc, "div", "za-grant-off", "会话记忆 · 已在设置中关闭");
        disabled.style.marginTop = "6px";
        body.appendChild(disabled);
      } else {
        const memory = this.getSessionMemory(activeLibraryID);
        if (!memory || !memory.summary) {
          const emptyMemory = this.el(state.doc, "div", "za-grant-off", "本库暂无会话摘要");
          emptyMemory.style.marginTop = "6px";
          body.appendChild(emptyMemory);
        } else {
          const line = this.el(state.doc, "div", "za-grant-on", `已记录 · ${memory.summary.length} 字符 · 版本 ${memory.version || 1}`);
          line.style.marginTop = "6px";
          body.appendChild(line);
          const details = this.html(state.doc, "details");
          const detailsSummary = this.html(state.doc, "summary");
          detailsSummary.textContent = "查看会话摘要";
          const pre = this.html(state.doc, "pre");
          pre.textContent = memory.summary;
          pre.style.whiteSpace = "pre-wrap";
          details.appendChild(detailsSummary);
          details.appendChild(pre);
          body.appendChild(details);
          const memoryActions = this.el(state.doc, "div", "za-btn-row", "");
          memoryActions.appendChild(this.actionButton(state.doc, "复制摘要", "secondary", () => this.copySessionMemoryForLibrary(activeLibraryID)));
          memoryActions.appendChild(this.actionButton(state.doc, "清除本库会话记忆", "ghost", () => this.clearSessionMemoryForLibrary(activeLibraryID)));
          body.appendChild(memoryActions);
        }
      }

      const prefTitle = this.el(state.doc, "div", "za-muted", "设置前缀授权");
      prefTitle.style.marginTop = "10px";
      body.appendChild(prefTitle);
      const prefixes = Array.from(this.sessionPreferenceApprovals).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
      if (!prefixes.length) {
        const emptyPrefs = this.el(state.doc, "div", "za-grant-off", "本会话暂无设置写入前缀授权");
        emptyPrefs.style.marginTop = "6px";
        body.appendChild(emptyPrefs);
      }
      for (const prefix of prefixes) {
        const line = this.el(state.doc, "div", "za-grant-on", prefix);
        line.style.marginTop = "6px";
        line.style.wordBreak = "break-all";
        body.appendChild(line);
        const row = this.el(state.doc, "div", "za-btn-row", "");
        row.appendChild(this.actionButton(state.doc, "收回此前缀", "secondary", () => this.revokePreferencePrefix(prefix)));
        body.appendChild(row);
      }
    }

    renderApprovals(state) {
      const body = state.approvalsNode.querySelector(".zotero-assistant-panel-body");
      body.textContent = "";
      if (!this.task || !this.task.pendingApproval) {
        body.appendChild(this.el(state.doc, "p", "za-empty", "无待授权操作。"));
        return;
      }
      const pending = this.task.pendingApproval;
      const summary = this.el(state.doc, "p", "", pending.summary);
      summary.style.lineHeight = "1.5";
      body.appendChild(summary);
      const details = this.html(state.doc, "details");
      const detailsSummary = this.html(state.doc, "summary");
      detailsSummary.textContent = "查看详情";
      const pre = this.html(state.doc, "pre");
      pre.textContent = pending.details;
      details.appendChild(detailsSummary);
      details.appendChild(pre);
      body.appendChild(details);
      const buttons = this.el(state.doc, "div", "za-btn-row", "");
      buttons.appendChild(this.actionButton(state.doc, pending.approveLabel || "允许本次", "primary", () => this.approvePending(false)));
      if (pending.allowRemember) {
        buttons.appendChild(this.actionButton(state.doc, pending.rememberLabel || "记住此命令", "secondary", () => this.approvePending(true)));
      }
      const reject = this.actionButton(state.doc, "拒绝", "ghost", () => this.rejectPending());
      reject.style.color = "#b91c1c";
      buttons.appendChild(reject);
      body.appendChild(buttons);
    }

    renderLog(state) {
      const body = state.logNode.querySelector(".zotero-assistant-panel-body");
      body.textContent = "";
      const recent = this.eventLog.slice(-8).reverse();
      if (!recent.length) {
        body.appendChild(this.el(state.doc, "p", "za-empty", "暂无日志。"));
        return;
      }
      for (const event of recent) {
        let detail = "";
        if (event.type === "model.retry" && event.data && event.data.error) {
          detail = `: ${event.data.error}`;
        } else if (event.type === "task.paused" && event.data && event.data.reason) {
          detail = `: ${event.data.reason}`;
        }
        const line = this.el(state.doc, "div", "za-log-line", "");
        const time = this.el(state.doc, "span", "", `${new Date(event.time).toLocaleTimeString()} `);
        const type = this.el(state.doc, "span", "za-log-type", event.type);
        line.appendChild(time);
        line.appendChild(type);
        if (detail) {
          line.appendChild(state.doc.createTextNode(detail));
        }
        body.appendChild(line);
      }
      const row = this.el(state.doc, "div", "za-btn-row", "");
      row.appendChild(this.actionButton(state.doc, "清除日志", "ghost", () => {
        this.eventLog = [];
        this.persistLog();
        this.renderAll();
      }));
      body.appendChild(row);
    }

    showMessage(state, message) {
      const body = state.logNode.querySelector(".zotero-assistant-panel-body");
      const msg = this.el(state.doc, "div", "", message);
      msg.style.cssText = "padding:10px 12px;background:rgba(255,251,235,0.95);border:1px solid rgba(245,158,11,0.28);border-radius:8px;margin-bottom:8px;white-space:pre-wrap;font-size:12px;line-height:1.45;";
      body.insertBefore(msg, body.firstChild);
    }

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
    }

    firstState() {
      return this.windows.values().next().value || null;
    }

    firstWindow() {
      const state = this.firstState();
      return state && state.win;
    }

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
    }

    pruneLog(log) {
      const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      return (log || []).filter((entry) => entry && entry.time >= cutoff);
    }

    persistLog() {
      this.writeJSONPref(PREFS.eventLog, this.eventLog);
    }

    readJSONPref(pref, fallback) {
      try {
        const value = Zotero.Prefs.get(pref, true);
        return value ? JSON.parse(value) : fallback;
      } catch (error) {
        return fallback;
      }
    }

    writeJSONPref(pref, value) {
      try {
        Zotero.Prefs.set(pref, JSON.stringify(value), true);
      } catch (error) {
        Zotero.debug(`Zotero Assistant failed to write ${pref}: ${error}`);
      }
    }
  }

  function safeCall(fn) {
    try {
      const value = fn();
      return value == null ? "" : value;
    } catch (error) {
      return "";
    }
  }

  function stripHTML(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncateText(value, limit) {
    const text = stripHTML(value);
    if (!text || !limit || text.length <= limit) {
      return text;
    }
    return text.slice(0, limit) + "...";
  }

  function safeJSONStringify(value, limit = DEBUG_TEXT_LIMIT) {
    try {
      const seen = new WeakSet();
      const text = JSON.stringify(value, (key, current) => {
        if (typeof current === "function") {
          return "[Function]";
        }
        if (current instanceof Set) {
          return Array.from(current);
        }
        if (current instanceof Map) {
          return Array.from(current.entries());
        }
        if (current && typeof current === "object") {
          if (seen.has(current)) {
            return "[Circular]";
          }
          seen.add(current);
        }
        return current;
      }, 2);
      return truncateText(text || "", limit);
    } catch (error) {
      return truncateText(String(value), limit);
    }
  }

  function mapCountsToSortedPairs(map) {
    return Array.from(map.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) {
          return b[1] - a[1];
        }
        return String(a[0]).localeCompare(String(b[0]), "zh-Hans-CN");
      })
      .map(([name, count]) => ({ name, count }));
  }

  function extractYear(value) {
    const match = String(value || "").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
    return match ? match[1] : "";
  }

  function isAttachmentItem(item) {
    if (!item) {
      return false;
    }
    if (typeof item.isAttachment === "function") {
      return !!item.isAttachment();
    }
    return item.itemType === "attachment";
  }

  function normalizeFulltextContent(content) {
    if (typeof content === "string") {
      return content;
    }
    if (content && typeof content.content === "string") {
      return content.content;
    }
    if (content && typeof content.text === "string") {
      return content.text;
    }
    return "";
  }

  function parseMarkdownBlocks(markdown) {
    const source = String(markdown || "").replace(/\r\n/g, "\n").trim();
    if (!source) {
      return [];
    }
    const lines = source.split("\n");
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }
      if (line.trim().startsWith("```")) {
        i++;
        const codeLines = [];
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          i++;
        }
        blocks.push({ type: "code", text: codeLines.join("\n") });
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
          i++;
        }
        blocks.push({ type: "ul", items });
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
          i++;
        }
        blocks.push({ type: "ol", items });
        continue;
      }
      if (/^\s*#{1,6}\s+/.test(line)) {
        const level = Math.min((line.match(/^(\s*#+)/) || ["#"])[0].replace(/\s/g, "").length, 6);
        blocks.push({
          type: "heading",
          level,
          text: line.replace(/^\s*#{1,6}\s+/, "")
        });
        i++;
        continue;
      }
      const paragraph = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^\s*#{1,6}\s+/.test(lines[i]) && !lines[i].trim().startsWith("```")) {
        paragraph.push(lines[i]);
        i++;
      }
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    }

    return blocks;
  }

  function tokenizeInlineMarkdown(text) {
    const source = String(text || "");
    const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    const tokens = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(source))) {
      if (match.index > lastIndex) {
        tokens.push({ type: "text", text: source.slice(lastIndex, match.index) });
      }
      if (match[1] && match[2]) {
        tokens.push({ type: "link", text: match[1], href: match[2] });
      } else if (match[3]) {
        tokens.push({ type: "code", text: match[3] });
      } else if (match[4]) {
        tokens.push({ type: "strong", text: match[4] });
      } else if (match[5]) {
        tokens.push({ type: "em", text: match[5] });
      }
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < source.length) {
      tokens.push({ type: "text", text: source.slice(lastIndex) });
    }

    return tokens.length ? tokens : [{ type: "text", text: source }];
  }

  return { create };
})();
