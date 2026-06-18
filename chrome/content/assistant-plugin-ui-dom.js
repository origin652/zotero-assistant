var ZoteroAssistantPluginUiDom = (() => {
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
  el(doc, tag, className, text) {
    const node = this.html(doc, tag);
    if (className) {
      node.className = className;
    }
    if (text) {
      node.textContent = text;
    }
    return node;
  },

  html(doc, tag) {
    return doc.createElementNS(HTML_NS, tag);
  },

  panel(doc, title) {
    const panel = this.el(doc, "section", "zotero-assistant-panel", "");
    const header = this.el(doc, "div", "za-panel-header", title);
    const body = this.el(doc, "div", "zotero-assistant-panel-body", "");
    panel.appendChild(header);
    panel.appendChild(body);
    return panel;
  },

  createToast(doc, options = {}) {
    const palette = this.toastPalette(options.tone);
    const toast = this.html(doc, "div");
    toast.style.cssText = [
      "pointer-events:auto",
      "display:flex",
      "flex-direction:column",
      "gap:8px",
      "min-width:220px",
      `max-width:${options.wide ? "100%" : "320px"}`,
      "padding:10px 12px",
      "border-radius:16px",
      `background:${palette.background}`,
      `border:1px solid ${palette.border}`,
      `box-shadow:${palette.shadow}`,
      "backdrop-filter:blur(10px)",
      "overflow:hidden"
    ].join(";");

    const accent = this.html(doc, "div");
    accent.style.cssText = `height:3px;background:${palette.accent};margin:-10px -12px 0 -12px;`;
    toast.appendChild(accent);

    const header = this.html(doc, "div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;";
    const titleWrap = this.html(doc, "div");
    titleWrap.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;";

    if (options.badge) {
      const badge = this.html(doc, "span");
      badge.textContent = options.badge;
      badge.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "padding:2px 8px",
        "border-radius:999px",
        "font-size:11px",
        "font-weight:700",
        `background:${palette.accent}`,
        "color:#fff",
        "flex:0 0 auto"
      ].join(";");
      titleWrap.appendChild(badge);
    }

    if (options.title) {
      const title = this.html(doc, "div");
      title.textContent = options.title;
      title.style.cssText = "font-weight:700;line-height:1.35;min-width:0;";
      titleWrap.appendChild(title);
    }
    header.appendChild(titleWrap);

    if (options.meta) {
      const meta = this.html(doc, "div");
      meta.textContent = options.meta;
      meta.style.cssText = "font-size:11px;opacity:0.72;white-space:nowrap;flex:0 0 auto;";
      header.appendChild(meta);
    }
    toast.appendChild(header);

    if (options.detail) {
      const detail = this.html(doc, "div");
      detail.textContent = options.detail;
      detail.style.cssText = "white-space:pre-wrap;line-height:1.45;";
      toast.appendChild(detail);
    }

    if (options.node) {
      toast.appendChild(options.node);
    }

    return toast;
  },

  toastButton(doc, label, kind, onClick) {
    const variant = kind === "primary" ? "primary" : "secondary";
    const button = this.actionButton(doc, label, variant, onClick);
    if (kind === "primary") {
      button.style.boxShadow = "0 4px 14px rgba(196, 92, 38, 0.28)";
    }
    if (kind === "danger") {
      this.applyButtonInlineStyle(button, "secondary");
      button.style.color = "#b91c1c";
      button.style.borderColor = "rgba(239,68,68,0.28)";
      button.style.background = "rgba(254,242,242,0.96)";
    }
    return button;
  },

  animateToast(node, key) {
    if (!node || !node.animate || !key || this.shownToastKeys.has(key)) {
      return;
    }
    this.shownToastKeys.add(key);
    node.animate([
      { opacity: 0, transform: "translateY(10px) scale(0.98)" },
      { opacity: 1, transform: "translateY(0) scale(1)" }
    ], {
      duration: 180,
      easing: "ease-out"
    });
  },

  toastPalette(tone) {
    const palettes = {
      info: {
        background: "rgba(255, 255, 255, 0.96)",
        border: "rgba(59, 130, 246, 0.26)",
        accent: "#2563eb",
        shadow: "0 16px 34px rgba(37, 99, 235, 0.18)"
      },
      success: {
        background: "rgba(255, 255, 255, 0.96)",
        border: "rgba(34, 197, 94, 0.24)",
        accent: "#16a34a",
        shadow: "0 16px 34px rgba(22, 163, 74, 0.16)"
      },
      warning: {
        background: "rgba(255, 251, 235, 0.98)",
        border: "rgba(245, 158, 11, 0.34)",
        accent: "#d97706",
        shadow: "0 16px 34px rgba(245, 158, 11, 0.18)"
      },
      danger: {
        background: "rgba(255, 250, 250, 0.98)",
        border: "rgba(239, 68, 68, 0.30)",
        accent: "#dc2626",
        shadow: "0 16px 34px rgba(220, 38, 38, 0.18)"
      },
      neutral: {
        background: "rgba(255, 255, 255, 0.96)",
        border: "rgba(148, 163, 184, 0.26)",
        accent: "#64748b",
        shadow: "0 14px 30px rgba(15, 23, 42, 0.12)"
      }
    };
    return palettes[tone] || palettes.neutral;
  },

  actionButton(doc, label, variant, onClick) {
    const button = this.html(doc, "button");
    button.type = "button";
    const text = String(label == null ? "" : label);
    button.textContent = text;
    button.setAttribute("aria-label", text);
    button.className = `za-btn za-btn-${variant || "secondary"}`;
    this.applyButtonInlineStyle(button, variant || "secondary");
    if (onClick) {
      button.addEventListener("click", onClick);
    }
    return button;
  },

  truncateText(value, limit = 180) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  },

  statusPillClass(status) {
    const map = {
      running: "za-pill-running",
      waiting: "za-pill-waiting",
      paused: "za-pill-paused",
      complete: "za-pill-complete"
    };
    return map[status] || "za-pill-idle";
  },

  looksLikeMarkdown(text) {
    const source = String(text || "");
    if (!source.trim()) {
      return false;
    }
    return /```|(^|\n)\s*#{1,6}\s|(^|\n)\s*[-*]\s|(^|\n)\s*\d+\.\s|\*\*|__|\[.+?\]\(https?:\/\//m.test(source);
  },

  renderMarkdownInto(container, markdown) {
    container.textContent = "";
    const blocks = parseMarkdownBlocks(markdown);
    for (const block of blocks) {
      let node;
      switch (block.type) {
        case "code":
          node = this.html(container.ownerDocument, "pre");
          const code = this.html(container.ownerDocument, "code");
          code.textContent = block.text;
          node.appendChild(code);
          break;
        case "ul":
        case "ol":
          node = this.html(container.ownerDocument, block.type);
          node.style.margin = "0 0 8px 18px";
          for (const itemText of block.items) {
            const li = this.html(container.ownerDocument, "li");
            li.style.marginBottom = "4px";
            this.appendInlineMarkdown(li, itemText);
            node.appendChild(li);
          }
          break;
        case "heading":
          node = this.html(container.ownerDocument, `h${block.level}`);
          node.style.cssText = "margin:0 0 8px 0;font-size:14px;";
          this.appendInlineMarkdown(node, block.text);
          break;
        default:
          node = this.html(container.ownerDocument, "p");
          node.style.margin = "0 0 8px 0";
          this.appendInlineMarkdown(node, block.text);
          break;
      }
      container.appendChild(node);
    }
  },

  appendInlineMarkdown(parent, text) {
    const doc = parent.ownerDocument;
    const lines = String(text || "").split("\n");
    lines.forEach((line, lineIndex) => {
      const tokens = tokenizeInlineMarkdown(line);
      for (const token of tokens) {
        if (token.type === "text") {
          parent.appendChild(doc.createTextNode(token.text));
          continue;
        }
        const node = this.html(doc, token.type === "link" ? "a" : token.type);
        if (token.type === "link") {
          node.setAttribute("href", token.href);
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noreferrer noopener");
        }
        if (token.type === "code") {
          node.style.fontFamily = "monospace";
        }
        node.textContent = token.text;
        parent.appendChild(node);
      }
      if (lineIndex < lines.length - 1) {
        parent.appendChild(this.html(doc, "br"));
      }
    });
  },

  fillChatBubbleContent(bubble, text, isUser, options = {}) {
    const body = String(text || "");
    const reasoning = String(options.reasoning || "").trim();
    if (reasoning) {
      const details = this.el(bubble.ownerDocument, "details", "za-chat-reasoning", "");
      const summary = this.el(bubble.ownerDocument, "summary", "za-chat-reasoning-summary", "思考过程");
      const reasoningBody = this.el(bubble.ownerDocument, "div", "za-chat-reasoning-body za-markdown", "");
      this.renderMarkdownInto(reasoningBody, reasoning);
      details.appendChild(summary);
      details.appendChild(reasoningBody);
      bubble.appendChild(details);
    }
    const useMd = !isUser || this.looksLikeMarkdown(body);
    const content = this.el(bubble.ownerDocument, "div", useMd ? "za-chat-bubble-text za-markdown" : "za-chat-bubble-text", "");
    if (useMd) {
      content.style.whiteSpace = "normal";
      content.style.userSelect = "text";
      this.renderMarkdownInto(content, body);
    } else {
      content.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;user-select:text;-moz-user-select:text;cursor:text;";
      content.textContent = body;
    }
    bubble.appendChild(content);
  },

  applyButtonInlineStyle(button, variant) {
    const base = [
      "font-family:system-ui,'Segoe UI','Microsoft YaHei UI','PingFang SC',sans-serif",
      "font-size:12px",
      "font-weight:600",
      "border-radius:999px",
      "padding:7px 14px",
      "cursor:pointer",
      "line-height:1.35",
      "min-height:32px",
      "-moz-appearance:none",
      "appearance:none",
      "display:inline-block",
      "box-sizing:border-box"
    ].join(";");
    const styles = {
      primary: `${base};background:#c45c26;color:#ffffff;border:1px solid #c45c26;`,
      secondary: `${base};background:#ffffff;color:#0f172a;border:1px solid rgba(15,23,42,0.14);`,
      ghost: `${base};background:#ffffff;color:#64748b;border:1px solid rgba(15,23,42,0.14);`
    };
    button.style.cssText = styles[variant] || styles.secondary;
  },

ensureGlobalStyles(doc) {
  const { STYLE_ID, STYLE_REV, getGlobalStylesText } = ZoteroAssistantStyles;
  const existing = doc.getElementById(STYLE_ID);
  if (existing && existing.getAttribute("data-za-rev") === STYLE_REV) {
    return;
  }
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  const style = this.html(doc, "style");
  style.id = STYLE_ID;
  style.setAttribute("data-za-rev", STYLE_REV);
  style.textContent = getGlobalStylesText();
  (doc.head || doc.documentElement).appendChild(style);
}
};
})();
