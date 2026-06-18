var ZoteroAssistantPluginModel = (() => {
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
  },

  getFetch() {
    const win = this.firstWindow();
    if (win && typeof win.fetch === "function") {
      return win.fetch.bind(win);
    }
    if (typeof fetch === "function") {
      return fetch;
    }
    throw new Error("当前 Zotero 环境没有可用的 fetch 实现。");
  },

  localFile(path) {
    const file = Components.classes["@mozilla.org/file/local;1"]
      .createInstance(Components.interfaces.nsIFile);
    file.initWithPath(path);
    return file;
  },

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
  },

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
      "Reader page context is low risk but must be explicit. If the user asks about the currently open article page, call read_current_reader_pages first; it reads only the foreground Zotero reader page plus neighboring pages and page annotations.",
      "Settings: use browse_preferences to drill down from the top-level preference tree, search_preferences to find settings, and read_preferences to inspect exact values. Sensitive settings are masked; never ask the user to reveal API keys, tokens, passwords, or secrets to you.",
      "Settings UI: call list_preference_panes to discover built-in and plugin preference pane ids; call open_zotero_preferences with optional pane_id to open a specific page (another plugin or Zotero General/Sync/Export/etc.). Omit pane_id for this assistant pane.",
      "Settings writes: use set_preference only for existing non-sensitive Zotero or plugin preferences. Preserve the existing value type. For sensitive settings, call open_zotero_preferences and ask the user to configure them manually.",
      "If a setting change needs restart, call request_zotero_restart with a reason; Zotero restart requires explicit user authorization.",
      `Web: use live_search for public web queries (max ${MAX_LIVE_SEARCH_PER_MODEL_ROUND} per model round). The old tool name web_search is invalid — if you tried web_search, call live_search instead. Use web_fetch to read a specific public URL as markdown (max ${MAX_WEB_FETCH_PER_MODEL_ROUND} per model round). Cite sources in your summary. Do not fetch login-only or private URLs.`,
      "Low-risk writes may be proposed directly: create small numbers of collections, add tags, create or append notes, and add items to collections.",
      "Do not try to change itemType through update_metadata. If a top-level attachment needs to become a bibliographic parent-child structure, use create_parent_item.",
      "Never remove items from old collections unless explicitly approved. Never permanently delete anything.",
      `Limits: per model round (each model call cycle), at most ${MAX_COLLECTIONS_PER_MODEL_ROUND} new collections and ${MAX_ITEMS_PER_MODEL_ROUND} items in batch write tools. The whole task may run up to ${MAX_TASK_LOOPS} model rounds.`,
      "Prefer tool calls. If your provider ignores tool definitions, output JSON only in one of these shapes:",
      "{\"tool_calls\":[{\"name\":\"read_library_overview\",\"arguments\":{}}]}",
      "{\"actions\":[{\"tool\":\"finish_task\",\"args\":{\"summary\":\"...\"}}]}",
      "{\"name\":\"finish_task\",\"arguments\":{\"summary\":\"...\"}}",
      "User-visible messages (mandatory): You MUST communicate with the user in Chinese before ending. Either send a normal assistant message (plain text in the same turn as tools, or request_clarification), or end with finish_task.summary that clearly explains outcomes. Never end a task with only silent tool calls and an empty or one-word summary.",
      "finish_task is rejected if summary is missing/too short, or if this task has zero prior user-facing messages and summary is under 24 characters — in that case, reply to the user first, then call finish_task again."
    ].join("\n");
  },

  makeModelError(message, debugInfo) {
    const error = new Error(message);
    error.source = "model";
    error.debugInfo = debugInfo || null;
    return error;
  },

  boundedIntPref(name, fallback, min, max) {
    const raw = Zotero.Prefs.get(name, true);
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, Math.floor(value)));
  },

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
  },

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
  },

  normalizeAPIMode(value) {
    const mode = String(value || DEFAULT_API_MODE).trim().toLowerCase();
    if (mode === "chat" || mode === "responses" || mode === "completions") {
      return mode;
    }
    return DEFAULT_API_MODE;
  },

  sanitizeToolArgs(toolName, args) {
    const copy = Object.assign({}, args || {});
    if (toolName === "set_preference" && this.isSensitivePreferenceName(copy.name)) {
      copy.value = this.maskSensitiveValue(copy.value);
    }
    return copy;
  },

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
  },

  getDebugOutputDir() {
    const raw = String(Zotero.Prefs.get(PREFS.debugOutputDir, true) || "").trim();
    const quoted = raw.match(/^"(.*)"$/);
    return quoted ? quoted[1] : raw;
  },

  debugMessagesTail(messages, limit = DEBUG_MESSAGE_TAIL) {
    return (Array.isArray(messages) ? messages.slice(-limit) : []).map((message) => ({
      role: message && message.role ? message.role : "",
      tool_call_id: message && message.tool_call_id ? message.tool_call_id : "",
      content: this.debugContentPreview(message && message.content),
      tool_calls: message && message.tool_calls ? safeJSONStringify(this.sanitizeToolCalls(message.tool_calls), DEBUG_MESSAGE_LIMIT) : ""
    }));
  },

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
  },

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
  },

  buildDebugFileName(kind) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeKind = String(kind || "report").replace(/[^a-z0-9_-]+/gi, "-");
    return `zotero-assistant-${safeKind}-${stamp}.json`;
  },

  isDebugModeEnabled() {
    return !!Zotero.Prefs.get(PREFS.debugMode, true);
  },

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
  },

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
  },

  debugContentPreview(content, limit = DEBUG_MESSAGE_LIMIT) {
    if (typeof content === "string") {
      return this.truncateText(content, limit);
    }
    return safeJSONStringify(content, limit);
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  estimateMessageTokens(message) {
    return Math.ceil(this.estimateMessageChars(message) / CHARS_PER_TOKEN_ESTIMATE);
  },

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
  },

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
  },

  estimateMessagesTokens(messages) {
    return Math.ceil(this.estimateMessagesChars(messages) / CHARS_PER_TOKEN_ESTIMATE);
  },

  isSessionMemoryEnabled() {
    return Zotero.Prefs.get(PREFS.sessionMemoryEnabled, true) !== false;
  },

  modelCallOptionsSnapshot(options = {}) {
    return {
      disableTools: !!options.disableTools,
      disableToolParsing: !!options.disableToolParsing,
      plainTextOnly: !!options.plainTextOnly,
      systemInstruction: this.truncateText(options.systemInstruction || "", 2000)
    };
  },

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
  },

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
  },

  isAutoCompressionEnabled() {
    return Zotero.Prefs.get(PREFS.autoCompressionEnabled, true) !== false;
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  buildResponsesInstructions(options = {}) {
    return [
      this.systemPrompt(),
      options.systemInstruction ? options.systemInstruction : ""
    ].filter(Boolean).join("\n\n");
  },

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
  },

  contextCompressionMaxTokens() {
    const direct = this.boundedIntPref(PREFS.contextCompressionMaxTokens, 0, 0, 2000000);
    if (direct > 0) {
      return direct;
    }
    const legacyChars = this.boundedIntPref(PREFS.contextCompressionTriggerChars, DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS, 10000, 500000);
    return Math.max(8000, Math.floor(legacyChars / CHARS_PER_TOKEN_ESTIMATE));
  },

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
  },

  contextCompressionTargetChars() {
    return this.boundedIntPref(PREFS.contextCompressionTargetChars, DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS, 1000, 50000);
  },

  contextCompressionTargetTokens() {
    const direct = this.boundedIntPref(PREFS.contextCompressionTargetTokens, 0, 0, 500000);
    if (direct > 0) {
      return direct;
    }
    const legacyChars = this.boundedIntPref(PREFS.contextCompressionTargetChars, DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS, 1000, 50000);
    return Math.max(1000, Math.floor(legacyChars / CHARS_PER_TOKEN_ESTIMATE));
  },

  contextCompressionKeepMessages() {
    return this.boundedIntPref(PREFS.contextCompressionKeepMessages, DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES, 4, 80);
  },

  contextCompressionTriggerChars() {
    return this.boundedIntPref(PREFS.contextCompressionTriggerChars, DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS, 10000, 500000);
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
};
})();
