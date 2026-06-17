from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "chrome/content/zotero-assistant.js"
t = p.read_text(encoding="utf-8")

# --- PREFS: add token prefs, keep old keys for migration ---
if "contextCompressionMaxTokens" not in t:
    t = t.replace(
        "    contextCompressionKeepMessages: PREF_PREFIX + \"contextCompressionKeepMessages\"\n  };",
        "    contextCompressionKeepMessages: PREF_PREFIX + \"contextCompressionKeepMessages\",\n"
        "    contextCompressionMaxTokens: PREF_PREFIX + \"contextCompressionMaxTokens\",\n"
        "    contextCompressionTargetTokens: PREF_PREFIX + \"contextCompressionTargetTokens\"\n"
        "  };",
        1,
    )

if "DEFAULT_CONTEXT_COMPRESSION_MAX_TOKENS" not in t:
    t = t.replace(
        "  const DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES = 12;\n",
        "  const DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES = 12;\n"
        "  const DEFAULT_CONTEXT_COMPRESSION_MAX_TOKENS = 128000;\n"
        "  const DEFAULT_CONTEXT_COMPRESSION_TARGET_TOKENS = 16000;\n"
        "  const CHARS_PER_TOKEN_ESTIMATE = 4;\n",
        1,
    )

t = t.replace(
    "      this.setDefault(PREFS.contextCompressionKeepMessages, DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES);\n    }",
    "      this.setDefault(PREFS.contextCompressionKeepMessages, DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES);\n"
    "      this.setDefault(PREFS.contextCompressionMaxTokens, DEFAULT_CONTEXT_COMPRESSION_MAX_TOKENS);\n"
    "      this.setDefault(PREFS.contextCompressionTargetTokens, DEFAULT_CONTEXT_COMPRESSION_TARGET_TOKENS);\n"
    "    }",
    1,
)

# boundedIntPref helpers for tokens - find contextCompressionTriggerChars and add after keepMessages
if "contextCompressionMaxTokens()" not in t:
    insert_after = """    contextCompressionKeepMessages() {
      return this.boundedIntPref(PREFS.contextCompressionKeepMessages, DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES, 4, 80);
    }
"""
    new_methods = insert_after + """
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
      this.beginChatTurnUser(taskText);
      this.task.messages.push({ role: "user", content: taskText });
      this.task.status = "running";
      this.task.phase = this.task.phase === "needs_user" ? "resumed" : "continued";
      this.task.error = null;
      this.task.pendingApproval = null;
      this.log("task.user_reply", { id: this.task.id, content: taskText, continued: true });
      this.renderAll();
      if (state && state.chatOpen) {
        this.renderChatPanel(state);
      }
      await this.runTaskLoop();
      this.flushChatTurnToDisplay();
      this.renderAll();
      if (state && state.chatOpen) {
        this.renderChatPanel(state);
      }
      return true;
    }

"""
    if insert_after not in t:
        raise SystemExit("contextCompressionKeepMessages method not found")
    t = t.replace(insert_after, new_methods, 1)

# ensureTaskContextBudget - token only
old_budget = """    async ensureTaskContextBudget() {
      if (!this.task || !this.isAutoCompressionEnabled() || this.task.canContinueAfterCompressionFailure) {
        return;
      }
      const messages = Array.isArray(this.task.messages) ? this.task.messages : [];
      const keepMessages = this.contextCompressionKeepMessages();
      if (messages.length <= keepMessages + 2) {
        return;
      }
      const triggerChars = this.contextCompressionTriggerChars();
      const triggerMessages = Math.max(DEFAULT_CONTEXT_COMPRESSION_TRIGGER_MESSAGES, keepMessages * 4);
      const totalChars = this.estimateMessagesChars(messages);
      if (totalChars <= triggerChars && messages.length <= triggerMessages) {
        return;
      }
      await this.compressTaskContext({ totalChars, messageCount: messages.length, triggerChars, triggerMessages, keepMessages });
    }"""

new_budget = """    async ensureTaskContextBudget() {
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
    }"""

if old_budget not in t:
    raise SystemExit("ensureTaskContextBudget not found")
t = t.replace(old_budget, new_budget, 1)

# compressionSystemInstruction use targetTokens
t = t.replace(
    "    compressionSystemInstruction(targetChars) {\n      return [\n        \"You compress Zotero Assistant task context for future model turns.\",\n        `Return a concise Chinese action summary of about ${targetChars} characters or less.`,",
    "    compressionSystemInstruction(targetTokens) {\n      const targetChars = Math.max(2000, targetTokens * CHARS_PER_TOKEN_ESTIMATE);\n      return [\n        \"You compress Zotero Assistant task context for future model turns.\",\n        `Return a concise Chinese action summary of about ${targetTokens} tokens (${targetChars} characters) or less.`,",
    1,
)

# compressTaskContext use token start + targetTokens
old_compress_start = """      const keepMessages = stats.keepMessages || this.contextCompressionKeepMessages();
      const start = this.recentContextStart(task.messages, keepMessages);
      const olderMessages = task.messages.slice(0, start);
      const recentMessages = task.messages.slice(start).filter((message) => !this.isCompressedContextMessage(message));
      if (!olderMessages.length) {
        return;
      }

      const previousPhase = task.phase;
      task.phase = "compressing_context";
      this.renderAll();
      const targetChars = this.contextCompressionTargetChars();"""

new_compress_start = """      const maxTokens = stats.maxTokens || this.contextCompressionMaxTokens();
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
      const targetChars = Math.max(2000, targetTokens * CHARS_PER_TOKEN_ESTIMATE);"""

if old_compress_start not in t:
    raise SystemExit("compressTaskContext start not found")
t = t.replace(old_compress_start, new_compress_start, 1)

t = t.replace(
    "          systemInstruction: this.compressionSystemInstruction(targetChars)",
    "          systemInstruction: this.compressionSystemInstruction(targetTokens)",
    1,
)

# startTaskFromText - continuous conversation
old_start = """    async startTaskFromText(state, text) {
      const taskText = String(text || "").trim();
      if (!taskText) {
        this.showChatNotice(state, "请输入一个明确任务。助手不会默认执行任何任务。");
        return false;
      }
      if (this.task && this.task.status === "running") {
        this.showChatNotice(state, "已有任务正在运行。请等待完成，或取消后再开始新任务。");
        return false;
      }
      if (this.task && this.task.status === "waiting" && this.task.phase === "needs_user" && !this.task.pendingApproval) {
        this.beginChatTurnUser(taskText);
        this.task.messages.push({ role: "user", content: taskText });
        this.task.status = "running";
        this.task.phase = "resumed";
        this.task.error = null;
        this.log("task.user_reply", { id: this.task.id, content: taskText });
        this.renderAll();
        if (state && state.chatOpen) {
          this.renderChatPanel(state);
        }
        await this.runTaskLoop();
        this.flushChatTurnToDisplay();
        this.renderAll();
        if (state && state.chatOpen) {
          this.renderChatPanel(state);
        }
        return true;
      }
      const libraryID = this.getActiveLibraryID(state.win);"""

new_start = """    async startTaskFromText(state, text) {
      const taskText = String(text || "").trim();
      if (!taskText) {
        this.showChatNotice(state, "请输入一个明确任务。助手不会默认执行任何任务。");
        return false;
      }
      if (this.task && this.task.status === "running") {
        this.showChatNotice(state, "已有任务正在运行。请等待完成，或取消后再开始新任务。");
        return false;
      }
      if (this.canContinueConversationTask()) {
        return await this.continueConversationWithUserMessage(state, taskText);
      }
      const libraryID = this.getActiveLibraryID(state.win);"""

if old_start not in t:
    raise SystemExit("startTaskFromText not found")
t = t.replace(old_start, new_start, 1)

# buildDebugReport settings - add token prefs
t = t.replace(
    "          contextCompressionTriggerChars: this.contextCompressionTriggerChars(),\n"
    "          contextCompressionTargetChars: this.contextCompressionTargetChars(),\n"
    "          contextCompressionKeepMessages: this.contextCompressionKeepMessages()",
    "          contextCompressionMaxTokens: this.contextCompressionMaxTokens(),\n"
    "          contextCompressionTargetTokens: this.contextCompressionTargetTokens(),\n"
    "          contextCompressionKeepMessages: this.contextCompressionKeepMessages()",
    1,
)

# preferences.xhtml simplify
pref = ROOT / "chrome/content/preferences.xhtml"
pt = pref.read_text(encoding="utf-8")
old_pref_block = """      <label>压缩触发字符数</label>
      <html:input
        id="zotero-assistant-pref-contextCompressionTriggerChars"
        type="number"
        min="10000"
        max="500000"
        step="1000"
        preference="extensions.zoteroAssistant.contextCompressionTriggerChars"
      />

      <label>压缩目标字符数</label>
      <html:input
        id="zotero-assistant-pref-contextCompressionTargetChars"
        type="number"
        min="1000"
        max="50000"
        step="500"
        preference="extensions.zoteroAssistant.contextCompressionTargetChars"
      />

      <label>保留最近消息数</label>
      <html:input
        id="zotero-assistant-pref-contextCompressionKeepMessages"
        type="number"
        min="4"
        max="80"
        step="1"
        preference="extensions.zoteroAssistant.contextCompressionKeepMessages"
      />
      <html:p class="za-pref-note">默认在约 80000 字符后压缩旧上下文，目标摘要约 8000 字符，并保留最近 12 条原文消息。本会话任务记忆只保存在内存中，重启 Zotero 后清空。</html:p>"""

new_pref_block = """      <label>上下文最大 token（超过则压缩）</label>
      <html:input
        id="zotero-assistant-pref-contextCompressionMaxTokens"
        type="number"
        min="8000"
        max="2000000"
        step="1000"
        preference="extensions.zoteroAssistant.contextCompressionMaxTokens"
      />

      <label>压缩后目标 token（摘要体量）</label>
      <html:input
        id="zotero-assistant-pref-contextCompressionTargetTokens"
        type="number"
        min="1000"
        max="500000"
        step="500"
        preference="extensions.zoteroAssistant.contextCompressionTargetTokens"
      />
      <html:p class="za-pref-note">默认最大 128000 token、压缩目标 16000 token（按约 4 字符/token 估算）。同一聊天会话内任务与模型上下文连续保留，除非你在侧边栏「清除当前任务」。本会话任务记忆仅在内存中，重启 Zotero 后清空。</html:p>"""

if old_pref_block in pt:
    pt = pt.replace(old_pref_block, new_pref_block, 1)
    pref.write_text(pt, encoding="utf-8")

p.write_text(t, encoding="utf-8")
print("done")