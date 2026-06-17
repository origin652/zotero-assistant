from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "chrome/content/zotero-assistant.js"
t = p.read_text(encoding="utf-8")

old_begin = """    beginChatTurnUser(text) {
      this.flushChatTurnToDisplay();
      this.chatTurnPending = {
        userText: String(text || "").trim(),
        aiReadable: [],
        process: []
      };
    }"""

new_begin = """    beginChatTurnUser(text) {
      this.flushChatTurnToDisplay();
      const userText = String(text || "").trim();
      if (userText) {
        this.appendChatDisplay("user", userText);
      }
      this.chatTurnPending = {
        userText: "",
        aiReadable: [],
        process: []
      };
    }"""

if old_begin not in t:
    raise SystemExit("beginChatTurnUser not found")
t = t.replace(old_begin, new_begin, 1)

old_flush = """    flushChatTurnToDisplay() {
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
      if (readable.length) {"""

new_flush = """    flushChatTurnToDisplay() {
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
      if (readable.length) {"""

if old_flush not in t:
    raise SystemExit("flushChatTurnToDisplay not found")
t = t.replace(old_flush, new_flush, 1)

old_send = """    async sendChatInput(state) {
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

new_send = """    async sendChatInput(state) {
      const text = (state && state.chatInputNode && state.chatInputNode.value || "").trim();
      if (!text) {
        return;
      }
      if (state.chatInputNode) {
        state.chatInputNode.value = "";
      }
      state.chatNotice = "";
      this.showChatPanel(state);
      await this.startTaskFromText(state, text);
      this.renderAll();
      if (state && state.chatOpen) {
        this.renderChatPanel(state);
      }
    }"""

if old_send not in t:
    raise SystemExit("sendChatInput not found")
t = t.replace(old_send, new_send, 1)

t = t.replace(
    """        this.log("task.user_reply", { id: this.task.id, content: taskText });
        this.renderAll();
        await this.runTaskLoop();""",
    """        this.log("task.user_reply", { id: this.task.id, content: taskText });
        this.renderAll();
        if (state && state.chatOpen) {
          this.renderChatPanel(state);
        }
        await this.runTaskLoop();
        this.flushChatTurnToDisplay();
        this.renderAll();
        if (state && state.chatOpen) {
          this.renderChatPanel(state);
        }""",
    1,
)

t = t.replace(
    """      this.log("task.started", { id: this.task.id, prompt: taskText, libraryID, libraryName });
      this.renderAll();
      await this.runTaskLoop();
      return true;""",
    """      this.log("task.started", { id: this.task.id, prompt: taskText, libraryID, libraryName });
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
      return true;""",
    1,
)

old_hmr_end = """      if (this.task && this.task.status === "running") {
        this.renderAll();
      }
    }

    async handlePlainAssistantMessage(content) {"""

new_hmr_end = """      if (this.task && this.task.status === "running") {
        this.renderAll();
      } else if (this.task && (this.task.status === "waiting" || this.task.status === "complete")) {
        this.flushChatTurnToDisplay();
        this.renderAll();
      }
    }

    async handlePlainAssistantMessage(content) {"""

if old_hmr_end in t:
    t = t.replace(old_hmr_end, new_hmr_end, 1)

t = t.replace(
    """      for (const win of this.getMainWindows()) {
        this.addToWindow(win);
      }
      this.log("plugin.started", { version: this.version });""",
    """      if (!this.chatTurnPending) {
        this.resetChatTurnPending();
      }
      if (!Array.isArray(this.chatDisplayLog)) {
        this.chatDisplayLog = [];
      }
      for (const win of this.getMainWindows()) {
        this.addToWindow(win);
      }
      this.log("plugin.started", { version: this.version });""",
    1,
)

old_backfill = """        if (message.role === "user") {
          this.beginChatTurnUser(this.normalizeTextContent(message.content));
        } else if (message.role === "assistant") {"""

new_backfill = """        if (message.role === "user") {
          const ut = this.normalizeTextContent(message.content);
          if (ut) {
            this.appendChatDisplay("user", ut);
          }
          this.chatTurnPending = { userText: "", aiReadable: [], process: [] };
        } else if (message.role === "assistant") {"""

if old_backfill in t:
    t = t.replace(old_backfill, new_backfill, 1)

p.write_text(t, encoding="utf-8")
print("done")