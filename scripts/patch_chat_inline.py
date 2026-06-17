from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "chrome/content/zotero-assistant.js"
t = p.read_text(encoding="utf-8")

# Fix broken shared CSS that still breaks chat launcher/panel layout
old_shared = """#zotero-assistant-sidebar,
#zotero-assistant-chat-panel,
#zotero-assistant-chat-launcher {
  flex-direction: column;
  min-width: 0;
  --za-bg: #f4f6f9;
  --za-surface: #ffffff;
  --za-surface-muted: #f8fafc;
  --za-border: rgba(15, 23, 42, 0.10);
  --za-border-strong: rgba(15, 23, 42, 0.14);
  --za-text: #0f172a;
  --za-text-muted: #64748b;
  --za-accent: #c45c26;
  --za-accent-hover: #a84d1f;
  --za-accent-soft: rgba(196, 92, 38, 0.12);
  --za-radius: 12px;
  --za-radius-sm: 8px;
  --za-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08);
  --za-font: system-ui, "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif;
  font-family: var(--za-font) !important;
  background: var(--za-bg) !important;
  color: var(--za-text) !important;
}
#zotero-assistant-sidebar {
  border-left-color: var(--za-border-strong) !important;
  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.10) !important;
}"""

new_shared = """#zotero-assistant-ui-root,
#zotero-assistant-ui-root * {
  box-sizing: border-box;
}
#zotero-assistant-ui-root {
  --za-bg: #f4f6f9;
  --za-surface: #ffffff;
  --za-surface-muted: #f8fafc;
  --za-border: rgba(15, 23, 42, 0.10);
  --za-border-strong: rgba(15, 23, 42, 0.14);
  --za-text: #0f172a;
  --za-text-muted: #64748b;
  --za-accent: #c45c26;
  --za-accent-hover: #a84d1f;
  --za-accent-soft: rgba(196, 92, 38, 0.12);
  --za-radius: 12px;
  --za-radius-sm: 8px;
  --za-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08);
  --za-font: system-ui, "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif;
}
#zotero-assistant-sidebar {
  display: flex !important;
  flex-direction: column !important;
  min-width: 0 !important;
  font-family: var(--za-font) !important;
  background: var(--za-bg) !important;
  color: var(--za-text) !important;
  border-left: 1px solid var(--za-border-strong) !important;
  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.10) !important;
}"""

if old_shared in t:
    t = t.replace(old_shared, new_shared, 1)
    print("fixed shared css")
else:
    print("shared css already fixed or missing")

# ensureGlobalStyles: always refresh stylesheet
old_ensure = """    ensureGlobalStyles(doc) {
      if (doc.getElementById("zotero-assistant-global-styles")) {
        return;
      }
      const style = this.html(doc, "style");
      style.id = "zotero-assistant-global-styles";"""

new_ensure = """    ensureGlobalStyles(doc) {
      const STYLE_ID = "zotero-assistant-global-styles";
      const STYLE_REV = "za-chat-ui-20260617";
      const existing = doc.getElementById(STYLE_ID);
      if (existing && existing.getAttribute("data-za-rev") === STYLE_REV) {
        return;
      }
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      const style = this.html(doc, "style");
      style.id = STYLE_ID;
      style.setAttribute("data-za-rev", STYLE_REV);"""

if old_ensure not in t:
    raise SystemExit("ensureGlobalStyles block not found")
t = t.replace(old_ensure, new_ensure, 1)

# createChatPanel inline chrome
old_panel_style = """      panel.style.cssText = [
        "display:none",
        "position:absolute",
        "margin:0",
        "padding:0",
        "box-sizing:border-box",
        "flex-direction:column",
        "pointer-events:auto",
        "z-index:5",
        "min-width:0",
        "min-height:0"
      ].join(";");
      panel.style.setProperty("display", "none", "important");

      const header = this.el(doc, "div", "za-floating-chat-header", "");"""

new_panel_style = """      panel.style.cssText = [
        "display:none",
        "position:absolute",
        "margin:0",
        "padding:0",
        "box-sizing:border-box",
        "flex-direction:column",
        "pointer-events:auto",
        "z-index:5",
        "min-width:0",
        "min-height:0",
        "background:#ffffff",
        "border:1px solid #d8dde6",
        "border-radius:12px",
        "box-shadow:0 12px 40px rgba(15,23,42,0.16)",
        "overflow:hidden"
      ].join(";");
      panel.style.setProperty("display", "none", "important");

      const header = this.el(doc, "div", "za-floating-chat-header", "");
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid #e2e5ea;background:#f0f2f5;flex:0 0 auto;cursor:move;";"""

if old_panel_style not in t:
    raise SystemExit("panel style block not found")
t = t.replace(old_panel_style, new_panel_style, 1)

old_msgs_create = """      const messages = this.el(doc, "div", "za-floating-chat-messages", "");
      const approval = this.el(doc, "div", "za-floating-chat-approval", "");
      const footer = this.el(doc, "div", "za-floating-chat-footer", "");"""

new_msgs_create = """      const messages = this.el(doc, "div", "za-floating-chat-messages", "");
      messages.style.cssText = "flex:1 1 auto;min-height:0;padding:14px 12px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:14px;background:#e9ebef;";
      const approval = this.el(doc, "div", "za-floating-chat-approval", "");
      const footer = this.el(doc, "div", "za-floating-chat-footer", "");
      footer.style.cssText = "flex:0 0 auto;display:flex;gap:8px;align-items:flex-end;padding:10px 12px 12px;border-top:1px solid #e2e5ea;background:#ffffff;";"""

if old_msgs_create not in t:
    raise SystemExit("messages create block not found")
t = t.replace(old_msgs_create, new_msgs_create, 1)

# renderChatPanel apply chrome when open
old_render_open = """      state.chatPanel.style.setProperty("display", "flex", "important");
      if (state.chatLauncher) {
        state.chatLauncher.style.setProperty("display", "none", "important");
      }
      this.applyChatBounds(state);"""

new_render_open = """      state.chatPanel.style.setProperty("display", "flex", "important");
      state.chatPanel.style.setProperty("background", "#ffffff", "important");
      state.chatPanel.style.setProperty("opacity", "1", "important");
      if (state.chatMessagesNode) {
        state.chatMessagesNode.style.setProperty("background", "#e9ebef", "important");
        state.chatMessagesNode.style.setProperty("display", state.chatMinimized ? "none" : "flex", "important");
        state.chatMessagesNode.style.setProperty("flex-direction", "column", "important");
      }
      if (state.chatFooterNode) {
        state.chatFooterNode.style.setProperty("background", "#ffffff", "important");
      }
      if (state.chatHeaderNode) {
        state.chatHeaderNode.style.setProperty("background", "#f0f2f5", "important");
      }
      if (state.chatLauncher) {
        state.chatLauncher.style.setProperty("display", "none", "important");
      }
      this.applyChatBounds(state);"""

if old_render_open not in t:
    raise SystemExit("render open block not found")
t = t.replace(old_render_open, new_render_open, 1)

# Remove duplicate messages display set if we now set it earlier - check render still has:
# state.chatMessagesNode.style.setProperty("display"...
# We set display in new block with minimized - need to remove later duplicate line
t = t.replace(
    """      state.chatMessagesNode.style.setProperty("display", state.chatMinimized ? "none" : "flex", "important");
      if (state.chatApprovalNode) {""",
    """      if (state.chatApprovalNode) {""",
    1,
)

# createChatBubbleRow with inline styles
old_bubble_fn = """    createChatBubbleRow(doc, entry) {
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
    }"""

new_bubble_fn = """    createChatBubbleRow(doc, entry) {
      const isUser = entry.speaker === "user";
      const row = this.el(doc, "div", isUser ? "za-chat-row za-chat-row-user" : "za-chat-row za-chat-row-ai", "");
      row.style.cssText = isUser
        ? "display:flex;flex-direction:row;align-items:flex-start;justify-content:flex-end;gap:8px;width:100%;box-sizing:border-box;"
        : "display:flex;flex-direction:row;align-items:flex-start;justify-content:flex-start;gap:8px;width:100%;box-sizing:border-box;";
      const avatar = this.el(doc, "div", isUser ? "za-chat-avatar za-chat-avatar-user" : "za-chat-avatar za-chat-avatar-ai", isUser ? "我" : "AI");
      avatar.style.cssText = isUser
        ? "flex:0 0 36px;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:#c45c26;color:#fff;"
        : "flex:0 0 36px;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:#4a90d9;color:#fff;";
      const stack = this.el(doc, "div", "za-chat-stack", "");
      stack.style.cssText = isUser
        ? "display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:0;max-width:calc(100% - 52px);"
        : "display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0;max-width:calc(100% - 52px);";
      const name = this.el(doc, "div", "za-chat-name", entry.label || (isUser ? "你" : "AI"));
      name.style.cssText = "font-size:11px;font-weight:600;color:#8a8f99;line-height:1.2;padding:0 4px;";
      const bubble = this.el(doc, "div", isUser ? "za-chat-bubble za-chat-bubble-user" : "za-chat-bubble za-chat-bubble-ai", "");
      bubble.style.cssText = isUser
        ? "max-width:100%;border-radius:10px;border-bottom-right-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#95ec69;color:#111827;box-shadow:0 1px 2px rgba(0,0,0,0.06);"
        : "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#ffffff;color:#111827;border:1px solid #e2e5ea;box-shadow:0 1px 2px rgba(0,0,0,0.06);";
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
    }"""

if old_bubble_fn not in t:
    raise SystemExit("bubble fn not found")
t = t.replace(old_bubble_fn, new_bubble_fn, 1)

p.write_text(t, encoding="utf-8")
print("done")