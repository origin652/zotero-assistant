from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "chrome/content/zotero-assistant.js"
t = p.read_text(encoding="utf-8")

if "this.chatTurnPending" not in t:
    t = t.replace(
        "      this.chatDisplayLog = [];\n    }",
        "      this.chatDisplayLog = [];\n"
        "      this.chatTurnPending = { userText: \"\", aiReadable: [], process: [] };\n"
        "    }",
        1,
    )

# Replace appendChatDisplay and related helpers through buildChatTranscript
old_block_start = "    appendChatDisplay(speaker, text) {"
old_block_end = "      return [];\n    }\n\n    evaluateApproval(toolName, args) {"

i0 = t.find(old_block_start)
i1 = t.find("    evaluateApproval(toolName, args) {")
if i0 < 0 or i1 < 0:
    raise SystemExit("block range not found")

new_block = """    appendChatDisplay(speaker, text, options = {}) {
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
      this.chatTurnPending = {
        userText: String(text || "").trim(),
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
      const tail = items.length > maxLines ? `\\n… 另有 ${items.length - maxLines} 步未展开` : "";
      return ["【本回合后台操作】", ...head.map((line, index) => `${index + 1}. ${line}`)].join("\\n") + tail;
    }

    flushChatTurnToDisplay() {
      const turn = this.chatTurnPending;
      if (!turn) {
        this.resetChatTurnPending();
        return;
      }
      const userText = String(turn.userText || "").trim();
      const readable = (turn.aiReadable || []).filter(Boolean);
      const process = (turn.process || []).filter(Boolean);
      if (!userText && !readable.length && !process.length) {
        this.resetChatTurnPending();
        return;
      }
      if (userText) {
        this.appendChatDisplay("user", userText);
      }
      if (readable.length) {
        this.appendChatDisplay("ai", readable.join("\\n\\n"), { label: "AI", kind: "ai" });
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
      const assistantText = this.normalizeTextContent(message.content);
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
          this.beginChatTurnUser(this.normalizeTextContent(message.content));
        } else if (message.role === "assistant") {
          this.absorbAssistantMessageForChatDisplay(message);
        }
      }
      if (this.task.summary) {
        this.pushChatTurnReadable(this.task.summary);
      }
      this.flushChatTurnToDisplay();
    }

    buildChatTranscript() {
      this.backfillChatDisplayFromTask();
      if (this.chatDisplayLog.length) {
        return this.chatDisplayLog.slice(-80).map((entry) => ({
          speaker: entry.speaker,
          label: entry.label,
          text: entry.text,
          kind: entry.kind || entry.speaker
        }));
      }
      return [];
    }

"""

t = t[:i0] + new_block + t[i1:]

# handleModelResponse
old_hmr = """    async handleModelResponse(message) {
      this.task.messages.push(message);
      const assistantText = this.normalizeTextContent(message.content);
      if (assistantText) {
        this.appendChatDisplay("ai", assistantText);
      }
      if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
        this.appendAssistantToolCallsToChatDisplay(message.tool_calls);
      }
      if (!Array.isArray(message.tool_calls) || !message.tool_calls.length) {"""

new_hmr = """    async handleModelResponse(message) {
      this.task.messages.push(message);
      this.absorbAssistantMessageForChatDisplay(message);
      if (!Array.isArray(message.tool_calls) || !message.tool_calls.length) {"""

if old_hmr not in t:
    raise SystemExit("handleModelResponse head not found")
t = t.replace(old_hmr, new_hmr, 1)

# flush when waiting for user after plain message
old_plain_end = """      if (needsUserReply) {
        this.task.error = null;
        this.task.status = "waiting";
        this.task.phase = "needs_user";
      } else {"""

new_plain_end = """      if (needsUserReply) {
        this.task.error = null;
        this.task.status = "waiting";
        this.task.phase = "needs_user";
        this.flushChatTurnToDisplay();
      } else {"""

if old_plain_end in t:
    t = t.replace(old_plain_end, new_plain_end, 1)

# finish_task tool - flush on complete in toolFinishTask
old_finish = """      this.task.status = "complete";
      this.task.phase = "complete";
      this.task.summary = args.summary || "任务完成。";
      await this.safeUpdateSessionMemoryForTask("completed");"""

new_finish = """      this.task.status = "complete";
      this.task.phase = "complete";
      this.task.summary = args.summary || "任务完成。";
      if (args.summary) {
        this.pushChatTurnReadable(args.summary);
      }
      this.flushChatTurnToDisplay();
      await this.safeUpdateSessionMemoryForTask("completed");"""

if old_finish in t:
    t = t.replace(old_finish, new_finish, 1)

# startTaskFromText - beginChatTurnUser instead of appendChatDisplay
t = t.replace(
    '        this.appendChatDisplay("user", taskText);\n        this.task.messages.push({ role: "user", content: taskText });',
    '        this.beginChatTurnUser(taskText);\n        this.task.messages.push({ role: "user", content: taskText });',
    1,
)
t = t.replace(
    '      this.appendChatDisplay("user", taskText);\n      this.task = {',
    '      this.beginChatTurnUser(taskText);\n      this.task = {',
    1,
)

# user reply path should begin new turn? No - continuing same task turn with another user message - that's a new user bubble in same conversation - beginChatTurnUser flushes previous turn including AI - good for user_reply too
t = t.replace(
    '        this.beginChatTurnUser(taskText);\n        this.task.messages.push({ role: "user", content: taskText });\n        this.task.status = "running";\n        this.task.phase = "resumed";',
    '        this.beginChatTurnUser(taskText);\n        this.task.messages.push({ role: "user", content: taskText });\n        this.task.status = "running";\n        this.task.phase = "resumed";',
    1,
)

# sendChatInput clear immediately
old_send = """    async sendChatInput(state) {
      const text = (state && state.chatInputNode && state.chatInputNode.value || "").trim();
      const accepted = await this.startTaskFromText(state, text);
      if (accepted && state.chatInputNode) {
        state.chatInputNode.value = "";
        state.chatNotice = "";
      }
      this.renderAll();
    }"""

new_send = """    async sendChatInput(state) {
      const text = (state && state.chatInputNode && state.chatInputNode.value || "").trim();
      if (!text) {
        return;
      }
      if (state.chatInputNode) {
        state.chatInputNode.value = "";
      }
      state.chatNotice = "";
      await this.startTaskFromText(state, text);
      this.renderAll();
    }"""

if old_send in t:
    t = t.replace(old_send, new_send, 1)

# process bubble style in createChatBubbleRow
old_bubble = """      const name = this.el(doc, "div", "za-chat-name", entry.label || (isUser ? "你" : "AI"));
      name.style.cssText = "font-size:11px;font-weight:600;color:#8a8f99;line-height:1.2;padding:0 4px;";
      const bubble = this.el(doc, "div", isUser ? "za-chat-bubble za-chat-bubble-user" : "za-chat-bubble za-chat-bubble-ai", "");
      bubble.style.cssText = isUser
        ? "max-width:100%;border-radius:10px;border-bottom-right-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#95ec69;color:#111827;box-shadow:0 1px 2px rgba(0,0,0,0.06);"
        : "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#ffffff;color:#111827;border:1px solid #e2e5ea;box-shadow:0 1px 2px rgba(0,0,0,0.06);";
      this.fillChatBubbleContent(bubble, entry.text, isUser);"""

new_bubble = """      const isProcess = entry.kind === "process";
      const name = this.el(doc, "div", "za-chat-name", entry.label || (isUser ? "你" : "AI"));
      name.style.cssText = "font-size:11px;font-weight:600;color:#8a8f99;line-height:1.2;padding:0 4px;";
      const bubble = this.el(doc, "div", isUser ? "za-chat-bubble za-chat-bubble-user" : (isProcess ? "za-chat-bubble za-chat-bubble-process" : "za-chat-bubble za-chat-bubble-ai"), "");
      bubble.style.cssText = isUser
        ? "max-width:100%;border-radius:10px;border-bottom-right-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#95ec69;color:#111827;box-shadow:0 1px 2px rgba(0,0,0,0.06);"
        : isProcess
          ? "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:8px 10px;font-size:11px;line-height:1.45;background:#f1f5f9;color:#64748b;border:1px dashed #cbd5e1;box-shadow:none;"
          : "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#ffffff;color:#111827;border:1px solid #e2e5ea;box-shadow:0 1px 2px rgba(0,0,0,0.06);";
      this.fillChatBubbleContent(bubble, entry.text, isUser && !isProcess);"""

if old_bubble in t:
    t = t.replace(old_bubble, new_bubble, 1)

# approval pending - flush partial turn so user sees progress
old_approval_return = """          this.log("approval.requested", this.task.pendingApproval);
          this.renderAll();
          return;"""

new_approval_return = """          this.log("approval.requested", this.task.pendingApproval);
          this.flushChatTurnToDisplay();
          this.renderAll();
          return;"""

if old_approval_return in t:
    t = t.replace(old_approval_return, new_approval_return, 1)

p.write_text(t, encoding="utf-8")
print("done")