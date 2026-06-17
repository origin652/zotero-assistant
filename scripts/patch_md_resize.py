from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "chrome/content/zotero-assistant.js"
t = p.read_text(encoding="utf-8")

# constants
if "CHAT_MIN_WIDTH" not in t:
    t = t.replace(
        "  const CHAT_MINIMIZED_HEIGHT = 52;\n",
        "  const CHAT_MINIMIZED_HEIGHT = 52;\n"
        "  const CHAT_MIN_WIDTH = 300;\n"
        "  const CHAT_MIN_HEIGHT = 280;\n"
        "  const CHAT_DEFAULT_WIDTH = 420;\n"
        "  const CHAT_DEFAULT_HEIGHT = 560;\n",
        1,
    )

# clampChatBounds min sizes
t = t.replace(
    "      const width = Math.min(Math.max(Number(bounds.width || 420), 320), Math.max(320, viewportWidth - 32));\n"
    "      const height = Math.min(Math.max(Number(bounds.height || 560), 220), Math.max(220, viewportHeight - 32));\n",
    "      const maxW = Math.max(CHAT_MIN_WIDTH, viewportWidth - 32);\n"
    "      const maxH = Math.max(CHAT_MIN_HEIGHT, viewportHeight - 32);\n"
    "      const width = Math.min(Math.max(Number(bounds.width || CHAT_DEFAULT_WIDTH), CHAT_MIN_WIDTH), maxW);\n"
    "      const height = Math.min(Math.max(Number(bounds.height || CHAT_DEFAULT_HEIGHT), CHAT_MIN_HEIGHT), maxH);\n",
    1,
)

t = t.replace(
    "      const width = 420;\n      const height = 560;\n",
    "      const width = CHAT_DEFAULT_WIDTH;\n      const height = CHAT_DEFAULT_HEIGHT;\n",
    1,
)

# STYLE_REV bump
t = t.replace('const STYLE_REV = "za-chat-ui-20260617";', 'const STYLE_REV = "za-chat-ui-md-resize-20260617";', 1)

# Add markdown bubble CSS before za-chat-notice
marker = "#zotero-assistant-chat-panel .za-chat-notice,"
insert_css = """#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown {
  font-size: 13px;
  line-height: 1.5;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown p {
  margin: 0 0 6px 0 !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown p:last-child {
  margin-bottom: 0 !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown pre {
  margin: 0 0 6px 0 !important;
  background: #0f172a !important;
  color: #e2e8f0 !important;
  border-radius: 8px !important;
  padding: 8px 10px !important;
  font-size: 11px !important;
  overflow-x: auto !important;
  max-width: 100% !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown code {
  background: rgba(15, 23, 42, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown ul,
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown ol {
  margin: 0 0 6px 0 !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown a {
  color: #2563eb;
  font-weight: 600;
}
#zotero-assistant-chat-panel .za-chat-resize-handle {
  position: absolute !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 18px !important;
  height: 18px !important;
  cursor: nwse-resize !important;
  z-index: 6 !important;
  background: linear-gradient(135deg, transparent 50%, rgba(100,116,139,0.35) 50%) !important;
  border-bottom-right-radius: 12px !important;
}
"""
if insert_css.strip() not in t and marker in t:
    t = t.replace(marker, insert_css + marker, 1)

# panel position relative for resize handle
old_panel_inline = '"overflow:hidden"\n      ].join(";");'
new_panel_inline = '"overflow:hidden",\n        "position:absolute"\n      ].join(";");'
if old_panel_inline in t and '"position:absolute"' not in t.split("panel.style.cssText = [")[1].split("].join")[0]:
    pass
# ensure panel has position relative in create - add to cssText array
old_arr = """        "overflow:hidden"
      ].join(";");
      panel.style.setProperty("display", "none", "important");"""
new_arr = """        "overflow:hidden",
        "position:absolute"
      ].join(";");
      panel.style.setProperty("display", "none", "important");
      panel.style.setProperty("position", "absolute", "important");"""
if old_arr in t:
    t = t.replace(old_arr, new_arr, 1)

# append resize handle + handler call
old_append = """      panel.appendChild(header);
      panel.appendChild(messages);
      panel.appendChild(approval);
      panel.appendChild(footer);
      this.ensureUiOverlayRoot(state).appendChild(panel);"""

new_append = """      const resizeHandle = this.el(doc, "div", "za-chat-resize-handle", "");
      resizeHandle.setAttribute("aria-label", "拖动调节聊天窗大小");
      resizeHandle.title = "拖动调节大小";
      panel.appendChild(header);
      panel.appendChild(messages);
      panel.appendChild(approval);
      panel.appendChild(footer);
      panel.appendChild(resizeHandle);
      this.attachChatResizeHandlers(state, resizeHandle);
      this.ensureUiOverlayRoot(state).appendChild(panel);"""

if old_append in t:
    t = t.replace(old_append, new_append, 1)

# attachChatResizeHandlers after attachChatDragHandlers block
old_after_drag = """        state.win.addEventListener("mousemove", onMove, true);
        state.win.addEventListener("mouseup", onUp, true);
      });
    }

    createLauncher(win, state) {"""

new_after_drag = """        state.win.addEventListener("mousemove", onMove, true);
        state.win.addEventListener("mouseup", onUp, true);
      });
    }

    attachChatResizeHandlers(state, handle) {
      if (!handle) {
        return;
      }
      handle.addEventListener("mousedown", (event) => {
        if (event.button !== 0 || state.chatMinimized) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const bounds = state.chatBounds || this.defaultChatBounds(state);
        state.chatResizing = {
          startX: event.clientX,
          startY: event.clientY,
          width: bounds.width,
          height: bounds.height,
          left: bounds.left,
          top: bounds.top
        };
        const onMove = (moveEvent) => {
          if (!state.chatResizing) {
            return;
          }
          const dx = moveEvent.clientX - state.chatResizing.startX;
          const dy = moveEvent.clientY - state.chatResizing.startY;
          state.chatBounds = this.clampChatBounds(state, {
            left: state.chatResizing.left,
            top: state.chatResizing.top,
            width: state.chatResizing.width + dx,
            height: state.chatResizing.height + dy
          });
          this.applyChatBounds(state);
        };
        const onUp = () => {
          state.chatResizing = null;
          state.win.removeEventListener("mousemove", onMove, true);
          state.win.removeEventListener("mouseup", onUp, true);
        };
        state.win.addEventListener("mousemove", onMove, true);
        state.win.addEventListener("mouseup", onUp, true);
      });
    }

    looksLikeMarkdown(text) {
      const source = String(text || "");
      if (!source.trim()) {
        return false;
      }
      return /```|(^|\\n)\\s*#{1,6}\\s|(^|\\n)\\s*[-*]\\s|(^|\\n)\\s*\\d+\\.\\s|\\*\\*|__|\\[.+?\\]\\(https?:\\/\\//m.test(source);
    }

    fillChatBubbleContent(bubble, text, isUser) {
      const body = String(text || "");
      const useMd = !isUser || this.looksLikeMarkdown(body);
      const content = this.el(bubble.ownerDocument, "div", useMd ? "za-chat-bubble-text za-markdown" : "za-chat-bubble-text", "");
      if (useMd) {
        content.style.whiteSpace = "normal";
        this.renderMarkdownInto(content, body);
      } else {
        content.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;";
        content.textContent = body;
      }
      bubble.appendChild(content);
    }

    createLauncher(win, state) {"""

if "attachChatResizeHandlers(state, handle)" not in t:
    if old_after_drag not in t:
        raise SystemExit("drag block not found")
    t = t.replace(old_after_drag, new_after_drag, 1)

# createChatBubbleRow use fillChatBubbleContent
old_bubble_text = """      const bubble = this.el(doc, "div", isUser ? "za-chat-bubble za-chat-bubble-user" : "za-chat-bubble za-chat-bubble-ai", "");
      bubble.style.cssText = isUser
        ? "max-width:100%;border-radius:10px;border-bottom-right-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#95ec69;color:#111827;box-shadow:0 1px 2px rgba(0,0,0,0.06);"
        : "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#ffffff;color:#111827;border:1px solid #e2e5ea;box-shadow:0 1px 2px rgba(0,0,0,0.06);";
      const text = this.el(doc, "div", "za-chat-bubble-text", entry.text);
      bubble.appendChild(text);"""

new_bubble_text = """      const bubble = this.el(doc, "div", isUser ? "za-chat-bubble za-chat-bubble-user" : "za-chat-bubble za-chat-bubble-ai", "");
      bubble.style.cssText = isUser
        ? "max-width:100%;border-radius:10px;border-bottom-right-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#95ec69;color:#111827;box-shadow:0 1px 2px rgba(0,0,0,0.06);"
        : "max-width:100%;border-radius:10px;border-bottom-left-radius:3px;padding:9px 12px;font-size:13px;line-height:1.5;background:#ffffff;color:#111827;border:1px solid #e2e5ea;box-shadow:0 1px 2px rgba(0,0,0,0.06);";
      this.fillChatBubbleContent(bubble, entry.text, isUser);"""

if old_bubble_text in t:
    t = t.replace(old_bubble_text, new_bubble_text, 1)

# hide resize handle when minimized
old_min = """      if (state.chatMinimized) {
        return;
      }
      const body = state.chatMessagesNode;"""
new_min = """      const resizeEl = state.chatPanel && state.chatPanel.querySelector(".za-chat-resize-handle");
      if (resizeEl) {
        resizeEl.style.setProperty("display", state.chatMinimized ? "none" : "block", "important");
      }
      if (state.chatMinimized) {
        return;
      }
      const body = state.chatMessagesNode;"""

if "resizeEl" not in t and old_min in t:
    t = t.replace(old_min, new_min, 1)

# state chatResizing in addToWindow - optional, can be undefined

p.write_text(t, encoding="utf-8")
print("done")