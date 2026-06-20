var ZoteroAssistantPluginApprovalUi = (() => {
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
  sidebarPanelBody(state, panelNode) {
    if (!state || !panelNode || typeof panelNode.querySelector !== "function") {
      return null;
    }
    return panelNode.querySelector(".zotero-assistant-panel-body");
  },

  renderLog(state) {
    const body = this.sidebarPanelBody(state, state.logNode);
    if (!body) {
      return;
    }
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
  },

  hidePopup(panel) {
    if (panel && (panel.state === "open" || panel.state === "showing") && typeof panel.hidePopup === "function") {
      panel.hidePopup();
    }
  },

  showMessage(state, message) {
    if (!state) {
      return;
    }
    const text = String(message || "");
    const body = this.sidebarPanelBody(state, state.logNode);
    if (!body) {
      state.chatNotice = text;
      if (state.chatOpen) {
        this.renderChatPanel(state);
      }
      return;
    }
    const msg = this.el(state.doc, "div", "", text);
    msg.style.cssText = "padding:10px 12px;background:rgba(255,251,235,0.95);border:1px solid rgba(245,158,11,0.28);border-radius:8px;margin-bottom:8px;white-space:pre-wrap;font-size:12px;line-height:1.45;";
    body.insertBefore(msg, body.firstChild);
  },

  approvalKey(toolName, args) {
    if (toolName === "set_preference") {
      return `set_preference_prefix:${this.preferenceApprovalPrefix(args || {})}`;
    }
    if (toolName === "trigger_plugin_command") {
      return `${toolName}:${args.commandId || ""}`;
    }
    return toolName;
  },

  renderStatus(state) {
    const body = this.sidebarPanelBody(state, state.statusNode);
    if (!body) {
      return;
    }
    body.textContent = "";
    if (!this.task) {
      const empty = this.el(state.doc, "p", "za-empty", "");
      empty.textContent = this.uiText("打开聊天窗并输入明确任务后开始。助手不会默认整理书架或执行任何操作。");
      body.appendChild(empty);
      return;
    }
    const row = this.html(state.doc, "div");
    row.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;";
    const pill = this.el(state.doc, "span", `za-pill ${this.statusPillClass(this.task.status)}`, this.task.status);
    row.appendChild(pill);
    const phase = this.el(state.doc, "span", "za-muted", this.t("phase", { phase: this.task.phase }));
    row.appendChild(phase);
    body.appendChild(row);
    if (this.task.error) {
      const error = this.el(state.doc, "div", "za-error", this.t("error", { error: this.task.error }));
      body.appendChild(error);
    }
    if (this.task.lastDebugReportPath) {
      const debugPath = this.el(state.doc, "div", "za-muted", this.t("debugFile", { path: this.task.lastDebugReportPath }));
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
      const library = this.el(state.doc, "div", "za-muted", this.t("boundLibrary", { library: this.task.libraryName }));
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
  },

  getAnchorRect(state) {
    if (state.container && state.container.style.display !== "none") {
      return state.container.getBoundingClientRect();
    }
    if (state.launcher) {
      return state.launcher.getBoundingClientRect();
    }
    return { left: 0, top: 0, width: 0, height: 0 };
  },

  formatLogEvent(event) {
    const data = event.data || {};
    const time = new Date(event.time).toLocaleTimeString();
    if (this.isEnglishUI()) {
      switch (event.type) {
        case "task.started":
          return { tone: "info", badge: "Task", title: "Started new task", detail: this.truncateText(data.prompt || "", 220), meta: time };
        case "task.user_reply":
          return { tone: "info", badge: "Continue", title: "User added task information", detail: this.truncateText(data.content || "", 220), meta: time };
        case "task.context.injected":
          return {
            tone: "neutral",
            badge: "Context",
            title: "Injected context for this turn",
            detail: [
              data.sessionMetadataAccess ? "Includes full-library overview." : "Includes current selection and current collection only.",
              data.sessionMemoryChars ? `Session memory ${data.sessionMemoryChars} chars.` : ""
            ].filter(Boolean).join(" "),
            meta: time
          };
        case "task.context.compressed":
          return { tone: "warning", badge: "Compression", title: "Automatically compressed task context", detail: `Covered ${data.coveredMessages || 0} messages, summary ${data.summaryChars || 0} chars.`, meta: time };
        case "task.context.trimmed_after_compression_failure":
          return { tone: "warning", badge: "Compression", title: "Trimmed old context after compression failed", detail: `${data.beforeMessages || 0} messages became ${data.afterMessages || 0}.`, meta: time };
        case "task.loop.starting":
          return { tone: "info", badge: "Loop", title: "Preparing to start task loop", detail: this.truncateText(data.phase || "", 120), meta: time };
        case "task.loop.entered":
          return { tone: "info", badge: "Loop", title: "Task loop entered", detail: this.truncateText(data.phase || "", 120), meta: time };
        case "model.request.started":
          return { tone: "info", badge: "Model", title: "Model request sent", detail: `${data.variant || ""} · ${data.model || ""}`.trim(), meta: time };
        case "model.response.headers":
          return { tone: data.ok ? "info" : "warning", badge: "Model", title: "Received model response headers", detail: `HTTP ${data.status || ""} ${data.contentType || ""}`.trim(), meta: time };
        case "model.response.body_read":
          return { tone: "success", badge: "Model", title: "Read model response body", detail: `${data.rawTextLength || 0} chars`, meta: time };
        case "reader.pages.read":
          return { tone: "success", badge: "Reader", title: "Read current reader pages", detail: `Current page ${data.currentPage || "?"}, returned ${data.pageCount || 0} pages.`, meta: time };
        case "model.retry":
          return { tone: "warning", badge: "Retry", title: `Model call retry ${Number(data.attempt || 0) + 1}`, detail: this.truncateText(data.error || "", 220), meta: time };
        case "model.variant_fallback":
          return { tone: "warning", badge: "Compatibility", title: "Switched to compatibility response mode", detail: this.truncateText(data.variant || "", 160), meta: time };
        case "model.unrecognized_response":
          return { tone: "danger", badge: "Model", title: "Model returned unrecognized format", detail: this.truncateText(`${data.variant || ""} ${data.preview || ""}`.trim(), 240), meta: time };
        case "approval.requested":
          return { tone: "warning", badge: "Approval", title: "AI requested approval", detail: this.truncateText(data.summary || "", 220), meta: time };
        case "approval.rejected":
          return { tone: "danger", badge: "Approval", title: "Approval rejected", detail: this.truncateText(data.summary || data.toolName || "", 220), meta: time };
        case "approval.granted":
          return { tone: "success", badge: "Approval", title: "Approval granted", detail: this.truncateText(data.summary || data.toolName || "", 220), meta: time };
        case "tool.started":
          return { tone: "info", badge: "Tool", title: `Started ${data.toolName || "tool"}`, detail: this.summarizeToolArgs(data.toolName, data.args), meta: time };
        case "tool.finished":
          return { tone: data.result && data.result.ok === false ? "danger" : "success", badge: data.result && data.result.ok === false ? "Failed" : "Done", title: `${data.toolName || "Tool"} returned`, detail: this.summarizeToolResult(data.result), meta: time };
        case "tool.retry_requested":
          return { tone: "warning", badge: "Adjust", title: "Tool failed; model asked to adjust", detail: this.truncateText(data.error || "", 220), meta: time };
        case "assistant.message":
          return { tone: data.needsUserReply ? "info" : "neutral", badge: "AI", title: data.needsUserReply ? "AI needs more information" : "AI returned a message", detail: this.truncateText(data.text || "", 240), meta: time };
        case "task.paused":
          return { tone: "danger", badge: "Paused", title: "Task paused", detail: this.truncateText(data.reason || "", 240), meta: time };
        case "library.read_grant.granted":
          return { tone: "success", badge: "Access", title: "Full-library metadata read granted", detail: this.truncateText(data.libraryName || "", 180), meta: time };
        case "library.read_grant.revoked":
          return { tone: "warning", badge: "Access", title: "Full-library metadata read revoked", detail: this.truncateText(data.libraryName || "", 180), meta: time };
        case "undo.started":
          return { tone: "info", badge: "Undo", title: "Started undoing recent action", detail: this.truncateText(data.type || "", 180), meta: time };
        case "undo.finished":
          return { tone: "success", badge: "Undo", title: "Undo completed", detail: this.truncateText(data.type || "", 180), meta: time };
        case "task.context.cleared":
          return { tone: "warning", badge: "Context", title: "Cleared current task", detail: this.truncateText(data.libraryName || "", 180), meta: time };
        case "session_memory.updated":
          return { tone: "success", badge: "Memory", title: "Updated session memory for this library", detail: `Summary ${data.summaryChars || 0} chars, version ${data.version || 0}.`, meta: time };
        case "session_memory.update_failed":
          return { tone: "warning", badge: "Memory", title: "Session memory update failed", detail: this.truncateText(data.error || "", 220), meta: time };
        case "session_memory.cleared":
          return { tone: "warning", badge: "Memory", title: "Cleared session memory for this library", detail: this.truncateText(data.libraryName || "", 180), meta: time };
        case "session_memory.copied":
          return { tone: "success", badge: "Memory", title: "Copied session memory for this library", detail: `${data.summaryChars || 0} chars.`, meta: time };
        case "session_memory.copy_failed":
          return { tone: "warning", badge: "Memory", title: "Copying session memory failed", detail: this.truncateText(data.error || "", 220), meta: time };
        case "preference.changed":
          return { tone: "warning", badge: "Settings", title: "Preference changed", detail: this.truncateText(data.name || "", 220), meta: time };
        case "preference.prefix_granted":
          return { tone: "success", badge: "Settings", title: "Remembered preference prefix", detail: this.truncateText(data.prefix || "", 220), meta: time };
        case "preference.prefix_revoked":
          return { tone: "warning", badge: "Settings", title: "Revoked preference prefix", detail: this.truncateText(data.prefix || "", 220), meta: time };
        case "debug.report_written":
          return { tone: "success", badge: "Debug", title: "Wrote debug file", detail: this.truncateText(data.path || "", 240), meta: time };
        case "debug.report_failed":
          return { tone: "warning", badge: "Debug", title: "Writing debug file failed", detail: this.truncateText(data.error || data.path || "", 240), meta: time };
        case "plugin.started":
          return { tone: "neutral", badge: "Plugin", title: "Plugin started", detail: `Version ${data.version || ""}`.trim(), meta: time };
        case "ai_review": {
          const levelLabel = data.level === "low" ? "low risk" : data.level === "mid" ? "medium risk" : "high risk";
          const tone = data.level === "low" ? "success" : data.level === "mid" ? "warning" : "danger";
          const title = `AI review ${data.toolName || ""}: ${levelLabel}${data.ok === false ? " (review failed)" : ""}`;
          return { tone, badge: "Review", title, detail: this.truncateText(data.reason || "", 220), meta: time };
        }
        default:
          return { tone: "neutral", badge: "Event", title: event.type, detail: this.truncateText(JSON.stringify(data), 220), meta: time };
      }
    }
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
      case "reader.pages.read":
        return { tone: "success", badge: "阅读器", title: "已读取当前阅读器页面", detail: `当前第 ${data.currentPage || "?"} 页，返回 ${data.pageCount || 0} 页。`, meta: time };
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
      case "ai_review": {
        const levelLabel = data.level === "low" ? "低风险" : data.level === "mid" ? "中等风险" : "高风险";
        const tone = data.level === "low" ? "success" : data.level === "mid" ? "warning" : "danger";
        const title = `AI 审核 ${data.toolName || ""}：${levelLabel}${data.ok === false ? "（审核失败）" : ""}`;
        return { tone, badge: "审核", title, detail: this.truncateText(data.reason || "", 220), meta: time };
      }
      default:
        return {
          tone: "neutral",
          badge: "事件",
          title: event.type,
          detail: this.truncateText(JSON.stringify(data), 220),
          meta: time
        };
    }
  },

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
  },

  ensureLogPopup(state) {
    if (!state.logPopup || !state.logPopup.parentNode) {
      state.logPopup = this.createNativePopup(state, "zotero-assistant-log-popup", false);
    }
    return state.logPopup;
  },

  renderLogPopup(state) {
    if (state && state.logPopup) {
      this.hidePopup(state.logPopup);
    }
  },

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
  },

  renderApprovals(state) {
    const body = this.sidebarPanelBody(state, state.approvalsNode);
    if (!body) {
      return;
    }
    body.textContent = "";
    if (!this.task || !this.task.pendingApproval) {
      body.appendChild(this.el(state.doc, "p", "za-empty", "无待授权操作。"));
      return;
    }
    const pending = this.task.pendingApproval;
    if (pending.aiLevel) {
      const tag = this.el(state.doc, "p", this.aiRiskTagClass(pending.aiLevel), this.aiRiskTagText(pending.aiLevel));
      tag.style.fontWeight = "600";
      tag.style.marginBottom = "4px";
      body.appendChild(tag);
      if (pending.aiReason) {
        const reason = this.el(state.doc, "p", "za-muted", this.t("reason", { reason: pending.aiReason }));
        reason.style.marginBottom = "6px";
        reason.style.lineHeight = "1.5";
        body.appendChild(reason);
      }
    }
    const summary = this.el(state.doc, "p", "", pending.summary);
    summary.style.lineHeight = "1.5";
    body.appendChild(summary);
    const details = this.html(state.doc, "details");
    const detailsSummary = this.html(state.doc, "summary");
    detailsSummary.textContent = this.uiText("查看详情");
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
  },

  approvalSummary(toolName, args) {
    const unknown = this.isEnglishUI() ? "not specified" : "未说明";
    if (this.isEnglishUI()) {
      const summaries = {
        request_expanded_context: `AI requests session access to full-library metadata for "${this.getLibraryName(this.currentTaskLibraryID())}". Reason: ${args.reason || unknown}`,
        create_parent_item: `AI requests creating a ${args.itemType || ""} parent item for attachment ${args.attachmentKey || ""}, then moving the attachment under it.`,
        update_metadata: `AI requests modifying metadata${Array.isArray(args.creators) ? " and creators" : ""} for item ${args.itemKey || ""}.`,
        set_preference: `AI requests changing preference ${args.name || ""}. Reason: ${args.reason || unknown}`,
        request_zotero_restart: `AI requests restarting Zotero. Reason: ${args.reason || unknown}`,
        move_to_trash: `AI requests moving ${args.itemKeys ? args.itemKeys.length : 0} items to trash. Reason: ${args.reason || unknown}`,
        trigger_plugin_command: `AI requests running another plugin command: ${args.commandId || ""}. ${args.summary || ""}`,
        lookup_metadata_candidates: `AI requests looking up online metadata candidates for ${Array.isArray(args.itemKeys) ? args.itemKeys.length : 0} items${args.useTextProbe === false ? "" : " and may read a small leading PDF/EPUB text snippet"}. Reason: ${args.reason || unknown}`,
        export_items_citation: `AI requests exporting ${Array.isArray(args.itemKeys) ? args.itemKeys.length : 0} items as ${args.format || "a citation format"}${String(args.saveToPath || "").trim() ? ` and writing the file to ${args.saveToPath}` : " (chat text only, no file)"}. Reason: ${args.reason || unknown}`,
        run_batch_plan: this.batchApprovalSummary(args, true)
      };
      return summaries[toolName] || `AI requests executing ${toolName}.`;
    }
    const summaries = {
      request_expanded_context: `AI 请求开放“${this.getLibraryName(this.currentTaskLibraryID())}”在本会话中的整库元数据读取。原因：${args.reason || "未说明"}`,
      create_parent_item: `AI 请求为附件 ${args.attachmentKey || ""} 创建一个 ${args.itemType || ""} 父条目，并将该附件挂到新父条目下。`,
      update_metadata: `AI 请求修改条目 ${args.itemKey || ""} 的元数据${Array.isArray(args.creators) ? " 和 creators" : ""}。`,
      set_preference: `AI 请求修改设置 ${args.name || ""}。原因：${args.reason || "未说明"}`,
      request_zotero_restart: `AI 请求重启 Zotero。原因：${args.reason || "未说明"}`,
      move_to_trash: `AI 请求将 ${args.itemKeys ? args.itemKeys.length : 0} 个条目移到回收站。原因：${args.reason || "未说明"}`,
      trigger_plugin_command: `AI 请求触发其他插件命令：${args.commandId || ""}。${args.summary || ""}`,
      lookup_metadata_candidates: `AI 请求为 ${Array.isArray(args.itemKeys) ? args.itemKeys.length : 0} 个条目联网查询元数据候选${args.useTextProbe === false ? "" : "，并可能读取 PDF/EPUB 开头少量文本作为查询线索"}。原因：${args.reason || "未说明"}`,
      export_items_citation: `AI 请求将 ${Array.isArray(args.itemKeys) ? args.itemKeys.length : 0} 个条目导出为 ${args.format || "某种引用格式"}${String(args.saveToPath || "").trim() ? `，并写入文件 ${args.saveToPath}` : "（仅在聊天中返回文本，不写文件）"}。原因：${args.reason || "未说明"}`,
      run_batch_plan: this.batchApprovalSummary(args, false)
    };
    return summaries[toolName] || `AI 请求执行 ${toolName}。`;
  },

  batchApprovalSummary(args, english) {
    const plan = args && Array.isArray(args.plan) ? args.plan : [];
    const counts = {};
    for (const step of plan) {
      const t = (step && step.tool) || "?";
      counts[t] = (counts[t] || 0) + 1;
    }
    const validation = this.validateBatchPlan(plan);
    const stepCount = plan.length;
    const totalItems = validation.ok ? validation.totalItems : 0;
    const highRisk = validation.ok && validation.hasHighRisk;
    const breakdown = Object.keys(counts)
      .map((t) => `${counts[t]}×${t}`)
      .join(", ");
    if (english) {
      return `AI requests a batch plan of ${stepCount} steps (${breakdown || "none"}), ~${totalItems} items${highRisk ? ", includes high-risk steps" : ""}. Reason: ${args.reason || "not specified"}`;
    }
    return `AI 请求批量执行 ${stepCount} 步（${breakdown || "无"}），涉及约 ${totalItems} 个条目${highRisk ? "，含高风险步骤" : ""}。原因：${args.reason || "未说明"}`;
  },

  aiRiskTagClass(level) {
    if (level === "low") {
      return "za-risk-low";
    }
    if (level === "mid") {
      return "za-risk-mid";
    }
    return "za-risk-high";
  },

  aiRiskTagText(level) {
    if (level === "low") {
      return this.uiText("【AI：低风险】");
    }
    if (level === "mid") {
      return this.uiText("【AI：中等风险】");
    }
    return this.uiText("【AI：高风险】");
  },

  renderGrantState(state) {
    const body = this.sidebarPanelBody(state, state.grantNode);
    if (!body) {
      return;
    }
    body.textContent = "";
    const activeLibraryID = this.getActiveLibraryID(state.win);
    const activeLibraryName = this.getLibraryName(activeLibraryID);
    const activeGranted = this.hasSessionReadGrant(activeLibraryID);
    body.appendChild(this.el(state.doc, "div", "", this.t("uiLibrary", { library: activeLibraryName })));
    const grantLine = this.el(
      state.doc,
      "div",
      activeGranted ? "za-grant-on" : "za-grant-off",
      activeGranted ? this.t("libraryReadOn") : this.t("libraryReadOff")
    );
    grantLine.style.marginTop = "6px";
    body.appendChild(grantLine);
    if (this.task && this.task.libraryID && this.task.libraryID !== activeLibraryID) {
      const taskLine = this.el(state.doc, "div", "za-muted", this.t("boundLibrary", { library: this.task.libraryName }));
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
        const line = this.el(state.doc, "div", "za-grant-on", this.t("memoryRecorded", { chars: memory.summary.length, version: memory.version || 1 }));
        line.style.marginTop = "6px";
        body.appendChild(line);
        const details = this.html(state.doc, "details");
        const detailsSummary = this.html(state.doc, "summary");
        detailsSummary.textContent = this.uiText("查看会话摘要");
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
    const prefixes = Array.from(this.sessionPreferenceApprovals).sort((a, b) => a.localeCompare(b, this.compareLocale()));
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
  },

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
    if (toolName === "lookup_metadata_candidates") {
      const wantsProbe = !(args && args.useTextProbe === false);
      if (!wantsProbe || mode === "open") {
        return { required: false, allowed: true };
      }
      const rememberKey = this.approvalKey(toolName, args);
      const remembered = !!this.rememberedApprovals[rememberKey];
      return { required: true, allowed: remembered };
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
    if (toolName === "export_items_citation") {
      const wantsSave = !!(args && String(args.saveToPath || "").trim());
      if (!wantsSave) {
        return { required: false, allowed: true };
      }
      const rememberKey = this.approvalKey(toolName, args);
      const remembered = !!this.rememberedApprovals[rememberKey];
      if (mode === "confirm") {
        return { required: true, allowed: remembered };
      }
      if (mode === "open") {
        return { required: false, allowed: true };
      }
      return { required: true, allowed: remembered };
    }
    if (toolName === "run_batch_plan") {
      const validation = this.validateBatchPlan(args && args.plan);
      if (!validation.ok) {
        return { required: false, allowed: true };
      }
      if (!validation.hasWrite) {
        return { required: false, allowed: true };
      }
      const rememberKey = this.approvalKey(toolName, args);
      const remembered = !!this.rememberedApprovals[rememberKey];
      if (mode === "confirm") {
        return { required: true, allowed: remembered };
      }
      if (mode === "open") {
        return { required: false, allowed: true };
      }
      return { required: true, allowed: remembered };
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
  },

  summarizeToolArgs(toolName, args) {
    const safeArgs = args || {};
    if (this.isEnglishUI()) {
      switch (toolName) {
        case "request_expanded_context":
          return this.truncateText(safeArgs.reason || "Needs full-library context.", 140);
        case "create_collection":
          return `Create collection: ${safeArgs.name || "Untitled"}${safeArgs.parentKey ? `; parent key: ${safeArgs.parentKey}` : ""}`;
        case "add_items_to_collection":
          return `Add ${Array.isArray(safeArgs.itemKeys) ? safeArgs.itemKeys.length : 0} items to ${safeArgs.collectionKey || safeArgs.collectionName || "target collection"}`;
        case "add_tags":
          return `Tags: ${Array.isArray(safeArgs.tags) ? safeArgs.tags.join(", ") : ""}`;
        case "create_note":
        case "append_note":
          return `Target item: ${safeArgs.parentItemKey || safeArgs.itemKey || "not specified"}`;
        case "create_parent_item":
          return `Create ${safeArgs.itemType || "parent item"} for attachment ${safeArgs.attachmentKey || ""}`;
        case "update_metadata":
          return `Update metadata for item ${safeArgs.itemKey || ""}`;
        case "set_preference":
          return `Change preference ${safeArgs.name || ""}`;
        case "browse_preferences":
          return `Browse preference prefix: ${safeArgs.prefix || "root"}`;
        case "search_preferences":
          return `Search preferences: ${safeArgs.query || ""}`;
        case "read_preferences":
          return `Read preferences: ${Array.isArray(safeArgs.names) ? safeArgs.names.join(", ") : (safeArgs.prefix || "root")}`;
        case "read_current_reader_pages":
          return "Read current reader page and nearby pages";
        case "list_preference_panes":
          return "List preference panes";
        case "open_zotero_preferences":
          return args.pane_id ? `Open preference pane: ${args.pane_id}` : "Open Zotero preferences";
        case "request_zotero_restart":
          return `Request Zotero restart: ${safeArgs.reason || ""}`;
        case "move_to_trash":
          return `Move to trash: ${Array.isArray(safeArgs.itemKeys) ? safeArgs.itemKeys.length : 0} items`;
        case "trigger_plugin_command":
          return `Run command: ${safeArgs.commandId || ""}`;
        case "read_fulltext_page":
        case "read_fulltext":
          return `Full-text page: ${safeArgs.itemKey || ""}`;
        case "read_item_fields":
          return `Read right-pane fields: ${safeArgs.itemKey || ""}`;
        case "live_search":
          return this.truncateText(safeArgs.query || "", 160);
        case "web_fetch":
          return this.truncateText(`${safeArgs.url || ""} - ${safeArgs.prompt || ""}`, 200);
        case "lookup_metadata_candidates":
          if (String(safeArgs.query || "").trim()) {
            return `Lookup metadata (query): ${this.truncateText(safeArgs.query, 160)}`;
          }
          return `Lookup metadata candidates: ${Array.isArray(safeArgs.itemKeys) ? safeArgs.itemKeys.length : 0} items${safeArgs.useTextProbe === false ? "" : " with text probe"}`;
        case "list_export_formats":
          return "List available export formats";
        case "export_items_citation":
          return `Export ${Array.isArray(safeArgs.itemKeys) ? safeArgs.itemKeys.length : 0} items as ${safeArgs.format || ""}${String(safeArgs.saveToPath || "").trim() ? ` -> ${safeArgs.saveToPath}` : " (chat)"}`;
        case "run_batch_plan":
          return `Batch plan: ${Array.isArray(safeArgs.plan) ? safeArgs.plan.length : 0} steps`;
        case "finish_task":
          return this.truncateText(safeArgs.summary || "End task.", 160);
        default:
          return this.truncateText(JSON.stringify(safeArgs), 160);
      }
    }
    switch (toolName) {
      case "request_expanded_context":
        return this.truncateText(safeArgs.reason || "需要整库视角。", 140);
      case "create_collection":
        return `新建 collection：${safeArgs.name || "未命名"}${safeArgs.parentKey ? `；父级 key：${safeArgs.parentKey}` : ""}`;
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
      case "read_current_reader_pages":
        return "读取当前阅读器页和前后页";
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
      case "lookup_metadata_candidates":
        if (String(safeArgs.query || "").trim()) {
          return `联网查文献候选：${this.truncateText(safeArgs.query, 160)}`;
        }
        return `联网查元数据候选：${Array.isArray(safeArgs.itemKeys) ? safeArgs.itemKeys.length : 0} 条${safeArgs.useTextProbe === false ? "" : "（含开头文本探测）"}`;
      case "list_export_formats":
        return "列出可用导出格式";
      case "export_items_citation":
        return `导出 ${Array.isArray(safeArgs.itemKeys) ? safeArgs.itemKeys.length : 0} 条为 ${safeArgs.format || ""}${String(safeArgs.saveToPath || "").trim() ? ` -> ${safeArgs.saveToPath}` : "（聊天）"}`;
      case "run_batch_plan":
        return `批量计划：${Array.isArray(safeArgs.plan) ? safeArgs.plan.length : 0} 步`;
      case "finish_task":
        return this.truncateText(safeArgs.summary || "结束任务。", 160);
      default:
        return this.truncateText(JSON.stringify(safeArgs), 160);
    }
  },

  popupScreenOrigin(win) {
    return {
      x: typeof win.mozInnerScreenX === "number" ? win.mozInnerScreenX : (typeof win.screenX === "number" ? win.screenX : 0),
      y: typeof win.mozInnerScreenY === "number" ? win.mozInnerScreenY : (typeof win.screenY === "number" ? win.screenY : 0)
    };
  },

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
  },

  ensureApprovalPopup(state) {
    if (!state.approvalPopup || !state.approvalPopup.parentNode) {
      state.approvalPopup = this.createNativePopup(state, "zotero-assistant-approval-popup", true);
    }
    return state.approvalPopup;
  },

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
  },

  async rejectPending() {
    if (!this.task || !this.task.pendingApproval) {
      return;
    }
    const pending = this.task.pendingApproval;
    this.log("approval.rejected", pending);
    const task = this.task;
    task.pendingApproval = null;
    // Feed the rejection back to the model as a tool result so it can pick a different
    // approach instead of stalling. Do not pause; resume the loop automatically.
    task.messages.push({
      role: "tool",
      tool_call_id: pending.id,
      content: JSON.stringify({
        ok: false,
        rejected: true,
        error: this.isEnglishUI()
          ? `The user rejected this ${pending.toolName} call. Do not repeat the same request; choose another approach, narrow the scope, or explain why the operation is needed.`
          : `用户拒绝了这次 ${pending.toolName} 调用。请不要重复请求同一个操作,改用其它方案、缩小范围,或向用户说明为什么需要这个操作。`,
        toolName: pending.toolName
      })
    });
    task.status = "running";
    task.phase = "approval_rejected_resuming";
    this.flushChatTurnToDisplay();
    this.renderAll();
    if (task.status === "running") {
      this.runTaskLoopInBackground(this.firstState());
    }
    await this.safeUpdateSessionMemoryForTask("approval_rejected_resuming");
  },

  summarizeToolResult(result) {
    if (this.isEnglishUI()) {
      if (!result) {
        return "No result returned.";
      }
      if (result.ok === false) {
        return this.truncateText(result.error || "Tool failed.", 220);
      }
      if (result.waitingForUser) {
        return "Paused, waiting for your input.";
      }
      if (result.collection) {
        return `Created collection: ${result.collection.name || result.collection.key || ""}`;
      }
      if (result.parentItem) {
        return `Created ${result.parentItem.itemType || "parent item"}: ${result.parentItem.title || result.parentItem.key || ""}`;
      }
      if (typeof result.addedCount === "number") {
        return `Added ${result.addedCount} items.`;
      }
      if (result.item && result.metadata) {
        return `Read right-pane metadata fields for ${result.item.title || result.item.key || ""}.`;
      }
      if (typeof result.changedCount === "number") {
        return `Updated ${result.changedCount} fields.`;
      }
      if (typeof result.trashedCount === "number") {
        return `Moved ${result.trashedCount} items to trash.`;
      }
      if (result.noteKey) {
        return `Wrote note ${result.noteKey}.`;
      }
      if (result.commandId) {
        return `Triggered command ${result.commandId}.`;
      }
      if (Array.isArray(result.commands)) {
        return `Found ${result.commands.length} callable commands.`;
      }
      if (Array.isArray(result.childPrefixes)) {
        return `Returned ${result.childPrefixes.length} preference prefixes.`;
      }
      if (Array.isArray(result.preferences)) {
        return `Returned ${result.preferences.length} preferences.`;
      }
      if (result.restartRequested) {
        return "Requested Zotero restart.";
      }
      if (result.pageInfo && typeof result.pageInfo.page === "number") {
        return `Returned page ${result.pageInfo.page}.`;
      }
      if (Array.isArray(result.items)) {
        return `Returned ${result.items.length} items.`;
      }
      if (Array.isArray(result.results)) {
        return `Found ${result.results.length} web results.`;
      }
      if (Array.isArray(result.pages)) {
        const textPages = result.pages.filter((page) => page && page.text).length;
        return `Read ${result.pages.length} pages, ${textPages} with text.`;
      }
      if (result.translatorID && typeof result.itemCount === "number") {
        return `Exported ${result.itemCount} items as ${result.format || result.translatorID}${result.savedToPath ? ` -> ${result.savedToPath}` : ""}.`;
      }
      if (Array.isArray(result.formats)) {
        return `Found ${result.formats.length} export formats.`;
      }
      if (typeof result.total === "number" && Array.isArray(result.results)) {
        return `Batch completed: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed.`;
      }
      if (typeof result.markdown === "string" && result.markdown.length) {
        return `Fetched page (about ${result.markdown.length} characters).`;
      }
      if (result.summary) {
        return this.truncateText(result.summary, 220);
      }
      if (result.ok === true) {
        return "Succeeded.";
      }
      return this.truncateText(JSON.stringify(result), 220);
    }
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
    if (Array.isArray(result.pages)) {
      const textPages = result.pages.filter((page) => page && page.text).length;
      return `读取 ${result.pages.length} 页，${textPages} 页含文本。`;
    }
    if (result.translatorID && typeof result.itemCount === "number") {
      return `已导出 ${result.itemCount} 条为 ${result.format || result.translatorID}${result.savedToPath ? ` -> ${result.savedToPath}` : ""}。`;
    }
    if (Array.isArray(result.formats)) {
      return `发现 ${result.formats.length} 种导出格式。`;
    }
    if (typeof result.total === "number" && Array.isArray(result.results)) {
      return `批量完成：${result.succeeded}/${result.total} 步成功，${result.failed} 步失败。`;
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
  },

  renderApprovalPopup(state) {
    if (state.approvalPopup) {
      this.hidePopup(state.approvalPopup);
    }
    if (state.logPopup) {
      this.hidePopup(state.logPopup);
    }
  },

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
          scope: args.scope || (this.isEnglishUI() ? "Full-library metadata for the current active library" : "当前激活库整库元数据"),
          reason: args.reason || ""
        }, null, 2),
        approveLabel: this.isEnglishUI() ? "Allow this session to read full-library metadata" : "允许本会话读取整库元数据",
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
        approveLabel: this.isEnglishUI() ? "Allow this preference change" : "允许本次设置修改",
        allowRemember: meta.isWritable && !meta.isHiddenOrInternal && !!rememberPrefix,
        rememberKey: `set_preference_prefix:${rememberPrefix}`,
        rememberPrefix,
        rememberLabel: this.isEnglishUI() ? "Remember this prefix" : "记住此前缀"
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
        approveLabel: this.isEnglishUI() ? "Allow Zotero restart" : "允许重启 Zotero",
        allowRemember: false,
        rememberKey: ""
      };
    }
    if (toolName === "export_items_citation") {
      const wantsSave = !!(args && String(args.saveToPath || "").trim());
      if (!wantsSave) {
        return null;
      }
      return {
        id: callID,
        kind: "file_write",
        toolName,
        args,
        summary: this.approvalSummary(toolName, args),
        details: JSON.stringify({
          itemCount: Array.isArray(args.itemKeys) ? args.itemKeys.length : 0,
          format: args.format || "",
          saveToPath: args.saveToPath || "",
          reason: args.reason || ""
        }, null, 2),
        approveLabel: this.isEnglishUI() ? "Allow writing this export file" : "允许写入该导出文件",
        allowRemember: true,
        rememberKey: this.approvalKey(toolName, args)
      };
    }
    if (toolName === "lookup_metadata_candidates") {
      const wantsProbe = !(args && args.useTextProbe === false);
      if (!wantsProbe) {
        return null;
      }
      return {
        id: callID,
        kind: "metadata_lookup_text_probe",
        toolName,
        args,
        summary: this.approvalSummary(toolName, args),
        details: JSON.stringify({
          itemCount: Array.isArray(args.itemKeys) ? args.itemKeys.length : 0,
          itemKeys: Array.isArray(args.itemKeys) ? args.itemKeys : [],
          useTextProbe: args.useTextProbe !== false,
          reason: args.reason || ""
        }, null, 2),
        approveLabel: this.isEnglishUI() ? "Allow metadata lookup text probe" : "允许元数据查询读取开头文本",
        allowRemember: true,
        rememberKey: this.approvalKey(toolName, args)
      };
    }
    if (toolName === "run_batch_plan") {
      const validation = this.validateBatchPlan(args && args.plan);
      const planDetail = Array.isArray(args.plan)
        ? args.plan.map((step, i) => ({
            step: i + 1,
            tool: (step && step.tool) || "",
            label: (step && step.label) || "",
            args: step && step.args
          }))
        : [];
      return {
        id: callID,
        kind: "batch",
        toolName,
        args,
        summary: this.approvalSummary(toolName, args),
        details: JSON.stringify({
          stepCount: planDetail.length,
          totalItems: validation.ok ? validation.totalItems : 0,
          hasHighRisk: validation.ok && validation.hasHighRisk,
          valid: validation.ok,
          validationError: validation.ok ? "" : validation.error,
          reason: (args && args.reason) || "",
          steps: planDetail
        }, null, 2),
        approveLabel: this.isEnglishUI() ? "Allow executing this batch plan" : "允许执行该批量计划",
        allowRemember: true,
        rememberKey: this.approvalKey(toolName, args)
      };
    }
    return {
      id: callID,
      kind: "write_or_command",
      toolName,
      args,
      summary: this.approvalSummary(toolName, args),
      details: JSON.stringify(args, null, 2),
      approveLabel: this.isEnglishUI() ? "Allow once" : "允许本次",
      allowRemember: true,
      rememberKey: this.approvalKey(toolName, args)
    };
  }
};
})();
