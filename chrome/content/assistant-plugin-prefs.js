var ZoteroAssistantPluginPrefs = (() => {
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
  prefConstant(branch, name, fallback) {
    return typeof branch[name] === "number" ? branch[name] : fallback;
  },

  preferenceLimit(value, fallback = DEFAULT_PREF_PAGE_SIZE) {
    return Math.min(Math.max(Number(value || fallback), 1), MAX_PREF_PAGE_SIZE);
  },

  preferenceExists(name) {
    const branch = this.preferenceBranch();
    const invalid = this.prefConstant(branch, "PREF_INVALID", 0);
    try {
      return branch.getPrefType(name) !== invalid;
    } catch (error) {
      return false;
    }
  },

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
  },

  preferenceBranch() {
    if (typeof Services === "undefined" || !Services.prefs) {
      throw new Error("当前 Zotero 环境没有可用的 preference 服务。");
    }
    return Services.prefs;
  },

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
  },

  maskSensitiveValue(value) {
    const text = String(value == null ? "" : value);
    if (!text) {
      return "未配置";
    }
    if (text.length <= 8) {
      return "已配置";
    }
    return `${text.slice(0, 4)}...${text.slice(-4)}`;
  },

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
  },

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
  },

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
  },

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
      PREFS.selectionAskShortcut,
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
  },

  grantPreferencePrefix(prefix) {
    const normalized = this.normalizePreferencePrefix(prefix);
    if (!normalized) {
      return;
    }
    this.sessionPreferenceApprovals.add(normalized);
    this.log("preference.prefix_granted", { prefix: normalized });
    this.renderAll();
  },

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
  },

  revokePreferencePrefix(prefix) {
    const normalized = this.normalizePreferencePrefix(prefix);
    if (!this.sessionPreferenceApprovals.delete(normalized)) {
      return;
    }
    this.log("preference.prefix_revoked", { prefix: normalized });
    this.renderAll();
  },

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
    if (meta.name === PREFS.selectionAskShortcut && (typeof value !== "string" || !value.trim())) {
      throw new Error("selectionAskShortcut 必须是非空字符串，例如 Ctrl+Alt+Q。");
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
  },

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
  },

  normalizePreferenceName(name) {
    const raw = String(name || "").trim();
    if (!raw) {
      return "";
    }
    return raw.includes(".") ? raw : PREF_PREFIX + raw;
  },

  isKnownVisiblePreference(name) {
    return this.knownVisiblePreferenceNames().has(String(name || ""));
  },

  hasPreferencePrefixGrant(prefName) {
    const name = this.normalizePreferenceName(prefName);
    for (const prefix of this.sessionPreferenceApprovals) {
      if (name.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  },

  preferenceApprovalPrefix(args) {
    const meta = this.preferenceMetadata(args.name);
    const proposed = this.normalizePreferencePrefix(args.rememberPrefix || "");
    if (proposed && meta.name.startsWith(proposed) && this.isAllowedPreferenceNamespace(proposed)) {
      return proposed;
    }
    return meta.sourcePrefix || "";
  },

  normalizePreferencePrefix(prefix) {
    const raw = String(prefix || "").trim();
    if (!raw) {
      return "";
    }
    return raw.endsWith(".") ? raw : raw + ".";
  },

  sourcePrefixForPreference(name) {
    const prefName = String(name || "");
    const parts = prefName.split(".");
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[1]}.`;
    }
    return prefName ? prefName + "." : "";
  },

  isSensitivePreferenceName(name) {
    const prefName = String(name || "");
    return /api[_-]?key|apikey|password|passwd|token|secret/i.test(prefName);
  },

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
  },

  preferenceNamesUnderPrefix(prefix) {
    const normalizedPrefix = this.normalizePreferencePrefix(prefix);
    return this.allPreferenceNames()
      .filter((name) => this.isAllowedPreferenceNamespace(name))
      .filter((name) => !normalizedPrefix || name.startsWith(normalizedPrefix))
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  },

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
  },

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
      PREFS.selectionAskShortcut,
      PREFS.sessionMemoryEnabled,
      PREFS.autoCompressionEnabled,
      PREFS.contextCompressionTriggerChars,
      PREFS.contextCompressionTargetChars,
      PREFS.contextCompressionKeepMessages
    ]);
  },

  isMozillaInternalPreference(name) {
    return /^(browser|network|security|privacy|dom|gfx|layout|media|javascript|toolkit|services|app|datareporting|devtools|extensions\.webextensions)\./.test(String(name || ""));
  },

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
  },

  isAllowedPreferenceNamespace(name) {
    const prefName = String(name || "");
    if (!prefName || this.isMozillaInternalPreference(prefName)) {
      return false;
    }
    return prefName.startsWith("extensions.") || prefName.startsWith("zotero.");
  },

  async toolListPreferencePanes(args) {
    const data = this.listPreferencePanes(args || {});
    return { ok: true, ...data };
  },

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
  },

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
};
})();
