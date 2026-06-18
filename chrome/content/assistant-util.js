var ZoteroAssistantUtil = (() => {
  function safeCall(fn) {
    try {
      const value = fn();
      return value == null ? "" : value;
    } catch (error) {
      return "";
    }
  }

  function stripHTML(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncateText(value, limit) {
    const text = stripHTML(value);
    if (!text || !limit || text.length <= limit) {
      return text;
    }
    return text.slice(0, limit) + "...";
  }

  function safeJSONStringify(value, limit = DEBUG_TEXT_LIMIT) {
    try {
      const seen = new WeakSet();
      const text = JSON.stringify(value, (key, current) => {
        if (typeof current === "function") {
          return "[Function]";
        }
        if (current instanceof Set) {
          return Array.from(current);
        }
        if (current instanceof Map) {
          return Array.from(current.entries());
        }
        if (current && typeof current === "object") {
          if (seen.has(current)) {
            return "[Circular]";
          }
          seen.add(current);
        }
        return current;
      }, 2);
      return truncateText(text || "", limit);
    } catch (error) {
      return truncateText(String(value), limit);
    }
  }

  function mapCountsToSortedPairs(map) {
    return Array.from(map.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) {
          return b[1] - a[1];
        }
        return String(a[0]).localeCompare(String(b[0]), "zh-Hans-CN");
      })
      .map(([name, count]) => ({ name, count }));
  }

  function extractYear(value) {
    const match = String(value || "").match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
    return match ? match[1] : "";
  }

  function isAttachmentItem(item) {
    if (!item) {
      return false;
    }
    if (typeof item.isAttachment === "function") {
      return !!item.isAttachment();
    }
    return item.itemType === "attachment";
  }

  function normalizeFulltextContent(content) {
    if (typeof content === "string") {
      return content;
    }
    if (content && typeof content.content === "string") {
      return content.content;
    }
    if (content && typeof content.text === "string") {
      return content.text;
    }
    return "";
  }

  function parseMarkdownBlocks(markdown) {
    const source = String(markdown || "").replace(/\r\n/g, "\n").trim();
    if (!source) {
      return [];
    }
    const lines = source.split("\n");
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }
      if (line.trim().startsWith("```")) {
        i++;
        const codeLines = [];
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          i++;
        }
        blocks.push({ type: "code", text: codeLines.join("\n") });
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
          i++;
        }
        blocks.push({ type: "ul", items });
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
          i++;
        }
        blocks.push({ type: "ol", items });
        continue;
      }
      if (/^\s*#{1,6}\s+/.test(line)) {
        const level = Math.min((line.match(/^(\s*#+)/) || ["#"])[0].replace(/\s/g, "").length, 6);
        blocks.push({
          type: "heading",
          level,
          text: line.replace(/^\s*#{1,6}\s+/, "")
        });
        i++;
        continue;
      }
      const paragraph = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^\s*#{1,6}\s+/.test(lines[i]) && !lines[i].trim().startsWith("```")) {
        paragraph.push(lines[i]);
        i++;
      }
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    }

    return blocks;
  }

  function tokenizeInlineMarkdown(text) {
    const source = String(text || "");
    const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    const tokens = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(source))) {
      if (match.index > lastIndex) {
        tokens.push({ type: "text", text: source.slice(lastIndex, match.index) });
      }
      if (match[1] && match[2]) {
        tokens.push({ type: "link", text: match[1], href: match[2] });
      } else if (match[3]) {
        tokens.push({ type: "code", text: match[3] });
      } else if (match[4]) {
        tokens.push({ type: "strong", text: match[4] });
      } else if (match[5]) {
        tokens.push({ type: "em", text: match[5] });
      }
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < source.length) {
      tokens.push({ type: "text", text: source.slice(lastIndex) });
    }

    return tokens.length ? tokens : [{ type: "text", text: source }];
  }

  return {
    safeCall, stripHTML, truncateText, safeJSONStringify, mapCountsToSortedPairs, extractYear, isAttachmentItem, normalizeFulltextContent, parseMarkdownBlocks, tokenizeInlineMarkdown
  };
})();
