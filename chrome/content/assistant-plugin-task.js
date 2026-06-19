var ZoteroAssistantPluginTask = (() => {
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
  getSessionMemory(libraryID) {
    return this.sessionMemoryByLibraryID.get(String(libraryID || ""));
  },

  setSessionMemory(libraryID, memory) {
    this.sessionMemoryByLibraryID.set(String(libraryID || ""), memory);
  },

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
        this.resetModelRoundQuota();
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
          ? this.t("toolExecutionFailed")
          : error && error.source === "compression"
            ? this.t("contextCompressionFailed")
            : this.t("modelCallFailed");
        const detail = `${prefix}：${error}`;
        this.showMessage(state, detail);
        if (state.chatOpen) {
          state.chatNotice = detail;
        }
        this.pushChatTurnReadable(this.t("pausedPrefix", { detail }));
        this.flushChatTurnToDisplay();
      }
    } finally {
      this.flushChatTurnToDisplay();
      this.renderChatPanelIfOpen();
      this.renderAll();
    }
  },

  recentContextStart(messages, keepMessages) {
    const list = Array.isArray(messages) ? messages : [];
    let start = Math.max(0, list.length - keepMessages);
    while (start > 0 && list[start] && list[start].role === "tool") {
      start--;
    }
    return start;
  },

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
  },

  resetModelRoundQuota() {
    if (!this.task) {
      return;
    }
    this.task.roundLiveSearchCount = 0;
    this.task.roundWebFetchCount = 0;
    this.task.roundCreatedCollections = 0;
    this.task.roundProcessedItems = new Set();
  },

  estimateMessagesChars(messages) {
    return (Array.isArray(messages) ? messages : []).reduce((sum, message) => sum + this.estimateMessageChars(message), 0);
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  isCompressedContextMessage(message) {
    return !!(message && message.role === "system" && typeof message.content === "string" && message.content.startsWith(COMPRESSED_CONTEXT_MARKER));
  },

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
  },

  async finishAfterLoopLimit() {
    if (!this.task) {
      return;
    }
    const finalInstruction = [
      `The task has reached the maximum loop limit (${MAX_TASK_LOOPS}).`,
      "Tool use is now disabled.",
      "Do not call any tools and do not return JSON.",
      "Return a concise final result in the selected UI language that states: what has already been done, what remains unfinished or uncertain, and what the user should check next."
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
        this.task.error = this.t("loopLimitMissing");
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
      this.task.error = this.t("loopLimitFailed", { error });
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
  },

  serializeMessagesForSummary(messages, contentLimit = MEMORY_MESSAGE_SERIALIZE_LIMIT) {
    return this.stringifyContextObject((Array.isArray(messages) ? messages : []).map((message) => this.serializeMessageForSummary(message, contentLimit)));
  },

  compressionSystemInstruction(targetTokens) {
    const targetChars = Math.max(2000, targetTokens * CHARS_PER_TOKEN_ESTIMATE);
    return [
      "You compress Zotero Assistant task context for future model turns.",
      `Return a concise Chinese action summary of about ${targetTokens} tokens (${targetChars} characters) or less.`,
      "Preserve: user goal, explicit user preferences, key questions and answers, Zotero operations already executed, approvals, important item keys or collection names, errors, unfinished work, and next checks.",
      "Do not preserve full text, large metadata dumps, full tool outputs, API keys, tokens, passwords, or secrets.",
      "Return plain Markdown text only. Do not call tools. Do not return JSON."
    ].join("\n");
  },

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
  },

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
  },

  sessionMemorySystemInstruction(targetChars) {
    return [
      "You update Zotero Assistant session memory for one Zotero library.",
      `Return a Chinese action memory summary of about ${targetChars} characters or less.`,
      "Preserve user goals, durable preferences, important questions and answers, completed Zotero actions, approvals, errors, unresolved work, and suggested next steps.",
      "Merge the previous memory with the latest task. Remove stale duplicates.",
      "Do not include full tool outputs, full document text, large metadata dumps, API keys, tokens, passwords, or secrets.",
      "Return plain Markdown text only. Do not call tools. Do not return JSON."
    ].join("\n");
  },

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
  },

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
  },

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
  },

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
};
})();
