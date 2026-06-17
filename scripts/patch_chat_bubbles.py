from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "chrome/content/zotero-assistant.js"
t = p.read_text(encoding="utf-8")

def sp(n):
    return " " * n

old_panel = """#zotero-assistant-chat-panel {
  position: fixed !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  border: 1px solid rgba(15, 23, 42, 0.12) !important;
  border-radius: 16px !important;
  background: rgba(255, 255, 255, 0.98) !important;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18) !important;
  overflow: hidden !important;
  z-index: 10006 !important;
  pointer-events: auto !important;
  backdrop-filter: blur(10px);
}"""

new_panel = """#zotero-assistant-chat-panel {
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
}"""

if old_panel not in t:
    raise SystemExit("panel block not found")
t = t.replace(old_panel, new_panel, 1)

t = t.replace(
    "  background: rgba(248, 250, 252, 0.96) !important;\n  cursor: move !important;",
    "  background: #f0f2f5 !important;\n  cursor: move !important;",
    1,
)

old_msgs = """#zotero-assistant-chat-panel .za-floating-chat-messages {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  padding: 12px !important;
  overflow-y: auto !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
}"""

new_msgs = """#zotero-assistant-chat-panel .za-floating-chat-messages {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  padding: 14px 12px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  background: #e9ebef !important;
}"""

if old_msgs not in t:
    raise SystemExit("messages block not found")
t = t.replace(old_msgs, new_msgs, 1)

old_bubbles = """#zotero-assistant-chat-panel .za-chat-message {
  max-width: 88% !important;
  border-radius: 14px !important;
  padding: 8px 10px !important;
  font-size: 12px !important;
  line-height: 1.48 !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
}
#zotero-assistant-chat-panel .za-chat-user {
  align-self: flex-end !important;
  background: #c45c26 !important;
  color: #ffffff !important;
  border-bottom-right-radius: 5px !important;
}
#zotero-assistant-chat-panel .za-chat-ai {
  align-self: flex-start !important;
  background: #f1f5f9 !important;
  color: #0f172a !important;
  border: 1px solid rgba(15, 23, 42, 0.07) !important;
  border-bottom-left-radius: 5px !important;
}
#zotero-assistant-chat-panel .za-chat-meta {
  font-size: 10px !important;
  font-weight: 700 !important;
  opacity: 0.72 !important;
  margin-bottom: 3px !important;
}"""

new_bubbles = """#zotero-assistant-chat-panel .za-chat-row {
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
#zotero-assistant-chat-panel .za-chat-bubble-ai {
  background: #ffffff !important;
  color: #111827 !important;
  border: 1px solid #e2e5ea !important;
  border-bottom-left-radius: 3px !important;
}"""

if old_bubbles not in t:
    raise SystemExit("bubbles block not found")
t = t.replace(old_bubbles, new_bubbles, 1)

t = t.replace(
    "  background: rgba(255, 251, 235, 0.96) !important;",
    "  background: #fffbeb !important;",
    1,
)

old_render = """        for (const entry of transcript) {
          const bubble = this.el(state.doc, "div", `za-chat-message ${entry.speaker === "user" ? "za-chat-user" : "za-chat-ai"}`, "");
          const meta = this.el(state.doc, "div", "za-chat-meta", entry.label);
          const text = this.el(state.doc, "div", "", entry.text);
          bubble.appendChild(meta);
          bubble.appendChild(text);
          body.appendChild(bubble);
        }"""

new_render = """        for (const entry of transcript) {
          body.appendChild(this.createChatBubbleRow(state.doc, entry));
        }"""

if old_render not in t:
    raise SystemExit("render loop not found")
t = t.replace(old_render, new_render, 1)

insert_before = "    renderChatApprovalCard(state) {"
helper = """    createChatBubbleRow(doc, entry) {
      const isUser = entry.speaker === "user";
      const row = this.el(doc, "div", isUser ? "za-chat-row za-chat-row-user" : "za-chat-row za-chat-row-ai", "");
      const avatar = this.el(doc, "div", isUser ? "za-chat-avatar za-chat-avatar-user" : "za-chat-avatar za-chat-avatar-ai", isUser ? "我" : "AI");
      const stack = this.el(doc, "div", "za-chat-stack", "");
      const name = this.el(doc, "div", "za-chat-name", entry.label || (isUser ? "你" : "AI"));
      const bubble = this.el(doc, "div", isUser ? "za-chat-bubble za-chat-bubble-user" : "za-chat-bubble za-chat-bubble-ai", "");
      const text = this.el(doc, "div", "za-chat-bubble-text", entry.text);
      bubble.appendChild(text);
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

"""

if "createChatBubbleRow(doc, entry)" not in t:
    if insert_before not in t:
        raise SystemExit("insert anchor not found")
    t = t.replace(insert_before, helper + insert_before, 1)

p.write_text(t, encoding="utf-8")
print("done")