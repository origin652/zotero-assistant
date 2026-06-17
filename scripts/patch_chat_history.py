from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "chrome/content/zotero-assistant.js"
t = p.read_text(encoding="utf-8")

if "MAX_CHAT_DISPLAY_LOG" not in t:
    t = t.replace(
        "  const CHAT_DEFAULT_HEIGHT = 560;\n",
        "  const CHAT_DEFAULT_HEIGHT = 560;\n"
        "  const MAX_CHAT_DISPLAY_LOG = 200;\n"
        "  const MAX_CHAT_DISPLAY_CHARS = 24000;\n",
        1,
    )

if "this.chatDisplayLog = []" not in t:
    t = t.replace(
        "      this.shownToastKeys = new Set();\n    }",
        "      this.shownToastKeys = new Set();\n"
        "      this.chatDisplayLog = [];\n"
        "    }",
        1,
    )

insert_before_build = "    buildChatTranscript() {"
helpers = """    appendChatDisplay(speaker, text) {
      const raw = String(text || "").trim();
      if (!raw) {
        return;
      }
      const clipped = raw.length > MAX_CHAT_DISPLAY_CHARS
        ? raw.slice(0, MAX_CHAT_DISPLAY_CHARS) + "\\n…（内容已截断）"
        : raw;
      const isUser = speaker === "user";
      this.chatDisplayLog.push({
        speaker: isUser ? "user" : "ai",
        label: isUser ? "你" : "AI",
        text: clipped,
        time: Date.now()
      });
      if (this.chatDisplayLog.length > MAX_CHAT_DISPLAY_LOG) {
        this.chatDisplayLog = this.chatDisplayLog.slice(-MAX_CHAT_DISPLAY_LOG);
      }
    }

    appendAssistantToolCallsToChatDisplay(toolCalls) {
      if (!Array.isArray(toolCalls)) {
        return;
      }
      for (const call of toolCalls) {
        const line = this.chatMessageTextFromToolCall(call);
        if (line) {
          this.appendChatDisplay("ai", line);
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
          this.appendChatDisplay("user", this.normalizeTextContent(message.content));
        } else if (message.role === "assistant") {
          const text = this.normalizeTextContent(message.content);
          if (text) {
            this.appendChatDisplay("ai", text);
          }
          this.appendAssistantToolCallsToChatDisplay(message.tool_calls);
        }
      }
      if (this.task.summary) {
        const last = this.chatDisplayLog[this.chatDisplayLog.length - 1];
        if (!last || last.speaker !== "ai" || last.text !== this.task.summary) {
          this.appendChatDisplay("ai", this.task.summary);
        }
      }
    }

"""

if "appendChatDisplay(speaker, text)" not in t:
    if insert_before_build not in t:
        raise SystemExit("buildChatTranscript anchor missing")
    t = t.replace(insert_before_build, helpers + insert_before_build, 1)

old_build = """    buildChatTranscript() {
      const transcript = [];
      if (!this.task || !Array.isArray(this.task.messages)) {
        return transcript;
      }
      for (const message of this.task.messages) {
        if (!message) {
          continue;
        }
        if (message.role === "user") {
          const text = this.normalizeTextContent(message.content);
          if (text) {
            transcript.push({ speaker: "user", label: "你", text });
          }
          continue;
        }
        if (message.role === "assistant") {
          const text = this.normalizeTextContent(message.content);
          if (text) {
            transcript.push({ speaker: "ai", label: "AI", text });
          }
          if (Array.isArray(message.tool_calls)) {
            for (const call of message.tool_calls) {
              const callText = this.chatMessageTextFromToolCall(call);
              if (callText) {
                transcript.push({ speaker: "ai", label: "AI", text: callText });
              }
            }
          }
        }
      }
      if (this.task.summary) {
        const last = transcript[transcript.length - 1];
        if (!last || last.speaker !== "ai" || last.text !== this.task.summary) {
          transcript.push({ speaker: "ai", label: "AI", text: this.task.summary });
        }
      }
      return transcript.slice(-30);
    }"""

new_build = """    buildChatTranscript() {
      this.backfillChatDisplayFromTask();
      if (this.chatDisplayLog.length) {
        return this.chatDisplayLog.slice(-80).map((entry) => ({
          speaker: entry.speaker,
          label: entry.label,
          text: entry.text
        }));
      }
      return [];
    }"""

if old_build not in t:
    raise SystemExit("buildChatTranscript body not found")
t = t.replace(old_build, new_build, 1)

# startTaskFromText: append on user_reply and new task
old_reply = """      if (this.task && this.task.status === "waiting" && this.task.phase === "needs_user" && !this.task.pendingApproval) {
        this.task.messages.push({ role: "user", content: taskText });
        this.task.status = "running";"""

new_reply = """      if (this.task && this.task.status === "waiting" && this.task.phase === "needs_user" && !this.task.pendingApproval) {
        this.appendChatDisplay("user", taskText);
        this.task.messages.push({ role: "user", content: taskText });
        this.task.status = "running";"""

if old_reply in t:
    t = t.replace(old_reply, new_reply, 1)

old_new_task = """      const libraryID = this.getActiveLibraryID(state.win);
      const libraryName = this.getLibraryName(libraryID);
      this.task = {
        id: `task-${Date.now()}`,
        prompt: taskText,"""

new_new_task = """      const libraryID = this.getActiveLibraryID(state.win);
      const libraryName = this.getLibraryName(libraryID);
      this.appendChatDisplay("user", taskText);
      this.task = {
        id: `task-${Date.now()}`,
        prompt: taskText,"""

if old_new_task in t:
    t = t.replace(old_new_task, new_new_task, 1)

# handlePlainAssistantMessage
old_plain = """    async handlePlainAssistantMessage(content) {
      const text = this.normalizeTextContent(content);
      if (!text) {"""

new_plain = """    async handlePlainAssistantMessage(content) {
      const text = this.normalizeTextContent(content);
      if (text) {
        this.appendChatDisplay("ai", text);
      }
      if (!text) {"""

if old_plain in t:
    t = t.replace(old_plain, new_plain, 1)

# handleModelResponse - after push message, log tool calls to chat
old_handle = """    async handleModelResponse(message) {
      this.task.messages.push(message);
      if (!Array.isArray(message.tool_calls) || !message.tool_calls.length) {
        await this.handlePlainAssistantMessage(message.content);"""

new_handle = """    async handleModelResponse(message) {
      this.task.messages.push(message);
      const assistantText = this.normalizeTextContent(message.content);
      if (assistantText) {
        this.appendChatDisplay("ai", assistantText);
      }
      if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
        this.appendAssistantToolCallsToChatDisplay(message.tool_calls);
      }
      if (!Array.isArray(message.tool_calls) || !message.tool_calls.length) {
        await this.handlePlainAssistantMessage(message.content);"""

if old_handle in t:
    t = t.replace(old_handle, new_handle, 1)
    # avoid double append in handlePlainAssistantMessage when text exists - handlePlainAssistantMessage still appends - DUPLICATE

# Fix duplicate: remove append from handlePlainAssistantMessage when we already append in handleModelResponse for no-tool path
t = t.replace(
    """    async handlePlainAssistantMessage(content) {
      const text = this.normalizeTextContent(content);
      if (text) {
        this.appendChatDisplay("ai", text);
      }
      if (!text) {""",
    """    async handlePlainAssistantMessage(content) {
      const text = this.normalizeTextContent(content);
      if (!text) {""",
    1,
)

p.write_text(t, encoding="utf-8")
print("done")