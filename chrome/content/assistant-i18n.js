var ZoteroAssistantI18n = (() => {
  const { PREFS } = ZoteroAssistantConstants;

  const TEXT_EN = {
    "Zotero 助手": "Zotero Assistant",
    "在此配置模型接口与安全模式。助手以聊天框为主界面，执行任务与授权都在聊天框内完成。": "Configure model access and safety mode here. The assistant uses the chat window as its main interface, and task execution plus approvals happen there.",
    "任务驱动 · 可撤销 · 需授权": "Task-driven · Reversible · Permissioned",
    "隐藏": "Hide",
    "设置": "Settings",
    "任务状态": "Task Status",
    "当前库权限": "Current Library Access",
    "待授权操作": "Pending Approvals",
    "执行日志": "Activity Log",
    "打开聊天窗": "Open Chat",
    "助手": "Assistant",
    "聊天式任务入口": "Chat task entry",
    "管理": "Manage",
    "收起": "Collapse",
    "最小化": "Minimize",
    "恢复": "Restore",
    "关闭": "Close",
    "发送": "Send",
    "授权与会话": "Access and Session",
    "暂无任务。在下方输入明确任务后开始。": "No task yet. Enter a clear task below to start.",
    "暂无日志。": "No logs yet.",
    "收起日志": "Collapse Log",
    "展开全部": "Expand All",
    "清除日志": "Clear Log",
    "收回整库读取": "Revoke Library Read",
    "收回整库读取权限": "Revoke Library Read Access",
    "本库会话记忆": "Session Memory for This Library",
    "会话记忆 · 已在设置中关闭": "Session memory · Disabled in settings",
    "本库暂无会话摘要": "No session summary for this library",
    "复制摘要": "Copy Summary",
    "清除记忆": "Clear Memory",
    "清除本库会话记忆": "Clear Session Memory for This Library",
    "查看会话摘要": "View Session Summary",
    "设置前缀授权": "Preference Prefix Grants",
    "本会话暂无设置写入前缀授权": "No preference write prefix grants this session",
    "收回此前缀": "Revoke This Prefix",
    "清除任务": "Clear Task",
    "撤销最近": "Undo Recent",
    "裁剪后继续": "Continue After Trimming",
    "裁剪后继续任务": "Continue After Trimming",
    "清除当前任务": "Clear Current Task",
    "撤销最近操作": "Undo Recent Action",
    "AI 需要整库读取权限": "AI Needs Library Read Access",
    "AI 需要你批准一个操作": "AI Needs Approval",
    "允许本次": "Allow Once",
    "记住此命令": "Remember This Command",
    "拒绝": "Reject",
    "查看详情": "View Details",
    "无待授权操作。": "No pending approvals.",
    "打开聊天窗并输入明确任务后开始。助手不会默认整理书架或执行任何操作。": "Open the chat and enter a clear task to start. The assistant will not organize your library or perform actions by default.",
    "暂无问答。发送任务后，用户和 AI 的可读消息会显示在这里。": "No messages yet. After you send a task, readable user and AI messages will appear here.",
    "AI": "AI",
    "你": "You",
    "我": "Me",
    "工作记录": "Work Log",
    "思考过程": "Reasoning",
    "正在压缩上下文…": "Compressing context...",
    "正在读取 Zotero 上下文…": "Reading Zotero context...",
    "正在思考…": "Thinking...",
    "正在等待模型回复…": "Waiting for model response...",
    "正在处理…": "Processing...",
    "确认模式": "Confirm mode",
    "AI 审核模式": "AI review mode",
    "完全开放模式": "Open mode",
    "审核模型（AI 审核模式专用，留空则用上面的 Model）": "Audit Model (for AI review mode; leave empty to use Model above)",
    "留空则使用主 Model": "Leave empty to use the main Model",
    "AI 审核模式（review）下，每次工具调用前会用此模型评估风险。建议填一个便宜快速的小模型以降低延迟与成本，留空则复用主 Model 与同一 Base URL / API Key。": "In AI review mode, this model evaluates risk before each tool call. A cheap, fast model is recommended; leave empty to reuse the main Model with the same Base URL / API Key.",
    "API 类型": "API Type",
    "自动（默认 Chat Completions）": "Auto (default Chat Completions)",
    "旧式 Completions（/completions）": "Legacy Completions (/completions)",
    "Base URL 可填写根路径，例如 https://api.openai.com/v1；插件会按这里选择的 API 类型自动补全 endpoint。": "Base URL may be a root path, such as https://api.openai.com/v1. The plugin appends the endpoint based on the API type selected here.",
    "Live 搜索（live_search）": "Live Search (live_search)",
    "自动（有 Brave Key 则用 Brave，否则 DuckDuckGo）": "Auto (Brave when a key is set, otherwise DuckDuckGo)",
    "Brave Search API Key（可选）": "Brave Search API Key (optional)",
    "助手工具 live_search / web_fetch 会访问公网。Brave key 见": "Assistant tools live_search / web_fetch access the public web. Brave key:",
    "web_fetch 将页面转为 Markdown 供模型阅读（类似 Claude Code WebFetch）。": "web_fetch converts pages to Markdown for the model, similar to Claude Code WebFetch.",
    "API key 保存在本机 Zotero 偏好中，请勿在不可信环境使用。": "API key is stored in local Zotero preferences. Do not use it in untrusted environments.",
    "划句子提问快捷键": "Selected-text question shortcut",
    "选中 Zotero 窗口中的文本后按此快捷键，会打开聊天窗并预填引用块，不会自动发送给模型。支持 Ctrl / Alt / Shift / Meta 加单键组合。": "After selecting text in a Zotero window, press this shortcut to open chat and prefill a quote block. It will not send automatically. Supports Ctrl / Alt / Shift / Meta plus one key.",
    "启用本会话任务记忆": "Enable session task memory",
    "启用任务上下文自动压缩": "Enable automatic task context compression",
    "上下文最大 token（超过则压缩）": "Max context tokens (compress above this)",
    "压缩后目标 token（摘要体量）": "Target tokens after compression",
    "默认最大 128000 token、压缩目标 16000 token（按约 4 字符/token 估算）。同一聊天会话内任务与模型上下文连续保留，除非你在聊天框「管理」里「清除任务」。本会话任务记忆仅在内存中，重启 Zotero 后清空。": "Defaults are 128000 max tokens and 16000 compression target tokens, estimated at about 4 characters per token. Task and model context are preserved within the chat session unless you use Manage -> Clear Task. Session task memory is in-memory only and clears when Zotero restarts.",
    "启用调试模式": "Enable debug mode",
    "开启后，模型失败、工具连续失败、空响应等问题会额外写出详细诊断文件。": "When enabled, model failures, repeated tool failures, empty responses, and similar issues write detailed diagnostic files.",
    "调试输出目录": "Debug output directory",
    "例如 %USERPROFILE%\\Documents\\zotero-assistant-debug": "Example: %USERPROFILE%\\Documents\\zotero-assistant-debug",
    "目录不存在时会尝试自动创建。调试文件可能包含任务上下文、模型原始返回和文献元数据，请仅写入可信目录。": "The directory is created if missing. Debug files may contain task context, raw model responses, and Zotero metadata; write them only to a trusted directory.",
    "语言 / Language": "语言 / Language",
    "自动 / Auto": "Auto",
    "中文": "中文",
    "English": "English",
    "任务": "Task",
    "继续": "Continue",
    "上下文": "Context",
    "压缩": "Compression",
    "循环": "Loop",
    "模型": "Model",
    "审批": "Approval",
    "工具": "Tool",
    "失败": "Failed",
    "完成": "Done",
    "调整": "Adjust",
    "暂停": "Paused",
    "权限": "Access",
    "撤销": "Undo",
    "记忆": "Memory",
    "调试": "Debug",
    "插件": "Plugin",
    "审核": "Review",
    "事件": "Event",
    "低风险": "Low risk",
    "中等风险": "Medium risk",
    "高风险": "High risk",
    "【AI：低风险】": "[AI: Low risk]",
    "【AI：中等风险】": "[AI: Medium risk]",
    "【AI：高风险】": "[AI: High risk]",
    "搜索文献": "Search items",
    "读取当前选择": "Read current selection",
    "读取条目字段": "Read item fields",
    "读取当前阅读器页面": "Read current reader pages",
    "读取库概览": "Read library overview",
    "浏览库条目": "Browse library items",
    "读取全文": "Read full text",
    "联网搜索": "Live search",
    "抓取网页": "Fetch web page",
    "创建分类": "Create collection",
    "添加标签": "Add tags",
    "创建笔记": "Create note",
    "追加笔记": "Append note",
    "加入分类": "Add to collection",
    "更新元数据": "Update metadata",
    "移到回收站": "Move to trash",
    "修改设置": "Change preference",
    "申请整库读取": "Request library read",
    "调用插件命令": "Run plugin command",
    "列出插件命令": "List plugin commands",
    "浏览设置": "Browse preferences",
    "搜索设置": "Search preferences",
    "读取设置": "Read preferences",
    "列出设置面板": "List preference panes",
    "打开设置页": "Open preferences",
    "创建父条目": "Create parent item",
    "输入框已有草稿": "Input Already Has a Draft",
    "请选择如何处理这次选句提问引用块。追加会插入到当前光标位置，覆盖会替换现有草稿。": "Choose how to handle this selected-text quote block. Append inserts at the current cursor position; replace overwrites the existing draft.",
    "追加": "Append",
    "覆盖": "Replace",
    "取消": "Cancel",
    "打开 Zotero 助手聊天窗": "Open Zotero Assistant chat window"
  };

  const MESSAGES = {
    "zh-CN": {
      selectedLanguageName: "中文",
      selectedLanguageInstruction: "当前用户选择的界面语言是中文。默认用中文向用户展示可见回复、澄清问题、审核理由和最终总结；如果用户在本轮明确要求另一种语言，则优先遵循用户要求。",
      auditReasonInstruction: "{\"level\":\"low|mid|high\",\"reason\":\"一句符合当前用户界面语言的说明\"}",
      auditReasonLengthInstruction: "Keep reason under 40 Chinese characters or 80 English characters, matching the selected UI language.",
      finalSummaryRequired: "finish_task 被拒绝：必须填写给用户的 summary（至少 8 个字），说明做了什么、结果如何。",
      finalSummaryNoPriorMessage: "finish_task 被拒绝：本任务尚未向用户发送过任何说明。请先回复用户，或在 finish_task.summary 中写完整说明（不少于 24 字），再结束任务。",
      finalSummaryPlaceholder: "finish_task 被拒绝：summary 不能只写“如下”式引导语，必须直接包含实际结论、结果或下一步。",
      finalSummaryColon: "finish_task 被拒绝：summary 不能停在冒号后，必须直接包含实际结论、结果或下一步。",
      noVisibleSelection: "未检测到可提问的选中文本。你可以直接在这里输入问题。",
      unreadableSelection: "没有可读选区，或选区位于输入框、可编辑区域、Zotero 助手界面内。",
      selectionLabel: "Zotero 窗口选区",
      selectionFilledTruncated: "已填入选中文本，原文 {originalChars} 字符，已截断为 {includedChars} 字符。",
      selectionFilled: "已填入选中文本。请补充你的问题后发送。",
      selectionAppendedTruncated: "已追加选中文本，原文 {originalChars} 字符，已截断为 {includedChars} 字符。",
      selectionAppended: "已追加选中文本。",
      selectionReplacedTruncated: "已覆盖为选中文本，原文 {originalChars} 字符，已截断为 {includedChars} 字符。",
      selectionReplaced: "已覆盖为选中文本。",
      chatPlaceholder: "输入任务或回复 AI 追问。Shift+Enter 换行，Enter 发送。",
      chatResizeLabel: "拖动调节聊天窗大小",
      chatResizeTitle: "拖动调节大小",
      contentTruncated: "…（内容已截断）",
      reasoningTruncated: "…（思考过程已截断）",
      reasoningOnly: "（模型只返回了思考过程，没有返回正文。）",
      processHeading: "【本回合后台操作】",
      processMore: "… 另有 {count} 步未展开",
      phase: "阶段 · {phase}",
      error: "错误：{error}",
      debugFile: "调试文件：{path}",
      boundLibrary: "绑定库：{library}",
      uiLibrary: "界面库：{library}",
      libraryReadOn: "整库元数据读取 · 已开放",
      libraryReadOff: "整库元数据读取 · 未开放",
      memoryRecorded: "已记录 · {chars} 字符 · 版本 {version}",
      reason: "理由：{reason}",
      noInputTask: "请输入一个明确任务。助手不会默认执行任何任务。",
      cannotBindWindow: "无法绑定 Zotero 主窗口，请关闭聊天窗后从本窗口重新打开。",
      taskAlreadyRunning: "已有任务正在运行，这条已记在聊天里。请等待当前任务结束，或点「管理」→「清除任务」后再发新任务。",
      cannotReadLibrary: "无法读取当前文献库：{error}",
      loopBusy: "任务循环未结束，无法再次启动。请稍候，或点聊天 header 的「管理」→「清除任务」。",
      taskException: "任务异常：{error}",
      pausedPrefix: "【任务已暂停】{detail}",
      chatInitFailed: "聊天显示初始化失败：{error}",
      taskLoopStartFailed: "任务循环启动失败：{error}",
      orphanStuckStarting: "上次任务卡在「启动」阶段（循环未真正开始）。已改为 paused，请重新发送或清除当前任务。",
      orphanRunning: "上次任务循环已中断，但状态仍为 running。已自动修复为 paused，请重新发送或清除当前任务。",
      openPreferencesUnsupported: "当前 Zotero 环境不支持 openPreferences。",
      prefPaneMissing: "未找到设置面板 id「{id}」。请先调用 list_preference_panes 查看已注册的 pane id。",
      fetchUnavailable: "当前 Zotero 环境没有可用的 fetch 实现。",
      apiKeyMissing: "尚未配置 API key。",
      modelRequestFailed: "{variant} 请求失败：{error}",
      modelHttpError: "{variant} 请求返回 HTTP {status}{detail}",
      modelInvalidJson: "{variant} 请求成功，但返回不是合法 JSON。",
      modelUnrecognizedResponse: "{variant} 请求成功，但响应无法识别。",
      modelUnrecognizedResponseHelp: "模型响应无法识别。请检查 endpoint 路径、模型返回格式，或让模型返回文本、tool_calls、或 JSON 工具计划。",
      auditUnavailable: "审核不可用，需人工确认。",
      auditTimeout: "审核超时（{ms}ms）",
      auditUnparseable: "审核返回无法解析。",
      auditFailedReason: "审核失败：{error}。需人工确认。",
      toolConsecutiveFailures: "工具连续失败 3 次：{toolName} - {error}",
      needTaskClarification: "需要你补充任务目标。",
      recommendedAnswer: "推荐：{answer}",
      reasoningLabel: "思考过程",
      sourceZoteroWindow: "来源：Zotero 窗口选区",
      sourceZoteroWindowTitle: "来源：Zotero 窗口选区 - {title}",
      sourceZoteroReader: "来源：Zotero 阅读器{title}",
      attachmentKey: "附件 key：{key}",
      currentPage: "当前页：{page}",
      answerBasedOnText: "基于这段文字回答：",
      myQuestion: "我的问题：",
      draftExistingBusy: "聊天输入框已有草稿，且当前任务正在运行。请选择如何处理草稿，任务结束后再发送。",
      draftExisting: "聊天输入框已有草稿，请选择追加、覆盖或取消。",
      currentTaskRunningWait: "当前任务正在运行，请等待结束后再发送。",
      selectionDraftCancelled: "已取消这次选句提问草稿。",
      toolExecutionFailed: "工具执行失败",
      contextCompressionFailed: "上下文压缩失败",
      modelCallFailed: "模型调用失败",
      loopLimitMissing: "达到轮次上限后，最终总结轮没有返回可用文本。",
      loopLimitFailed: "达到轮次上限后，最终总结轮失败：{error}",
      emptyAssistantResponse: "模型连续没有返回可显示文本，也没有返回工具调用。"
    },
    "en-US": {
      selectedLanguageName: "English",
      selectedLanguageInstruction: "The selected UI language is English. By default, use English for user-visible replies, clarification questions, review reasons, and final summaries. If the user explicitly asks for another language in this turn, follow the user's instruction.",
      auditReasonInstruction: "{\"level\":\"low|mid|high\",\"reason\":\"one short reason in the selected UI language\"}",
      auditReasonLengthInstruction: "Keep reason under 40 Chinese characters or 80 English characters, matching the selected UI language.",
      finalSummaryRequired: "finish_task rejected: summary is required and must explain what was done and what the result is.",
      finalSummaryNoPriorMessage: "finish_task rejected: this task has not sent a proper user-facing explanation. Reply to the user first, or provide a complete finish_task.summary of at least 24 characters.",
      finalSummaryPlaceholder: "finish_task rejected: summary cannot be only a placeholder such as “as follows”; include the actual result, conclusion, or next step.",
      finalSummaryColon: "finish_task rejected: summary cannot stop after a colon; include the actual result, conclusion, or next step.",
      noVisibleSelection: "No readable selected text was detected. You can type your question here directly.",
      unreadableSelection: "No readable selection, or the selection is inside an input field, editable area, or the Zotero Assistant UI.",
      selectionLabel: "Zotero window selection",
      selectionFilledTruncated: "Selected text was inserted. Original {originalChars} characters, truncated to {includedChars} characters.",
      selectionFilled: "Selected text was inserted. Add your question before sending.",
      selectionAppendedTruncated: "Selected text was appended. Original {originalChars} characters, truncated to {includedChars} characters.",
      selectionAppended: "Selected text was appended.",
      selectionReplacedTruncated: "Replaced with selected text. Original {originalChars} characters, truncated to {includedChars} characters.",
      selectionReplaced: "Replaced with selected text.",
      chatPlaceholder: "Enter a task or reply to AI. Shift+Enter for newline, Enter to send.",
      chatResizeLabel: "Drag to resize the chat window",
      chatResizeTitle: "Drag to resize",
      contentTruncated: "\n...(content truncated)",
      reasoningTruncated: "\n...(reasoning truncated)",
      reasoningOnly: "(The model returned reasoning only, with no visible answer.)",
      processHeading: "[Background operations this turn]",
      processMore: "... {count} more steps hidden",
      phase: "Phase · {phase}",
      error: "Error: {error}",
      debugFile: "Debug file: {path}",
      boundLibrary: "Bound library: {library}",
      uiLibrary: "UI library: {library}",
      libraryReadOn: "Full-library metadata read · Granted",
      libraryReadOff: "Full-library metadata read · Not granted",
      memoryRecorded: "Recorded · {chars} chars · Version {version}",
      reason: "Reason: {reason}",
      noInputTask: "Enter a clear task. The assistant will not run a default task.",
      cannotBindWindow: "Cannot bind the Zotero main window. Close the chat and reopen it from this window.",
      taskAlreadyRunning: "A task is already running. This message was recorded in chat. Wait for it to finish, or use Manage -> Clear Task before sending a new task.",
      cannotReadLibrary: "Cannot read the current library: {error}",
      loopBusy: "The task loop is still running and cannot be started again. Wait a moment, or use Manage -> Clear Task.",
      taskException: "Task error: {error}",
      pausedPrefix: "[Task paused] {detail}",
      chatInitFailed: "Chat display initialization failed: {error}",
      taskLoopStartFailed: "Task loop failed to start: {error}",
      orphanStuckStarting: "The previous task got stuck during startup before the loop began. It has been changed to paused. Resend or clear the current task.",
      orphanRunning: "The previous task loop was interrupted while still marked as running. It has been repaired to paused. Resend or clear the current task.",
      openPreferencesUnsupported: "This Zotero environment does not support openPreferences.",
      prefPaneMissing: "Preference pane id \"{id}\" was not found. Call list_preference_panes first to inspect registered pane ids.",
      fetchUnavailable: "No fetch implementation is available in this Zotero environment.",
      apiKeyMissing: "API key is not configured.",
      modelRequestFailed: "{variant} request failed: {error}",
      modelHttpError: "{variant} request returned HTTP {status}{detail}",
      modelInvalidJson: "{variant} request succeeded, but the response was not valid JSON.",
      modelUnrecognizedResponse: "{variant} request succeeded, but the response format was not recognized.",
      modelUnrecognizedResponseHelp: "The model response was not recognized. Check the endpoint path and response format, or make the model return text, tool_calls, or a JSON tool plan.",
      auditUnavailable: "Review is unavailable and needs human confirmation.",
      auditTimeout: "Review timed out ({ms}ms)",
      auditUnparseable: "Review response could not be parsed.",
      auditFailedReason: "Review failed: {error}. Human confirmation is required.",
      toolConsecutiveFailures: "Tool failed 3 times in a row: {toolName} - {error}",
      needTaskClarification: "I need more detail about the task goal.",
      recommendedAnswer: "Recommended: {answer}",
      reasoningLabel: "Reasoning",
      sourceZoteroWindow: "Source: Zotero window selection",
      sourceZoteroWindowTitle: "Source: Zotero window selection - {title}",
      sourceZoteroReader: "Source: Zotero reader{title}",
      attachmentKey: "Attachment key: {key}",
      currentPage: "Current page: {page}",
      answerBasedOnText: "Answer based on this text:",
      myQuestion: "My question:",
      draftExistingBusy: "The chat input already has a draft and the current task is running. Choose how to handle the draft, then send it after the task finishes.",
      draftExisting: "The chat input already has a draft. Choose append, replace, or cancel.",
      currentTaskRunningWait: "A task is currently running. Wait for it to finish before sending.",
      selectionDraftCancelled: "This selected-text question draft was canceled.",
      toolExecutionFailed: "Tool execution failed",
      contextCompressionFailed: "Context compression failed",
      modelCallFailed: "Model call failed",
      loopLimitMissing: "After reaching the loop limit, the final summary round returned no usable text.",
      loopLimitFailed: "After reaching the loop limit, the final summary round failed: {error}",
      emptyAssistantResponse: "The model repeatedly returned no visible text and no tool calls."
    }
  };

  const TEXT_ZH = Object.fromEntries(Object.entries(TEXT_EN).map(([zh, en]) => [en, zh]));
  const PREF_PANE_TEXT = new WeakMap();
  const PREF_PANE_ATTRS = new WeakMap();
  const PREF_PANE_LISTENERS = new WeakSet();

  function format(template, params) {
    return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
      return params && Object.prototype.hasOwnProperty.call(params, key)
        ? String(params[key])
        : match;
    });
  }

  function textSourceValue(value) {
    const raw = String(value == null ? "" : value);
    const trimmed = raw.trim();
    if (TEXT_EN[trimmed]) {
      return raw;
    }
    if (TEXT_ZH[trimmed]) {
      return raw.replace(trimmed, TEXT_ZH[trimmed]);
    }
    return raw;
  }

  function translatedTextValue(value, english) {
    const raw = String(value == null ? "" : value);
    if (!english) {
      return raw;
    }
    const trimmed = raw.trim();
    return TEXT_EN[trimmed] ? raw.replace(trimmed, TEXT_EN[trimmed]) : raw;
  }

  function validLanguage(value) {
    return value === "auto" || value === "zh-CN" || value === "en-US";
  }

  return {
    uiLanguagePref() {
      try {
        return String(Zotero.Prefs.get(PREFS.uiLanguage, true) || "auto");
      } catch (error) {
        return "auto";
      }
    },

    appLocaleCode() {
      const candidates = [
        () => Services && Services.locale && Services.locale.appLocalesAsBCP47 && Services.locale.appLocalesAsBCP47[0],
        () => Services && Services.locale && Services.locale.requestedLocales && Services.locale.requestedLocales[0],
        () => Services && Services.locale && Services.locale.availableLocales && Services.locale.availableLocales[0],
        () => this.firstWindow() && this.firstWindow().navigator && this.firstWindow().navigator.language,
        () => typeof navigator !== "undefined" && navigator.language
      ];
      for (const getter of candidates) {
        try {
          const value = getter();
          if (value) {
            return String(value);
          }
        } catch (error) {
          // Try the next locale source.
        }
      }
      return "en-US";
    },

    currentUILocale() {
      const pref = this.uiLanguagePref();
      if (pref === "zh-CN" || pref === "en-US") {
        return pref;
      }
      return /^zh\b|^zh[-_]/i.test(this.appLocaleCode()) ? "zh-CN" : "en-US";
    },

    isEnglishUI() {
      return this.currentUILocale() === "en-US";
    },

    uiText(text) {
      const raw = String(text == null ? "" : text);
      if (!raw || !this.isEnglishUI()) {
        return raw;
      }
      return TEXT_EN[raw] || raw;
    },

    t(key, params = {}) {
      const locale = this.currentUILocale();
      const table = MESSAGES[locale] || MESSAGES["en-US"];
      const fallback = MESSAGES["zh-CN"][key] || MESSAGES["en-US"][key] || key;
      return format(table[key] || fallback, params);
    },

    selectedLanguageName() {
      return this.t("selectedLanguageName");
    },

    selectedLanguageInstruction() {
      return this.t("selectedLanguageInstruction");
    },

    localeForPreferenceValue(pref) {
      if (pref === "zh-CN" || pref === "en-US") {
        return pref;
      }
      return /^zh\b|^zh[-_]/i.test(this.appLocaleCode()) ? "zh-CN" : "en-US";
    },

    compareLocale() {
      return this.currentUILocale() === "zh-CN" ? "zh-Hans-CN" : "en-US";
    },

    preferencePaneLanguageControlValue(doc) {
      const control = doc && doc.getElementById && doc.getElementById("zotero-assistant-pref-uiLanguage");
      if (!control) {
        return "";
      }
      const selectedItem = control.selectedItem || null;
      const radios = control.querySelectorAll ? Array.from(control.querySelectorAll("radio")) : [];
      const checkedRadio = radios.find((radio) => {
        return radio && (radio.checked || radio.selected || radio.getAttribute("selected") === "true");
      });
      const candidates = [
        control.value,
        control.getAttribute && control.getAttribute("value"),
        selectedItem && selectedItem.value,
        selectedItem && selectedItem.getAttribute && selectedItem.getAttribute("value"),
        checkedRadio && checkedRadio.value,
        checkedRadio && checkedRadio.getAttribute && checkedRadio.getAttribute("value")
      ];
      for (const candidate of candidates) {
        const value = String(candidate || "");
        if (validLanguage(value)) {
          return value;
        }
      }
      return "";
    },

    preferencePaneLanguageFromEvent(event) {
      const target = event && event.target;
      const selectedItem = target && target.selectedItem || null;
      const candidates = [
        target && target.value,
        target && target.getAttribute && target.getAttribute("value"),
        selectedItem && selectedItem.value,
        selectedItem && selectedItem.getAttribute && selectedItem.getAttribute("value")
      ];
      for (const candidate of candidates) {
        const value = String(candidate || "");
        if (validLanguage(value)) {
          return value;
        }
      }
      return "";
    },

    preferencePaneLocale(root) {
      const override = root && root.getAttribute && root.getAttribute("data-za-ui-language-override");
      if (validLanguage(override)) {
        return this.localeForPreferenceValue(override);
      }
      return this.localeForPreferenceValue(this.uiLanguagePref());
    },

    localizePreferencePaneNode(node, english) {
      if (!node) {
        return;
      }
      if (node.nodeType === 3) {
        if (!PREF_PANE_TEXT.has(node)) {
          PREF_PANE_TEXT.set(node, textSourceValue(node.nodeValue));
        }
        node.nodeValue = translatedTextValue(PREF_PANE_TEXT.get(node), english);
        return;
      }
      if (node.nodeType !== 1) {
        return;
      }
      const tag = String(node.localName || node.tagName || "").toLowerCase();
      for (const attr of ["label", "placeholder", "title", "aria-label"]) {
        const value = node.getAttribute && node.getAttribute(attr);
        if (!value) {
          continue;
        }
        let attrs = PREF_PANE_ATTRS.get(node);
        if (!attrs) {
          attrs = {};
          PREF_PANE_ATTRS.set(node, attrs);
        }
        if (!Object.prototype.hasOwnProperty.call(attrs, attr)) {
          attrs[attr] = textSourceValue(value);
        }
        node.setAttribute(attr, translatedTextValue(attrs[attr], english));
      }
      if (tag === "script" || tag === "style") {
        return;
      }
      for (const child of Array.from(node.childNodes || [])) {
        this.localizePreferencePaneNode(child, english);
      }
    },

    installPreferencePaneLanguageListener(root) {
      if (!root || PREF_PANE_LISTENERS.has(root)) {
        return;
      }
      const doc = root.ownerDocument;
      const control = doc && doc.getElementById && doc.getElementById("zotero-assistant-pref-uiLanguage");
      if (!control) {
        return;
      }
      const applyFromEvent = (event) => {
        const value = this.preferencePaneLanguageFromEvent(event) || this.preferencePaneLanguageControlValue(doc);
        if (validLanguage(value)) {
          root.setAttribute("data-za-ui-language-override", value);
        }
        const win = doc.defaultView;
        const apply = () => this.localizePreferencePaneDocument(doc);
        if (win && typeof win.setTimeout === "function") {
          win.setTimeout(apply, 0);
        } else {
          apply();
        }
      };
      const radios = control.querySelectorAll ? Array.from(control.querySelectorAll("radio")) : [];
      for (const eventName of ["command", "change", "select", "click"]) {
        control.addEventListener(eventName, applyFromEvent);
        for (const radio of radios) {
          radio.addEventListener(eventName, applyFromEvent);
        }
      }
      PREF_PANE_LISTENERS.add(root);
    },

    localizePreferencePaneDocument(doc) {
      const root = doc && doc.getElementById && doc.getElementById("zotero-prefpane-zotero-assistant");
      if (!root) {
        return false;
      }
      this.installPreferencePaneLanguageListener(root);
      this.localizePreferencePaneNode(root, this.preferencePaneLocale(root) === "en-US");
      return true;
    },

    localizeKnownPreferencePanes() {
      const docs = new Set();
      if (this.windows) {
        for (const state of this.windows.values()) {
          if (state && state.doc) {
            docs.add(state.doc);
          }
        }
      }
      try {
        const enumerator = Services && Services.wm && Services.wm.getEnumerator && Services.wm.getEnumerator(null);
        while (enumerator && enumerator.hasMoreElements()) {
          const win = enumerator.getNext();
          if (win && win.document) {
            docs.add(win.document);
          }
        }
      } catch (error) {
        // Known Zotero main windows are enough in normal builds.
      }
      let localized = false;
      for (const doc of docs) {
        localized = this.localizePreferencePaneDocument(doc) || localized;
      }
      return localized;
    },

    schedulePreferencePaneLocalizationPass() {
      const win = this.firstWindow && this.firstWindow();
      const delays = [0, 100, 400, 1000];
      for (const delay of delays) {
        const run = () => this.localizeKnownPreferencePanes();
        if (win && typeof win.setTimeout === "function") {
          win.setTimeout(run, delay);
        } else if (typeof setTimeout === "function") {
          setTimeout(run, delay);
        } else {
          run();
        }
      }
    }
  };
})();
