var ZoteroAssistantPluginLibrary = (() => {
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
    MAX_EXPORT_ITEMS,
    MAX_EXPORT_PER_MODEL_ROUND,
    MAX_EXPORT_TEXT_CHARS,
    MAX_BATCH_STEPS,
    MAX_BATCH_TOTAL_ITEMS,
    BATCH_ALLOWED_TOOLS,
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
    REQUEST_READ_APPROVAL_TOOL,
    SENSITIVE_READ_TOOLS,
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
  getLibrary(libraryID) {
    return Zotero.Libraries && Zotero.Libraries.get ? Zotero.Libraries.get(libraryID) : null;
  },

  isNoteItem(item) {
    return item && item.itemType === "note";
  },

  attachmentContentType(item) {
    return String(item && item.attachmentContentType || "").trim().toLowerCase();
  },

  attachmentFilename(item) {
    return String(
      safeCall(() => item.attachmentFilename) ||
      safeCall(() => item.getFilename && item.getFilename()) ||
      safeCall(() => item.getFilePath && item.getFilePath()) ||
      ""
    );
  },

  isEPUBAttachment(item) {
    if (!item || !isAttachmentItem(item)) {
      return false;
    }
    const contentType = this.attachmentContentType(item);
    const filename = this.attachmentFilename(item);
    return contentType === "application/epub+zip" || /\.epub$/i.test(filename);
  },

  isPDFAttachment(item) {
    if (!item || !isAttachmentItem(item)) {
      return false;
    }
    const contentType = this.attachmentContentType(item);
    const filename = this.attachmentFilename(item);
    return contentType === "application/pdf" || /\.pdf$/i.test(filename);
  },

  attachmentReadPriority(item) {
    if (!item || !isAttachmentItem(item)) {
      return 0;
    }
    const contentType = this.attachmentContentType(item);
    const filename = this.attachmentFilename(item);
    if (this.isEPUBAttachment(item)) {
      return 60;
    }
    if (this.isPDFAttachment(item)) {
      return 55;
    }
    if (Zotero.MIME && typeof Zotero.MIME.isTextType === "function" && Zotero.MIME.isTextType(contentType)) {
      return 50;
    }
    if (/\.x?html?$/i.test(filename) || /html|xml|text/.test(contentType)) {
      return 45;
    }
    return 10;
  },

  attachmentKind(item) {
    if (this.isEPUBAttachment(item)) {
      return "epub";
    }
    if (this.isPDFAttachment(item)) {
      return "pdf";
    }
    const contentType = this.attachmentContentType(item);
    if (Zotero.MIME && typeof Zotero.MIME.isTextType === "function" && Zotero.MIME.isTextType(contentType)) {
      return "text";
    }
    return contentType || "attachment";
  },

  itemSummary(item, extra = {}) {
    const summary = {
      key: item.key,
      id: item.id,
      libraryID: item.libraryID,
      itemType: item.itemType,
      title: safeCall(() => item.getField("title")) || safeCall(() => item.getDisplayTitle()) || `[${item.itemType}]`,
      creators: safeCall(() => item.getCreators()).map((creator) => creator.lastName || creator.name).filter(Boolean),
      year: safeCall(() => item.getField("date")),
      publicationTitle: safeCall(() => item.getField("publicationTitle")),
      abstractNote: truncateText(safeCall(() => item.getField("abstractNote")), ABSTRACT_PREVIEW_LENGTH),
      tags: safeCall(() => item.getTags()).map((tag) => tag.tag),
      collections: safeCall(() => item.getCollections()).map((id) => {
        const collection = Zotero.Collections.get(id);
        return collection ? { id: collection.id, key: collection.key, name: collection.name } : null;
      }).filter(Boolean),
      notes: { count: 0, previews: [] },
      annotations: { count: 0, previews: [] }
    };
    if (isAttachmentItem(item)) {
      summary.attachment = {
        contentType: String(item.attachmentContentType || ""),
        filename: this.attachmentFilename(item),
        kind: this.attachmentKind(item)
      };
    }
    return Object.assign(summary, extra);
  },

  isWriteTool(toolName) {
    return LOW_RISK_WRITE_TOOLS.has(toolName) || HIGH_RISK_WRITE_TOOLS.has(toolName);
  },

  notePreview(item) {
    return truncateText(stripHTML(safeCall(() => item.getNote())), NOTE_PREVIEW_LENGTH);
  },

  firstInteger(values) {
    for (const value of values) {
      if (value === "" || value == null || typeof value === "boolean") {
        continue;
      }
      const number = Number(value);
      if (Number.isInteger(number)) {
        return number;
      }
    }
    return null;
  },

  readerStateCandidates(reader) {
    const list = [
      safeCall(() => reader._state),
      safeCall(() => reader.state),
      safeCall(() => reader._internalReader && reader._internalReader._state),
      safeCall(() => reader._reader && reader._reader._state)
    ].filter(Boolean);
    return Array.from(new Set(list));
  },

  isReaderViewStats(value) {
    return !!(
      value &&
      typeof value === "object" &&
      (
        this.firstInteger([value.pageIndex]) !== null ||
        this.firstInteger([value.pagesCount]) !== null ||
        value.pageLabel ||
        value.usePhysicalPageNumbers !== undefined
      )
    );
  },

  readerCurrentViewStats(reader) {
    for (const state of this.readerStateCandidates(reader)) {
      const primaryStats = safeCall(() => state.primaryViewStats);
      const secondaryStats = safeCall(() => state.secondaryViewStats);
      const ordered = state.primary === false
        ? [secondaryStats, primaryStats]
        : [primaryStats, secondaryStats];
      for (const stats of ordered) {
        if (this.isReaderViewStats(stats)) {
          return stats;
        }
      }
    }
    return null;
  },

  readerViewCandidates(reader) {
    const roots = [
      reader,
      safeCall(() => reader._internalReader),
      safeCall(() => reader._reader)
    ].filter(Boolean);
    const views = [];
    for (const root of roots) {
      const state = safeCall(() => root._state) || safeCall(() => root.state) || {};
      const primary = safeCall(() => root._primaryView);
      const secondary = safeCall(() => root._secondaryView);
      const ordered = state.primary === false
        ? [secondary, primary]
        : [primary, secondary];
      views.push(...ordered.filter(Boolean));
    }
    return Array.from(new Set(views));
  },

  readerEPUBViewCandidates(reader) {
    return this.readerViewCandidates(reader).filter((view) => {
      const pageMapping = safeCall(() => view.pageMapping);
      return !!(pageMapping && typeof pageMapping.ranges === "function");
    });
  },

  readerEPUBPageTextAvailable(reader) {
    return this.readerEPUBViewCandidates(reader).length > 0;
  },

  readerEPUBPageLabel(reader, pageIndex) {
    if (!Number.isInteger(pageIndex)) {
      return "";
    }
    for (const view of this.readerEPUBViewCandidates(reader)) {
      const pageMapping = safeCall(() => view.pageMapping);
      const labels = safeCall(() => Array.from(pageMapping.pageLabels()));
      if (Array.isArray(labels) && labels[pageIndex]) {
        return String(labels[pageIndex]);
      }
    }
    return "";
  },

  readerEPUBPageMappingSnapshot(reader) {
    const view = this.readerEPUBViewCandidates(reader)[0];
    const pageMapping = view && safeCall(() => view.pageMapping);
    if (!pageMapping) {
      return null;
    }
    return {
      viewClass: view && view.constructor ? view.constructor.name : "",
      length: this.firstInteger([safeCall(() => pageMapping.length)]),
      isPhysical: !!safeCall(() => pageMapping.isPhysical),
      hasRanges: typeof pageMapping.ranges === "function",
      hasPageLabels: typeof pageMapping.pageLabels === "function"
    };
  },

  readerDOMRange(value) {
    if (!value) {
      return null;
    }
    if (typeof value.toRange === "function") {
      return safeCall(() => value.toRange()) || null;
    }
    if (value.startContainer && value.endContainer) {
      return value;
    }
    return null;
  },

  readerDOMRangeDocument(range) {
    if (!range) {
      return null;
    }
    return safeCall(() => range.startContainer.ownerDocument) ||
      safeCall(() => range.commonAncestorContainer.ownerDocument) ||
      safeCall(() => range.commonAncestorContainer) ||
      null;
  },

  setDOMRangeEndToDocumentEnd(range, view, doc) {
    const root = safeCall(() => doc.body) ||
      safeCall(() => view._iframeDocument && view._iframeDocument.body) ||
      safeCall(() => doc.documentElement);
    if (!root || typeof range.setEnd !== "function") {
      return false;
    }
    try {
      range.setEnd(root, root.childNodes ? root.childNodes.length : 0);
      return true;
    } catch (error) {
      return false;
    }
  },

  readEPUBReaderPageText(state, pageIndex) {
    if (!state || !this.isEPUBAttachment(state.attachment) || !Number.isInteger(pageIndex)) {
      return { available: false, text: "", source: "", error: "当前附件不是 EPUB，或页码无效。" };
    }
    for (const view of this.readerEPUBViewCandidates(state.reader)) {
      const pageMapping = safeCall(() => view.pageMapping);
      const ranges = safeCall(() => Array.from(pageMapping.ranges()));
      if (!Array.isArray(ranges) || !ranges[pageIndex]) {
        continue;
      }
      const start = this.readerDOMRange(ranges[pageIndex]);
      const startDoc = this.readerDOMRangeDocument(start);
      const doc = startDoc || safeCall(() => view._iframeDocument);
      if (!start || !doc || typeof doc.createRange !== "function") {
        continue;
      }
      try {
        const range = doc.createRange();
        range.setStart(start.startContainer, start.startOffset);
        let hasEnd = false;
        const next = ranges[pageIndex + 1] ? this.readerDOMRange(ranges[pageIndex + 1]) : null;
        if (next && this.readerDOMRangeDocument(next) === doc) {
          range.setEnd(next.startContainer, next.startOffset);
          hasEnd = true;
        }
        if (!hasEnd && !this.setDOMRangeEndToDocumentEnd(range, view, doc)) {
          continue;
        }
        return {
          available: true,
          text: normalizeFulltextContent(range.toString()),
          source: "epub-pageMapping-range"
        };
      } catch (error) {
      }
    }
    return { available: false, text: "", source: "", error: "当前 EPUB Reader 没有可用的页面范围映射。" };
  },

  readerViewStatsSnapshot(stats) {
    if (!stats || typeof stats !== "object") {
      return null;
    }
    const keys = [
      "pageIndex",
      "pageLabel",
      "pagesCount",
      "usePhysicalPageNumbers",
      "canNavigateToFirstPage",
      "canNavigateToLastPage",
      "canNavigateToPreviousPage",
      "canNavigateToNextPage",
      "canNavigateBack",
      "canNavigateForward"
    ];
    const out = {};
    for (const key of keys) {
      const value = stats[key];
      if (value !== undefined && value !== null && typeof value !== "object") {
        out[key] = value;
      }
    }
    return Object.keys(out).length ? out : null;
  },

  itemTagNames(item) {
    const tags = safeCall(() => item.getTags());
    return Array.isArray(tags) ? tags.map((tag) => tag.tag).filter(Boolean) : [];
  },

  getFulltextAPI() {
    return Zotero.FullText || Zotero.Fulltext || null;
  },

  getLibraryName(libraryID) {
    const library = this.getLibrary(libraryID);
    if (!library) {
      return `Library ${libraryID}`;
    }
    return library.name || library.treeViewID || `Library ${libraryID}`;
  },

  readerPageInfo(reader, pdfApp) {
    const viewStats = this.readerCurrentViewStats(reader);
    const totalPages = this.firstInteger([
      safeCall(() => viewStats && viewStats.pagesCount),
      safeCall(() => pdfApp.pdfDocument && pdfApp.pdfDocument.numPages),
      safeCall(() => pdfApp.pdfViewer && pdfApp.pdfViewer.pagesCount),
      safeCall(() => pdfApp.pagesCount),
      safeCall(() => reader._state && reader._state.totalPages),
      safeCall(() => reader._state && reader._state.pagesCount),
      safeCall(() => reader._state && reader._state.pageCount),
      safeCall(() => reader.state && reader.state.totalPages),
      safeCall(() => reader.state && reader.state.pagesCount),
      safeCall(() => reader.state && reader.state.pageCount),
      safeCall(() => reader._internalReader && reader._internalReader._state && reader._internalReader._state.totalPages),
      safeCall(() => reader._internalReader && reader._internalReader._state && reader._internalReader._state.pagesCount),
      safeCall(() => reader._internalReader && reader._internalReader._state && reader._internalReader._state.pageCount),
      safeCall(() => reader._reader && reader._reader._state && reader._reader._state.totalPages),
      safeCall(() => reader._reader && reader._reader._state && reader._reader._state.pagesCount),
      safeCall(() => reader._reader && reader._reader._state && reader._reader._state.pageCount)
    ]);
    let pageIndex = this.firstInteger([
      safeCall(() => viewStats && viewStats.pageIndex),
      safeCall(() => reader._state && reader._state.pageIndex),
      safeCall(() => reader.state && reader.state.pageIndex),
      safeCall(() => reader._internalReader && reader._internalReader._state && reader._internalReader._state.pageIndex),
      safeCall(() => reader._reader && reader._reader._state && reader._reader._state.pageIndex),
      safeCall(() => reader._primaryView && reader._primaryView._state && reader._primaryView._state.pageIndex),
      safeCall(() => reader._internalReader && reader._internalReader._primaryView && reader._internalReader._primaryView._state && reader._internalReader._primaryView._state.pageIndex),
      safeCall(() => reader._reader && reader._reader._primaryView && reader._reader._primaryView._state && reader._reader._primaryView._state.pageIndex)
    ]);
    const oneBasedPage = this.firstInteger([
      safeCall(() => pdfApp.pdfViewer && pdfApp.pdfViewer.currentPageNumber),
      safeCall(() => pdfApp.page),
      safeCall(() => reader.currentPageNumber),
      safeCall(() => reader.pageNumber),
      safeCall(() => reader.currentPage),
      safeCall(() => reader.page),
      safeCall(() => reader._state && reader._state.currentPageNumber),
      safeCall(() => reader._state && reader._state.pageNumber),
      safeCall(() => reader._state && reader._state.currentPage),
      safeCall(() => reader._state && reader._state.page),
      safeCall(() => reader.state && reader.state.currentPageNumber),
      safeCall(() => reader.state && reader.state.pageNumber),
      safeCall(() => reader.state && reader.state.currentPage),
      safeCall(() => reader.state && reader.state.page),
      safeCall(() => reader._internalReader && reader._internalReader.currentPageNumber),
      safeCall(() => reader._internalReader && reader._internalReader.pageNumber),
      safeCall(() => reader._internalReader && reader._internalReader._state && reader._internalReader._state.currentPageNumber),
      safeCall(() => reader._internalReader && reader._internalReader._state && reader._internalReader._state.pageNumber),
      safeCall(() => reader._reader && reader._reader.currentPageNumber),
      safeCall(() => reader._reader && reader._reader.pageNumber),
      safeCall(() => reader._reader && reader._reader._state && reader._reader._state.currentPageNumber),
      safeCall(() => reader._reader && reader._reader._state && reader._reader._state.pageNumber)
    ]);
    if (!Number.isInteger(pageIndex) && Number.isInteger(oneBasedPage)) {
      pageIndex = Math.max(0, oneBasedPage - 1);
    }
    const pageNumber = Number.isInteger(pageIndex) ? pageIndex + 1 : null;
    const pageLabel = String(
      safeCall(() => viewStats && viewStats.pageLabel) ||
      this.readerPageLabel(pdfApp, pageIndex) ||
      (pageNumber ? String(pageNumber) : "")
    );
    return {
      pageIndex,
      pageNumber,
      pageLabel,
      totalPages,
      usePhysicalPageNumbers: !!safeCall(() => viewStats && viewStats.usePhysicalPageNumbers)
    };
  },

  creatorSnapshot(creator) {
    if (!creator || typeof creator !== "object") {
      return null;
    }
    const out = {
      creatorType: this.creatorTypeName(creator.creatorType || creator.creatorTypeID),
      firstName: String(creator.firstName || "").trim(),
      lastName: String(creator.lastName || "").trim(),
      name: String(creator.name || "").trim(),
      fieldMode: creator.fieldMode ? 1 : 0
    };
    return out;
  },

  creatorTypeName(value) {
    if (!value && value !== 0) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      if (Zotero.CreatorTypes && typeof Zotero.CreatorTypes.getName === "function") {
        return Zotero.CreatorTypes.getName(value) || String(value);
      }
    } catch (error) {
    }
    return String(value);
  },

  normalizeWebUrl(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) {
      return null;
    }
    let url;
    try {
      url = new URL(trimmed);
    } catch (error) {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    const host = (url.hostname || "").toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return null;
    }
    return url.toString();
  },

  readerPageLabel(pdfApp, pageIndex) {
    if (!Number.isInteger(pageIndex)) {
      return "";
    }
    const labels = [
      safeCall(() => pdfApp.pdfViewer && pdfApp.pdfViewer.pageLabels),
      safeCall(() => pdfApp.pdfViewer && pdfApp.pdfViewer._pageLabels),
      safeCall(() => pdfApp.pageLabels)
    ].find((value) => Array.isArray(value));
    if (labels && labels[pageIndex]) {
      return String(labels[pageIndex]);
    }
    return "";
  },

  grantSessionRead(libraryID) {
    const key = String(libraryID);
    if (this.sessionReadGrants.has(key)) {
      return;
    }
    this.sessionReadGrants.add(key);
    this.log("library.read_grant.granted", { libraryID, libraryName: this.getLibraryName(libraryID) });
    this.renderAll();
  },

  isAnnotationItem(item) {
    return item && item.itemType === "annotation";
  },

  async pathExists(path) {
    if (!path) {
      return false;
    }
    try {
      if (typeof this.pathToLocalFile === "function") {
        const file = this.pathToLocalFile(path);
        return file.exists();
      }
      if (typeof OS !== "undefined" && OS.File && typeof OS.File.exists === "function") {
        return await OS.File.exists(path);
      }
      if (typeof IOUtils !== "undefined" && typeof IOUtils.exists === "function") {
        return await IOUtils.exists(path);
      }
    } catch (error) {
    }
    return false;
  },

  normalizeCreators(creators) {
    const normalized = [];
    for (const creator of Array.isArray(creators) ? creators : []) {
      if (!creator || typeof creator !== "object") {
        continue;
      }
      const creatorType = String(creator.creatorType || "author").trim() || "author";
      const name = String(creator.name || "").trim();
      const firstName = String(creator.firstName || "").trim();
      const lastName = String(creator.lastName || "").trim();
      if (name) {
        normalized.push({
          creatorType,
          name,
          fieldMode: 1
        });
      } else if (firstName || lastName) {
        normalized.push({
          creatorType,
          firstName,
          lastName
        });
      }
    }
    return normalized;
  },

  async executeTool(toolName, args) {
    this.log("tool.started", { toolName, args });
    let result;
    try {
      const handler = this._toolDispatch[toolName];
      if (!handler) {
        result = { ok: false, error: `未知工具：${toolName}` };
      } else {
        result = await handler(this, args);
      }
    } catch (error) {
      result = {
        ok: false,
        error: String(error),
        source: "tool",
        toolName
      };
    }
    if (this.task) {
      if (result && result.ok === false) {
        if (result.validationError) {
          this.task.lastToolFailure = null;
          this.task.consecutiveToolFailures = 0;
        } else {
          this.task.lastToolFailure = {
            toolName,
            error: result.error || "工具返回失败。"
          };
          this.task.consecutiveToolFailures = (this.task.consecutiveToolFailures || 0) + 1;
        }
      } else if (this.isWriteTool(toolName)) {
        this.task.lastToolFailure = null;
        this.task.consecutiveToolFailures = 0;
        this.task.executedWriteToolCount++;
      } else {
        this.task.lastToolFailure = null;
        this.task.consecutiveToolFailures = 0;
      }
    }
    this.log("tool.finished", { toolName, result });
    return result;
  },

  collectionSummary(collection) {
    const parent = collection.parentID ? Zotero.Collections.get(collection.parentID) : null;
    return {
      id: collection.id,
      key: collection.key,
      name: collection.name,
      libraryID: collection.libraryID,
      parentID: collection.parentID || null,
      parentKey: parent ? parent.key : null
    };
  },

  revokeSessionRead(libraryID) {
    const key = String(libraryID);
    if (!this.sessionReadGrants.delete(key)) {
      return;
    }
    this.log("library.read_grant.revoked", { libraryID, libraryName: this.getLibraryName(libraryID) });
    this.renderAll();
  },

  itemCollectionIDs(item) {
    const collections = safeCall(() => item.getCollections());
    return Array.isArray(collections) ? collections.filter(Boolean) : [];
  },

  annotationPreview(item) {
    const text = [
      safeCall(() => item.annotationText),
      safeCall(() => item.annotationComment),
      safeCall(() => item.getField && item.getField("annotationText")),
      safeCall(() => item.getField && item.getField("annotationComment"))
    ].filter(Boolean).join(" ");
    return truncateText(stripHTML(text), NOTE_PREVIEW_LENGTH);
  },

  async toolAddTags(args) {
    const changed = [];
    for (const key of args.itemKeys || []) {
      const item = await this.getItemByKey(key);
      if (!item) {
        continue;
      }
      const before = item.getTags().map((tag) => tag.tag);
      for (const tag of args.tags || []) {
        item.addTag(tag);
      }
      await item.saveTx();
      changed.push({ itemID: item.id, before, tags: args.tags || [] });
    }
    this.undoStack.push({ type: "restore_tags", changed, summary: `撤销添加标签到 ${changed.length} 个条目` });
    this.markLibraryIndexDirty(this.currentTaskLibraryID());
    return { ok: true, changedCount: changed.length };
  },

  annotationSummary(annotation) {
    return {
      key: annotation.key,
      type: safeCall(() => annotation.annotationType) || safeCall(() => annotation.getField && annotation.getField("annotationType")) || "",
      color: safeCall(() => annotation.annotationColor) || "",
      pageLabel: this.annotationPageLabel(annotation),
      text: truncateText(safeCall(() => annotation.annotationText) || safeCall(() => annotation.getField && annotation.getField("annotationText")), NOTE_PREVIEW_LENGTH),
      comment: truncateText(safeCall(() => annotation.annotationComment) || safeCall(() => annotation.getField && annotation.getField("annotationComment")), NOTE_PREVIEW_LENGTH)
    };
  },

  resolveOwningItem(item) {
    if (!item) {
      return null;
    }
    if (!item.parentID) {
      return item;
    }
    const parent = Zotero.Items.get(item.parentID);
    return parent ? this.resolveOwningItem(parent) : item;
  },

  async toolWebFetch(args) {
    if (!this.task) {
      return { ok: false, error: "没有活动任务。" };
    }
    const prompt = String(args.prompt || "").trim();
    if (!prompt) {
      return { ok: false, error: "web_fetch 需要 prompt，说明要从页面提取什么。" };
    }
    const url = this.normalizeWebUrl(args.url);
    if (!url) {
      return { ok: false, error: "无效或不允许的 URL（仅支持 http/https，且禁止访问本机/内网地址）。" };
    }
    if ((this.task.roundWebFetchCount || 0) >= MAX_WEB_FETCH_PER_MODEL_ROUND) {
      return { ok: false, error: `本轮模型调用已达到最多 ${MAX_WEB_FETCH_PER_MODEL_ROUND} 次 web_fetch 限制。请下一轮再抓取。` };
    }
    let markdown = "";
    let contentType = "";
    try {
      const response = await this.fetchWithTimeout(url, {
        timeoutMs: WEB_FETCH_TIMEOUT_MS,
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8",
          "User-Agent": WEB_SEARCH_USER_AGENT
        }
      });
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status} ${response.statusText || ""}`.trim() };
      }
      contentType = (response.headers && response.headers.get("content-type")) || "";
      const raw = await this.readResponseTextLimited(response, WEB_FETCH_MAX_BYTES);
      if (/application\/json/i.test(contentType)) {
        try {
          markdown = "```json\n" + JSON.stringify(JSON.parse(raw), null, 2) + "\n```";
        } catch (error) {
          markdown = raw;
        }
      } else if (/text\/plain/i.test(contentType)) {
        markdown = raw;
      } else {
        markdown = this.htmlToMarkdownLite(raw);
      }
      if (markdown.length > WEB_FETCH_MAX_CHARS) {
        markdown = markdown.slice(0, WEB_FETCH_MAX_CHARS) + "\n\n…（内容已截断）";
      }
    } catch (error) {
      return { ok: false, error: `抓取失败：${error}` };
    }
    this.task.roundWebFetchCount = (this.task.roundWebFetchCount || 0) + 1;
    this.task.webFetchCount = (this.task.webFetchCount || 0) + 1;
    this.log("web.fetch", { url, prompt: this.truncateText(prompt, 120), chars: markdown.length });
    return {
      ok: true,
      url,
      prompt,
      contentType,
      markdown,
      instruction: "根据上方 markdown 正文回答 prompt；若信息不足请说明并建议改用 live_search 或其他 URL。"
    };
  },

  async getItemByKey(key) {
    if (!key) {
      return null;
    }
    const libraryID = this.currentTaskLibraryID();
    return Zotero.Items.getByLibraryAndKeyAsync
      ? Zotero.Items.getByLibraryAndKeyAsync(libraryID, key)
      : Zotero.Items.getByLibraryAndKey(libraryID, key);
  },

  getActiveLibraryID(win = this.firstWindow()) {
    const pane = win && win.ZoteroPane;
    const libraryID = safeCall(() => pane.getSelectedLibraryID && pane.getSelectedLibraryID());
    if (libraryID) {
      return libraryID;
    }
    const selectedCollection = safeCall(() => pane.getSelectedCollection && pane.getSelectedCollection());
    if (selectedCollection && selectedCollection.libraryID) {
      return selectedCollection.libraryID;
    }
    const selectedItems = safeCall(() => pane.getSelectedItems && pane.getSelectedItems());
    if (selectedItems && selectedItems[0] && selectedItems[0].libraryID) {
      return selectedItems[0].libraryID;
    }
    return Zotero.Libraries.userLibraryID;
  },

  htmlToMarkdownLite(html) {
    let text = String(html || "");
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
    text = text.replace(/<!--[\s\S]*?-->/g, "");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/(p|div|section|article|header|footer|li|tr|h[1-6])>/gi, "\n\n");
    text = text.replace(/<h1[^>]*>/gi, "\n\n# ");
    text = text.replace(/<h2[^>]*>/gi, "\n\n## ");
    text = text.replace(/<h3[^>]*>/gi, "\n\n### ");
    text = text.replace(/<h4[^>]*>/gi, "\n\n#### ");
    text = text.replace(/<li[^>]*>/gi, "\n- ");
    text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, label) => {
      const inner = stripHTML(label).trim();
      return inner ? `[${inner}](${href})` : href;
    });
    text = text.replace(/<[^>]+>/g, " ");
    text = stripHTML(text);
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  },

  filterLibraryItems(index, args) {
    const query = String(args.query || "").trim().toLowerCase();
    const tag = String(args.tag || "").trim().toLowerCase();
    const creator = String(args.creator || "").trim().toLowerCase();
    const year = String(args.year || "").trim();
    const collectionKey = String(args.collectionKey || "").trim();
    const includeDescendants = args.includeDescendants !== false;
    let allowedCollectionKeys = null;
    if (collectionKey) {
      allowedCollectionKeys = new Set([collectionKey]);
      if (includeDescendants) {
        const descendants = index.descendantKeysByKey.get(collectionKey) || [];
        for (const key of descendants) {
          allowedCollectionKeys.add(key);
        }
      }
    }

    return index.items.filter((item) => {
      if (allowedCollectionKeys && !item.collections.some((collection) => allowedCollectionKeys.has(collection.key))) {
        return false;
      }
      if (tag && !item.tags.some((value) => value.toLowerCase().includes(tag))) {
        return false;
      }
      if (creator && !item.creators.some((value) => value.toLowerCase().includes(creator))) {
        return false;
      }
      if (year && extractYear(item.year) !== year) {
        return false;
      }
      if (query) {
        const haystack = [
          item.title,
          item.publicationTitle,
          item.abstractNote,
          item.creators.join(" "),
          item.tags.join(" "),
          item.notes.previews.map((value) => value.preview).join(" "),
          item.annotations.previews.map((value) => value.preview).join(" ")
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  },

  async readerForTab(win, tabID) {
    const readerAPI = (win && win.Zotero && win.Zotero.Reader) || Zotero.Reader || null;
    if (!readerAPI) {
      return null;
    }
    const ids = [tabID].filter((value) => value || value === 0);
    for (const id of ids) {
      const reader = await this.resolveMaybePromise(safeCall(() => readerAPI.getByTabID && readerAPI.getByTabID(id)));
      if (reader) {
        return reader;
      }
    }
    const selectedReader = await this.resolveMaybePromise(safeCall(() => readerAPI.getSelectedReader && readerAPI.getSelectedReader()));
    if (selectedReader) {
      return selectedReader;
    }
    const readers = safeCall(() => readerAPI._readers);
    if (readers instanceof Map && (tabID || tabID === 0)) {
      return readers.get(tabID) || readers.get(String(tabID)) || null;
    }
    if (readers && typeof readers === "object" && (tabID || tabID === 0)) {
      return readers[tabID] || readers[String(tabID)] || null;
    }
    return null;
  },

  selectedZoteroTabID(win) {
    const tabs = (win && win.Zotero_Tabs) || (typeof Zotero_Tabs !== "undefined" ? Zotero_Tabs : null);
    if (!tabs) {
      return "";
    }
    const candidates = [
      safeCall(() => tabs.selectedID),
      safeCall(() => tabs.selectedId),
      safeCall(() => tabs.selected && tabs.selected.id),
      safeCall(() => tabs.getSelectedID && tabs.getSelectedID()),
      safeCall(() => tabs.getSelectedId && tabs.getSelectedId())
    ];
    return candidates.find((value) => value || value === 0) || "";
  },

  findTopLevelSummary(item, allItemsByID, topLevelMap) {
    let cursor = item;
    const visited = new Set();
    while (cursor && cursor.parentID && !visited.has(cursor.id)) {
      visited.add(cursor.id);
      const parent = allItemsByID.get(cursor.parentID);
      if (!parent) {
        break;
      }
      if (topLevelMap.has(parent.id)) {
        return topLevelMap.get(parent.id);
      }
      cursor = parent;
    }
    return null;
  },

  markAllIndexesDirty() {
    for (const index of this.libraryIndexes.values()) {
      index.dirty = true;
    }
  },

  annotationPageLabel(annotation) {
    return String(
      safeCall(() => annotation.annotationPageLabel) ||
      safeCall(() => annotation.getField && annotation.getField("annotationPageLabel")) ||
      this.parseAnnotationPosition(annotation).pageLabel ||
      ""
    );
  },

  annotationPageIndex(annotation) {
    const direct = this.firstInteger([
      safeCall(() => annotation.annotationPageIndex),
      safeCall(() => annotation.getField && annotation.getField("annotationPageIndex"))
    ]);
    if (Number.isInteger(direct)) {
      return direct;
    }
    const position = this.parseAnnotationPosition(annotation);
    return Number.isInteger(position.pageIndex) ? position.pageIndex : null;
  },

  readerDebugSnapshot(state) {
    const reader = state && state.reader;
    const internal = reader && safeCall(() => reader._internalReader);
    const viewStats = reader && this.readerCurrentViewStats(reader);
    return {
      tabID: state && state.tabID || "",
      hasReader: !!reader,
      readerClass: reader && reader.constructor ? reader.constructor.name : "",
      readerKeys: reader ? Object.keys(reader).slice(0, 80) : [],
      internalClass: internal && internal.constructor ? internal.constructor.name : "",
      internalKeys: internal ? Object.keys(internal).slice(0, 80) : [],
      currentViewStats: this.readerViewStatsSnapshot(viewStats),
      epubPageMapping: reader ? this.readerEPUBPageMappingSnapshot(reader) : null,
      attachmentID: state && state.attachment ? state.attachment.id : null,
      attachmentKey: state && state.attachment ? state.attachment.key : "",
      attachmentContentType: state && state.attachment ? String(state.attachment.attachmentContentType || "") : "",
      pageInfo: state && state.pageInfo ? state.pageInfo : null,
      hasPDFApplication: !!(state && state.pdfApp),
      textAPIAvailable: !!(state && state.textAPIAvailable)
    };
  },

  hasSessionReadGrant(libraryID) {
    return this.sessionReadGrants.has(String(libraryID));
  },

  async toolFinishTask(args) {
    if (this.task && this.task.lastToolFailure) {
      return {
        ok: false,
        error: `最近一次工具失败：${this.task.lastToolFailure.toolName} - ${this.task.lastToolFailure.error}`
      };
    }
    const rule = this.finishTaskSummaryMeetsUserMessageRule(args && args.summary);
    if (!rule.ok) {
      if (this.task) {
        this.task.status = "running";
        this.task.phase = "must_message_user";
        this.task.messages.push({
          role: "system",
          content: `${rule.error} Do not call finish_task again until the user has a proper explanation in the selected UI language.`
        });
        this.log("finish_task.rejected", { reason: rule.error, userFacingMessageCount: this.task.userFacingMessageCount || 0 });
      }
      return {
        ok: false,
        error: rule.error,
        mustMessageUserFirst: !!rule.mustMessageUserFirst,
        mustProvideSubstantiveSummary: !!rule.mustProvideSubstantiveSummary,
        validationError: true
      };
    }
    const summaryText = rule.summary;
    this.task.status = "complete";
    this.task.phase = "complete";
    this.task.summary = summaryText;
    this.pushChatTurnReadable(summaryText);
    this.flushChatTurnToDisplay();
    this.renderChatPanelIfOpen();
    await this.safeUpdateSessionMemoryForTask("completed");
    return { ok: true, summary: summaryText };
  },

  currentTaskLibraryID() {
    return this.task && this.task.libraryID ? this.task.libraryID : this.getActiveLibraryID();
  },

  readerAttachmentItem(reader) {
    const candidates = [
      safeCall(() => reader.itemID),
      safeCall(() => reader._itemID),
      safeCall(() => reader._state && reader._state.itemID),
      safeCall(() => reader._internalReader && reader._internalReader.itemID),
      safeCall(() => reader._reader && reader._reader.itemID),
      safeCall(() => reader.item && reader.item.id),
      safeCall(() => reader._item && reader._item.id)
    ].filter((value) => value || value === 0);
    for (const id of candidates) {
      const item = safeCall(() => Zotero.Items.get(Number(id) || id));
      if (item && isAttachmentItem(item)) {
        return item;
      }
    }
    const itemObjects = [
      safeCall(() => reader.item),
      safeCall(() => reader._item),
      safeCall(() => reader._internalReader && reader._internalReader.item),
      safeCall(() => reader._reader && reader._reader.item)
    ];
    for (const item of itemObjects) {
      if (item && isAttachmentItem(item)) {
        return item;
      }
    }
    return null;
  },

  itemFieldDescriptors(item) {
    const descriptors = [];
    const fieldIDs = safeCall(() => Zotero.ItemFields.getItemTypeFields(item.itemTypeID));
    if (!Array.isArray(fieldIDs)) {
      return descriptors;
    }
    for (const fieldID of fieldIDs) {
      try {
        const name = Zotero.ItemFields.getName(fieldID);
        if (!name) {
          continue;
        }
        descriptors.push({
          id: fieldID,
          name,
          label: typeof Zotero.ItemFields.getLocalizedString === "function"
            ? (Zotero.ItemFields.getLocalizedString(fieldID) || name)
            : name
        });
      } catch (error) {
      }
    }
    return descriptors;
  },

  readerPDFApplication(reader) {
    for (const object of this.readerObjectCandidates(reader)) {
      const direct = safeCall(() => object.PDFViewerApplication);
      if (direct) {
        return direct;
      }
      if (safeCall(() => object.pdfViewer) || safeCall(() => object.pdfDocument)) {
        return object;
      }
    }
    for (const candidateWindow of this.readerWindowCandidates(reader)) {
      const app = safeCall(() => candidateWindow.PDFViewerApplication);
      if (app) {
        return app;
      }
    }
    return null;
  },

  async toolLiveSearch(args) {
    if (!this.task) {
      return { ok: false, error: "没有活动任务。" };
    }
    const query = String(args.query || "").trim();
    if (query.length < 2) {
      return { ok: false, error: "搜索关键词至少需要 2 个字符。" };
    }
    if ((this.task.roundLiveSearchCount || 0) >= MAX_LIVE_SEARCH_PER_MODEL_ROUND) {
      return { ok: false, error: `本轮模型调用已达到最多 ${MAX_LIVE_SEARCH_PER_MODEL_ROUND} 次 live_search 限制。请下一轮再搜或合并查询。` };
    }
    const provider = this.resolveWebSearchProvider();
    let results = [];
    let providerLabel = provider;
    try {
      if (provider === "brave") {
        const apiKey = (Zotero.Prefs.get(PREFS.braveSearchApiKey, true) || "").trim();
        const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_WEB_SEARCH_RESULTS}`;
        const response = await this.fetchWithTimeout(endpoint, {
          timeoutMs: WEB_FETCH_TIMEOUT_MS,
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": apiKey
          }
        });
        if (!response.ok) {
          const errText = await response.text();
          return {
            ok: false,
            error: `Brave Search HTTP ${response.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`
          };
        }
        const json = await response.json();
        const web = (json && json.web && json.web.results) || [];
        results = web.slice(0, MAX_WEB_SEARCH_RESULTS).map((row) => ({
          title: row.title || "",
          url: row.url || "",
          snippet: row.description || (row.extra_snippets && row.extra_snippets[0]) || ""
        }));
        providerLabel = "brave";
      } else {
        const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
        const response = await this.fetchWithTimeout(endpoint, {
          timeoutMs: WEB_FETCH_TIMEOUT_MS,
          headers: { Accept: "application/json" }
        });
        if (!response.ok) {
          return { ok: false, error: `DuckDuckGo HTTP ${response.status}` };
        }
        const json = await response.json();
        const related = Array.isArray(json.RelatedTopics) ? json.RelatedTopics : [];
        const flat = [];
        for (const topic of related) {
          if (topic.FirstURL && topic.Text) {
            flat.push({
              title: topic.Text.split(" - ")[0] || topic.Text,
              url: topic.FirstURL,
              snippet: topic.Text
            });
          }
          if (Array.isArray(topic.Topics)) {
            for (const sub of topic.Topics) {
              if (sub.FirstURL && sub.Text) {
                flat.push({
                  title: sub.Text.split(" - ")[0] || sub.Text,
                  url: sub.FirstURL,
                  snippet: sub.Text
                });
              }
            }
          }
        }
        if (json.AbstractURL && json.Abstract) {
          flat.unshift({
            title: json.Heading || query,
            url: json.AbstractURL,
            snippet: json.Abstract
          });
        }
        results = flat.slice(0, MAX_WEB_SEARCH_RESULTS);
        providerLabel = "duckduckgo_instant";
      }
    } catch (error) {
      return { ok: false, error: `网络搜索失败：${error}` };
    }
    results = results.filter((row) => row.url);
    results = this.filterWebSearchResults(results, args.allowed_domains, args.blocked_domains);
    this.task.roundLiveSearchCount = (this.task.roundLiveSearchCount || 0) + 1;
    this.task.liveSearchCount = (this.task.liveSearchCount || 0) + 1;
    this.log("live.search", { query, provider: providerLabel, count: results.length });
    return {
      ok: true,
      query,
      provider: providerLabel,
      results,
      note: providerLabel === "duckduckgo_instant"
        ? "Instant Answer API 结果可能较少；可在设置中配置 Brave Search API key 以获得完整网页结果。"
        : ""
    };
  },

  itemMetadataSnapshot(item) {
    const descriptors = this.itemFieldDescriptors(item);
    const fields = descriptors.map((descriptor) => {
      const value = safeCall(() => item.getField(descriptor.name));
      return {
        name: descriptor.name,
        label: descriptor.label,
        value: value == null ? "" : String(value),
        isEmpty: !String(value || "").trim()
      };
    });
    const nonEmptyFields = fields.filter((field) => !field.isEmpty);
    const emptyFields = fields.filter((field) => field.isEmpty).map((field) => ({
      name: field.name,
      label: field.label
    }));
    const creators = safeCall(() => item.getCreators());
    return {
      itemType: item.itemType,
      fields,
      nonEmptyFields,
      emptyFields,
      creators: Array.isArray(creators) ? creators.map((creator) => this.creatorSnapshot(creator)).filter(Boolean) : [],
      tags: this.itemTagNames(item),
      collectionCount: this.itemCollectionIDs(item).length
    };
  },

  async toolCreateNote(args) {
    const parent = await this.getItemByKey(args.parentItemKey);
    if (!parent) {
      return { ok: false, error: "找不到父条目。" };
    }
    const note = new Zotero.Item("note");
    note.parentID = parent.id;
    note.setNote(args.html || "");
    await note.saveTx();
    this.undoStack.push({ type: "trash_item", itemID: note.id, summary: "撤销创建笔记" });
    this.markLibraryIndexDirty(this.currentTaskLibraryID());
    return { ok: true, noteKey: note.key };
  },

  async exportItemsToString(items, translator) {
    return new Promise((resolve, reject) => {
      try {
        const translation = new Zotero.Translate.Export();
        translation.setItems(items.slice());
        translation.setTranslator(translator);
        translation.setHandler("done", (_obj, worked) => {
          if (!worked) {
            reject(new Error("导出翻译器报告失败。"));
            return;
          }
          resolve(typeof translation.string === "string" ? translation.string : String(translation.string || ""));
        });
        translation.setHandler("error", (_obj, error) => {
          reject(error || new Error("导出翻译器报告未知错误。"));
        });
        const promise = translation.translate();
        if (promise && typeof promise.catch === "function") {
          promise.catch((error) => reject(error));
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  async exportItemsViaString(items, translatorID, translatorLabel) {
    // Fallback when the in-memory translate() path and FileExporter.exportToBlob
    // are unavailable: export to a temp file under the debug dir, read it back,
    // then delete it. Returns the exported text or "" on failure.
    const base = this.getDebugOutputDir && this.getDebugOutputDir();
    if (!base) {
      return "";
    }
    const safeName = String(translatorLabel || "export").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 24) || "export";
    const stamp = String((this.task && this.task.loopCount) || 0) + "-" + String(items.length);
    const tmpPath = this.joinPath(base, "__za_export_tmp_" + safeName + "_" + stamp + ".txt");
    try {
      const translation = new Zotero.Translate.Export();
      translation.setItems(items.slice());
      translation.setTranslator(translatorID);
      const location = Zotero.File && typeof Zotero.File.pathToFile === "function"
        ? Zotero.File.pathToFile(tmpPath)
        : tmpPath;
      translation.setLocation(location);
      await translation.translate();
      let content = "";
      if (Zotero.File && typeof Zotero.File.getContentsAsync === "function") {
        content = await Zotero.File.getContentsAsync(tmpPath);
      }
      if (typeof content !== "string") {
        content = String(content || "");
      }
      return content;
    } catch (error) {
      this.log("export.fallback_failed", { translatorID, error: String(error) });
      return "";
    } finally {
      try {
        if (typeof this.pathToLocalFile === "function") {
          const file = this.pathToLocalFile(tmpPath);
          if (file.exists()) {
            file.remove(false);
          }
        } else if (typeof IOUtils !== "undefined" && typeof IOUtils.remove === "function") {
          await IOUtils.remove(tmpPath);
        } else if (typeof OS !== "undefined" && OS.File && typeof OS.File.remove === "function") {
          await OS.File.remove(tmpPath);
        }
      } catch (cleanupError) {
        // best-effort; tmp file may not exist
      }
    }
  },

  async toolListExportFormats(args) {
    if (!this.task) {
      return { ok: false, error: "没有活动任务。" };
    }
    let translators = [];
    try {
      const all = await Zotero.Translators.getAllForType("export");
      translators = Array.isArray(all) ? all : [];
    } catch (error) {
      return { ok: false, error: `无法枚举导出翻译器：${error}` };
    }
    const formats = translators
      .map((t) => ({
        translatorID: safeCall(() => t.translatorID) || "",
        label: safeCall(() => t.label) || "",
        labelShort: safeCall(() => t.labelShort) || ""
      }))
      .filter((f) => f.translatorID);
    this.log("export.list_formats", { count: formats.length });
    return { ok: true, count: formats.length, formats };
  },

  resolveExportPath(rawPath) {
    const p = String(rawPath || "").trim().replace(/^["']|["']$/g, "");
    if (!p) {
      return null;
    }
    const isAbsolute = /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("/");
    if (isAbsolute) {
      return typeof this.normalizeLocalPath === "function" ? this.normalizeLocalPath(p) : p;
    }
    const base = this.getDebugOutputDir && this.getDebugOutputDir();
    if (!base) {
      return null;
    }
    const parts = p.split(/[\\/]+/).filter(Boolean);
    const resolved = this.joinPath(base, ...parts);
    return typeof this.normalizeLocalPath === "function" ? this.normalizeLocalPath(resolved) : resolved;
  },

  async toolExportItemsCitation(args) {
    if (!this.task) {
      return { ok: false, error: "没有活动任务。" };
    }
    const keys = Array.isArray(args.itemKeys) ? args.itemKeys.filter(Boolean) : [];
    if (!keys.length) {
      return { ok: false, error: "export_items_citation 需要至少一个 itemKey。" };
    }
    if (keys.length > MAX_EXPORT_ITEMS) {
      return { ok: false, error: `单次最多导出 ${MAX_EXPORT_ITEMS} 个条目，本次请求 ${keys.length} 个。请分批或缩小范围。` };
    }
    if ((this.task.roundExportCount || 0) >= MAX_EXPORT_PER_MODEL_ROUND) {
      return { ok: false, error: `本轮模型调用已达到最多 ${MAX_EXPORT_PER_MODEL_ROUND} 次导出限制。请下一轮再导出。` };
    }

    const items = [];
    const missing = [];
    for (const key of keys) {
      const item = await this.getItemByKey(key);
      if (item) {
        const type = safeCall(() => item.itemType) || "";
        if (type === "attachment" || type === "note") {
          continue;
        }
        items.push(item);
      } else {
        missing.push(key);
      }
    }
    if (!items.length) {
      return { ok: false, error: `未能解析任何可导出条目。缺失或为附件/笔记的 key：${missing.join(", ") || "(无)"}` };
    }

    const wanted = String(args.format || "").trim();
    if (!wanted) {
      return { ok: false, error: "export_items_citation 需要指定 format（translatorID 或 label）。请先调用 list_export_formats。" };
    }
    let translator = null;
    let translatorList = [];
    try {
      const all = await Zotero.Translators.getAllForType("export");
      translatorList = Array.isArray(all) ? all : [];
      const lower = wanted.toLowerCase();
      translator =
        translatorList.find((t) => safeCall(() => t.translatorID) === wanted) ||
        translatorList.find((t) => String(safeCall(() => t.label) || "").toLowerCase() === lower) ||
        translatorList.find((t) => String(safeCall(() => t.labelShort) || "").toLowerCase() === lower);
    } catch (error) {
      return { ok: false, error: `查找翻译器失败：${error}` };
    }
    if (!translator) {
      return { ok: false, error: `未找到匹配的导出格式：“${wanted}”。请调用 list_export_formats 查看可用格式。` };
    }
    const translatorID = safeCall(() => translator.translatorID) || "";
    const translatorLabel = safeCall(() => translator.label) || translatorID;

    let text = "";
    let usedFallback = false;
    let memoryError = null;
    try {
      text = await this.exportItemsToString(items, translator);
    } catch (error) {
      memoryError = error;
    }

    // Many translators only write to a file and return "" when no location is
    // set (e.g. BibLaTeX). Fall back to exporting via a temp file whenever the
    // in-memory path returned nothing OR threw.
    if (!text) {
      try {
        const exportText = await this.exportItemsViaString(items, translatorID, translatorLabel);
        if (exportText) {
          text = exportText;
          usedFallback = true;
        } else if (memoryError) {
          return { ok: false, error: `导出失败且当前环境无可用回退。Path A 错误：${memoryError}` };
        }
      } catch (fallbackError) {
        return { ok: false, error: `导出失败（Path A: ${memoryError || "返回空内容"}; 回退：${fallbackError}）。` };
      }
    }

    if (!text) {
      return { ok: false, error: `翻译器 “${translatorLabel}” 返回了空内容。` };
    }

    let savedPath = null;
    const wantsSave = !!String(args.saveToPath || "").trim();
    if (wantsSave) {
      const rawPath = String(args.saveToPath).trim();
      const path = this.resolveExportPath(rawPath);
      if (!path) {
        return { ok: false, error: `无效或不可写的导出路径：“${rawPath}”。` };
      }
      if (await this.pathExists(path)) {
        return { ok: false, error: `目标文件已存在，拒绝覆盖：${path}。请指定一个新路径。` };
      }
      try {
        await this.writeTextFile(path, text);
        savedPath = path;
        this.undoStack.push({
          type: "delete_export_file",
          path,
          summary: `撤销导出文件写入：${path}`
        });
      } catch (error) {
        return {
          ok: false,
          error: `导出文本已生成但写入文件失败：${error}`,
          text: truncateText(text, MAX_EXPORT_TEXT_CHARS),
          translatorID,
          format: translatorLabel,
          itemCount: items.length
        };
      }
    }

    this.task.roundExportCount = (this.task.roundExportCount || 0) + 1;
    this.task.exportCount = (this.task.exportCount || 0) + 1;
    this.log("export.items", {
      translatorID,
      translatorLabel,
      itemCount: items.length,
      chars: text.length,
      saved: !!savedPath,
      path: savedPath || "",
      fallback: usedFallback,
      missingKeys: missing
    });

    const returnedText =
      text.length > MAX_EXPORT_TEXT_CHARS
        ? text.slice(0, MAX_EXPORT_TEXT_CHARS) +
          "\n\n…（导出文本已截断，完整内容已" +
          (savedPath ? `写入 ${savedPath}` : "在内存中") +
          "）"
        : text;

    return {
      ok: true,
      format: translatorLabel,
      translatorID,
      itemCount: items.length,
      missingKeys: missing.length ? missing : undefined,
      savedToPath: savedPath || undefined,
      text: returnedText,
      truncated: text.length > MAX_EXPORT_TEXT_CHARS,
      fallbackUsed: usedFallback,
      instruction: wantsSave
        ? "已将导出文本写入指定路径，同时将（可能截断的）文本附在此结果中供你向用户展示。"
        : "将上方导出文本展示给用户；如用户希望保存为文件，再次调用本工具并带上 saveToPath。"
    };
  },

  validateBatchPlan(plan) {
    if (!Array.isArray(plan)) {
      return { ok: false, error: "run_batch_plan 需要一个 plan 数组。" };
    }
    if (!plan.length) {
      return { ok: false, error: "plan 为空，无可执行步骤。" };
    }
    if (plan.length > MAX_BATCH_STEPS) {
      return { ok: false, error: `批量计划最多 ${MAX_BATCH_STEPS} 步，本次 ${plan.length} 步。请拆分。` };
    }
    let createCollectionSteps = 0;
    let totalItems = 0;
    let hasHighRisk = false;
    const violations = [];
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      if (!step || typeof step !== "object") {
        violations.push(`第 ${i + 1} 步不是对象。`);
        continue;
      }
      const tool = String(step.tool || "");
      if (!BATCH_ALLOWED_TOOLS.has(tool)) {
        violations.push(`第 ${i + 1} 步工具 “${tool}” 不在批次允许列表内。`);
        continue;
      }
      if (!step.args || typeof step.args !== "object") {
        violations.push(`第 ${i + 1} 步缺少 args 对象。`);
        continue;
      }
      if (HIGH_RISK_WRITE_TOOLS.has(tool)) {
        hasHighRisk = true;
      }
      if (tool === "create_collection") {
        createCollectionSteps++;
      }
      const itemKeys = Array.isArray(step.args.itemKeys) ? step.args.itemKeys : [];
      totalItems += itemKeys.length;
      if (step.args.itemKey) {
        totalItems += 1;
      }
      if (step.args.parentItemKey) {
        totalItems += 1;
      }
    }
    if (violations.length) {
      return { ok: false, error: `批量计划校验失败：${violations.join("；")}` };
    }
    if (createCollectionSteps > MAX_COLLECTIONS_PER_MODEL_ROUND) {
      return {
        ok: false,
        error: `批量计划含 ${createCollectionSteps} 个 create_collection 步，超过单轮上限 ${MAX_COLLECTIONS_PER_MODEL_ROUND}。请拆分到不同轮次。`
      };
    }
    if (totalItems > MAX_BATCH_TOTAL_ITEMS) {
      return {
        ok: false,
        error: `批量计划涉及约 ${totalItems} 个条目，超过上限 ${MAX_BATCH_TOTAL_ITEMS}。请缩小范围。`
      };
    }
    return {
      ok: true,
      stepCount: plan.length,
      totalItems,
      hasWrite: true,
      hasHighRisk
    };
  },

  async toolRunBatchPlan(args) {
    if (!this.task) {
      return { ok: false, error: "没有活动任务。" };
    }
    const validation = this.validateBatchPlan(args && args.plan);
    if (!validation.ok) {
      this.log("batch.rejected", { reason: validation.error });
      return { ok: false, error: validation.error };
    }
    const plan = args.plan;
    const results = [];
    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const tool = step.tool;
      let result;
      try {
        result = await this.executeTool(tool, step.args);
      } catch (error) {
        result = { ok: false, error: String(error), source: "batch_step", stepIndex: i };
      }
      const entry = {
        index: i + 1,
        tool,
        label: step.label || "",
        ok: !!(result && result.ok)
      };
      if (!entry.ok) {
        entry.error = (result && result.error) || "步骤执行失败。";
        failed++;
      } else {
        succeeded++;
        if (result) {
          const compact = {};
          for (const k of ["noteKey", "collectionKey", "trashedCount", "addedCount", "tagsAdded"]) {
            if (result[k] !== undefined) {
              compact[k] = result[k];
            }
          }
          if (Object.keys(compact).length) {
            entry.result = compact;
          }
        }
      }
      results.push(entry);
    }
    this.log("batch.executed", {
      stepCount: plan.length,
      succeeded,
      failed,
      hasHighRisk: validation.hasHighRisk
    });
    return {
      ok: true,
      total: plan.length,
      succeeded,
      failed,
      results,
      hasHighRisk: validation.hasHighRisk,
      instruction:
        failed > 0
          ? `批量执行完成：成功 ${succeeded} 步，失败 ${failed} 步。请向用户汇报每步成败，并说明失败步骤的原因。`
          : `批量执行完成：${succeeded} 步全部成功。请向用户汇报结果。`
    };
  },

  hostnameMatchesDomain(hostname, domain) {
    const h = String(hostname || "").toLowerCase();
    const d = String(domain || "").toLowerCase().replace(/^\.+/, "");
    if (!h || !d) {
      return false;
    }
    return h === d || h.endsWith("." + d);
  },

  async toolSearchItems(args) {
    const query = String(args.query || "").trim();
    const limit = Math.min(Math.max(Number(args.limit || DEFAULT_BROWSE_PAGE_SIZE), 1), MAX_ITEMS_PER_MODEL_ROUND);
    if (!query) {
      return { ok: false, error: "搜索关键词为空。" };
    }
    const search = new Zotero.Search();
    search.libraryID = this.currentTaskLibraryID();
    search.addCondition("quicksearch-titleCreatorYear", "contains", query);
    const ids = await search.search();
    const items = Zotero.Items.get(ids.slice(0, limit)).map((item) => this.itemSummary(item));
    return {
      ok: true,
      library: {
        id: this.currentTaskLibraryID(),
        name: this.getLibraryName(this.currentTaskLibraryID())
      },
      query,
      count: ids.length,
      limitApplied: ids.length > limit,
      items
    };
  },

  async toolMoveToTrash(args) {
    const trashed = [];
    for (const key of args.itemKeys || []) {
      const item = await this.getItemByKey(key);
      if (item) {
        await item.trashTx();
        trashed.push(item.id);
      }
    }
    this.undoStack.push({ type: "restore_trashed_items", itemIDs: trashed, summary: `撤销移到回收站：${trashed.length} 个条目` });
    this.markLibraryIndexDirty(this.currentTaskLibraryID());
    return { ok: true, trashedCount: trashed.length };
  },

  annotationMatchesPage(annotation, pageIndex, pageLabel) {
    const annotationIndex = this.annotationPageIndex(annotation);
    if (Number.isInteger(annotationIndex) && annotationIndex === pageIndex) {
      return true;
    }
    const annotationLabel = this.annotationPageLabel(annotation);
    return !!(annotationLabel && pageLabel && String(annotationLabel) === String(pageLabel));
  },

  resolveFulltextTarget(item) {
    if (!item) {
      return null;
    }
    if (isAttachmentItem(item)) {
      return item;
    }
    const attachmentIDs = safeCall(() => item.getAttachments());
    const attachments = [];
    for (const id of attachmentIDs || []) {
      const attachment = Zotero.Items.get(id);
      if (attachment && isAttachmentItem(attachment)) {
        attachments.push(attachment);
      }
    }
    if (!attachments.length) {
      return null;
    }
    attachments.sort((a, b) => {
      const priority = this.attachmentReadPriority(b) - this.attachmentReadPriority(a);
      if (priority !== 0) {
        return priority;
      }
      return String(this.attachmentFilename(a)).localeCompare(String(this.attachmentFilename(b)), "zh-Hans-CN");
    });
    return attachments[0] || null;
  },

  markLibraryIndexDirty(libraryID) {
    if (!libraryID) {
      this.markAllIndexesDirty();
      return;
    }
    const index = this.libraryIndexes.get(String(libraryID));
    if (index) {
      index.dirty = true;
    }
  },

  filterWebSearchResults(results, allowed, blocked) {
    const allowList = Array.isArray(allowed) ? allowed.filter(Boolean) : [];
    const blockList = Array.isArray(blocked) ? blocked.filter(Boolean) : [];
    return results.filter((row) => {
      let host = "";
      try {
        host = new URL(row.url).hostname;
      } catch (error) {
        return false;
      }
      if (blockList.some((d) => this.hostnameMatchesDomain(host, d))) {
        return false;
      }
      if (allowList.length && !allowList.some((d) => this.hostnameMatchesDomain(host, d))) {
        return false;
      }
      return true;
    });
  },

  async readFulltextText(item) {
    const fulltext = this.getFulltextAPI();
    if (!fulltext) {
      return { ok: false, error: "当前 Zotero 环境没有可用的 FullText 接口。" };
    }

    if (typeof fulltext.getItemCacheFile === "function") {
      let modern = await this.readFulltextFromModernAPI(fulltext, item);
      if (modern.text) {
        return { ok: true, text: modern.text, source: modern.source, indexedOnDemand: false };
      }
      if (typeof fulltext.indexItems === "function") {
        try {
          await fulltext.indexItems([item.id], { ignoreErrors: true });
        } catch (error) {
        }
        modern = await this.readFulltextFromModernAPI(fulltext, item);
        if (modern.text) {
          return { ok: true, text: modern.text, source: modern.source, indexedOnDemand: true };
        }
      }
      const contentType = String(item && item.attachmentContentType || "").trim() || "unknown";
      return {
        ok: false,
        error: `Zotero 9 未返回可读全文内容。附件类型：${contentType}。这通常表示全文索引或文本缓存尚未生成。`
      };
    }

    if (typeof fulltext.getItemContent === "function") {
      const legacy = await fulltext.getItemContent(item.id);
      const text = normalizeFulltextContent(legacy);
      if (text) {
        return { ok: true, text, source: "legacy-getItemContent", indexedOnDemand: false };
      }
      return { ok: false, error: "旧版 Fulltext 接口返回了空内容。" };
    }

    return { ok: false, error: "当前 Zotero 环境存在 FullText 对象，但没有可读全文的方法。" };
  },

  async fetchWithTimeout(url, options = {}) {
    const fetchImpl = this.getFetch();
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timer = null;
    if (controller) {
      timer = setTimeout(() => controller.abort(), options.timeoutMs || WEB_FETCH_TIMEOUT_MS);
    }
    try {
      const response = await fetchImpl(url, {
        method: options.method || "GET",
        headers: options.headers || {},
        signal: controller ? controller.signal : undefined,
        redirect: "follow"
      });
      return response;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  },

  readerWindowCandidates(reader) {
    const windows = [];
    for (const object of this.readerObjectCandidates(reader)) {
      windows.push(
        safeCall(() => object._iframeWindow),
        safeCall(() => object._iframeWindow && object._iframeWindow.wrappedJSObject),
        safeCall(() => object._window),
        safeCall(() => object._window && object._window.wrappedJSObject),
        safeCall(() => object._iframe && object._iframe.contentWindow),
        safeCall(() => object._iframe && object._iframe.contentWindow && object._iframe.contentWindow.wrappedJSObject),
        safeCall(() => object.iframeWindow),
        safeCall(() => object.window)
      );
    }
    return Array.from(new Set(windows.filter(Boolean)));
  },

  readerObjectCandidates(reader) {
    const list = [
      reader,
      safeCall(() => reader._internalReader),
      safeCall(() => reader._reader),
      safeCall(() => reader._primaryView),
      safeCall(() => reader._secondaryView),
      safeCall(() => reader._internalReader && reader._internalReader._primaryView),
      safeCall(() => reader._internalReader && reader._internalReader._secondaryView),
      safeCall(() => reader._reader && reader._reader._primaryView),
      safeCall(() => reader._reader && reader._reader._secondaryView),
      ...this.readerViewCandidates(reader)
    ].filter(Boolean);
    return Array.from(new Set(list));
  },

  textFromPDFTextContent(content) {
    if (!content) {
      return "";
    }
    if (typeof content === "string") {
      return normalizeFulltextContent(content);
    }
    const items = Array.isArray(content.items) ? content.items : [];
    const chunks = [];
    for (const item of items) {
      const text = item && typeof item.str === "string" ? item.str : "";
      if (!text) {
        continue;
      }
      chunks.push(text);
      if (item.hasEOL) {
        chunks.push("\n");
      }
    }
    return normalizeFulltextContent(chunks.join(" "));
  },

  currentCreatorsSnapshot(item) {
    const creators = safeCall(() => item.getCreators());
    return Array.isArray(creators) ? creators.map((creator) => this.creatorSnapshot(creator)).filter(Boolean) : [];
  },

  async buildLibraryIndex(libraryID) {
    const topLevelItems = await Zotero.Items.getAll(libraryID, true);
    const allItems = await Zotero.Items.getAll(libraryID);
    const collections = Zotero.Collections.getByLibrary ? Zotero.Collections.getByLibrary(libraryID, true) : [];
    const topLevelSummaries = topLevelItems.map((item) => this.itemSummary(item));
    const topLevelMap = new Map(topLevelSummaries.map((summary) => [summary.id, summary]));
    const allItemsByID = new Map(allItems.map((item) => [item.id, item]));
    let noteCount = 0;
    let annotationCount = 0;

    for (const item of allItems) {
      if (!item || !item.parentID) {
        continue;
      }
      const owner = this.findTopLevelSummary(item, allItemsByID, topLevelMap);
      if (!owner) {
        continue;
      }
      if (this.isNoteItem(item)) {
        noteCount++;
        owner.notes.count++;
        if (owner.notes.previews.length < 3) {
          owner.notes.previews.push({
            key: item.key,
            preview: this.notePreview(item)
          });
        }
        continue;
      }
      if (this.isAnnotationItem(item)) {
        annotationCount++;
        owner.annotations.count++;
        if (owner.annotations.previews.length < 3) {
          owner.annotations.previews.push({
            key: item.key,
            preview: this.annotationPreview(item)
          });
        }
      }
    }

    const collectionMap = new Map();
    const childrenByParentID = new Map();
    for (const collection of collections) {
      const parent = collection.parentID ? Zotero.Collections.get(collection.parentID) : null;
      const node = {
        id: collection.id,
        key: collection.key,
        name: collection.name,
        parentID: collection.parentID || null,
        parentKey: parent ? parent.key : null,
        level: typeof collection.level === "number" ? collection.level : 0,
        exactItemCount: 0,
        itemCount: 0,
        childCollectionCount: 0
      };
      collectionMap.set(node.id, node);
      if (node.parentID) {
        if (!childrenByParentID.has(node.parentID)) {
          childrenByParentID.set(node.parentID, []);
        }
        childrenByParentID.get(node.parentID).push(node.id);
      }
    }

    const tagCounts = new Map();
    const itemTypeCounts = new Map();
    for (const item of topLevelSummaries) {
      itemTypeCounts.set(item.itemType, (itemTypeCounts.get(item.itemType) || 0) + 1);
      for (const tag of item.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
      for (const collection of item.collections) {
        const node = collectionMap.get(collection.id);
        if (node) {
          node.exactItemCount++;
        }
      }
    }

    const collectionsByDepth = Array.from(collectionMap.values()).sort((a, b) => b.level - a.level);
    const descendantKeysByKey = new Map();
    for (const node of collectionsByDepth) {
      const childIDs = childrenByParentID.get(node.id) || [];
      node.childCollectionCount = childIDs.length;
      let total = node.exactItemCount;
      const descendantKeys = new Set();
      for (const childID of childIDs) {
        const child = collectionMap.get(childID);
        if (!child) {
          continue;
        }
        total += child.itemCount;
        descendantKeys.add(child.key);
        const nested = descendantKeysByKey.get(child.key) || [];
        for (const key of nested) {
          descendantKeys.add(key);
        }
      }
      node.itemCount = total;
      descendantKeysByKey.set(node.key, Array.from(descendantKeys));
    }

    const sortedItems = topLevelSummaries.sort((a, b) => {
      const left = (a.title || "").toLowerCase();
      const right = (b.title || "").toLowerCase();
      return left.localeCompare(right, "zh-Hans-CN");
    });

    return {
      libraryID,
      libraryName: this.getLibraryName(libraryID),
      builtAt: Date.now(),
      dirty: false,
      items: sortedItems,
      collections: Array.from(collectionMap.values()).sort((a, b) => {
        if (a.level !== b.level) {
          return a.level - b.level;
        }
        return a.name.localeCompare(b.name, "zh-Hans-CN");
      }),
      descendantKeysByKey,
      tagStats: mapCountsToSortedPairs(tagCounts),
      itemTypeStats: mapCountsToSortedPairs(itemTypeCounts),
      noteCount,
      annotationCount
    };
  },

  async currentReaderHint(libraryID = this.currentTaskLibraryID()) {
    const state = await this.getActiveReaderState();
    if (!state.ok) {
      return {
        open: false,
        error: state.error || "当前没有前台 Zotero 阅读器标签。"
      };
    }
    const attachment = state.attachment;
    const owner = state.owner;
    const pageInfo = state.pageInfo || {};
    return {
      open: true,
      tabID: state.tabID || "",
      libraryID: attachment ? attachment.libraryID : null,
      libraryName: attachment ? this.getLibraryName(attachment.libraryID) : "",
      libraryMatchesTask: !!(attachment && attachment.libraryID === libraryID),
      itemKey: owner ? owner.key : "",
      attachmentKey: attachment ? attachment.key : "",
      title: owner ? (safeCall(() => owner.getField("title")) || safeCall(() => owner.getDisplayTitle())) : "",
      attachmentContentType: attachment ? String(attachment.attachmentContentType || "") : "",
      attachmentKind: attachment ? this.attachmentKind(attachment) : "",
      pageIndex: Number.isInteger(pageInfo.pageIndex) ? pageInfo.pageIndex : null,
      pageNumber: Number.isInteger(pageInfo.pageNumber) ? pageInfo.pageNumber : null,
      pageLabel: pageInfo.pageLabel || "",
      totalPages: Number.isInteger(pageInfo.totalPages) ? pageInfo.totalPages : null,
      usePhysicalPageNumbers: !!pageInfo.usePhysicalPageNumbers,
      canReadCurrentPages: !!(Number.isInteger(pageInfo.pageIndex) && state.textAPIAvailable),
      canReadFulltext: !!(attachment && this.attachmentReadPriority(attachment) > 0)
    };
  },

  parseAnnotationPosition(annotation) {
    const raw = safeCall(() => annotation.annotationPosition) || safeCall(() => annotation.getField && annotation.getField("annotationPosition"));
    if (!raw) {
      return {};
    }
    if (typeof raw === "object") {
      return raw;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return {};
    }
  },

  async toolReadItemFields(args) {
    const itemKey = String(args.itemKey || "").trim();
    if (!itemKey) {
      return { ok: false, error: "itemKey 为空。" };
    }
    const item = await this.getItemByKey(itemKey);
    if (!item) {
      return { ok: false, error: "找不到条目。" };
    }
    return {
      ok: true,
      library: {
        id: this.currentTaskLibraryID(),
        name: this.getLibraryName(this.currentTaskLibraryID())
      },
      item: this.itemSummary(item),
      metadata: this.itemMetadataSnapshot(item)
    };
  },

  async ensureLibraryIndex(libraryID) {
    const key = String(libraryID);
    const existing = this.libraryIndexes.get(key);
    if (existing && !existing.dirty) {
      return existing;
    }
    const index = await this.buildLibraryIndex(libraryID);
    this.libraryIndexes.set(key, index);
    return index;
  },

  resolveWebSearchProvider() {
    const pref = (Zotero.Prefs.get(PREFS.webSearchProvider, true) || "auto").trim().toLowerCase();
    const braveKey = (Zotero.Prefs.get(PREFS.braveSearchApiKey, true) || "").trim();
    if (pref === "brave") {
      return braveKey ? "brave" : "duckduckgo";
    }
    if (pref === "duckduckgo") {
      return "duckduckgo";
    }
    return braveKey ? "brave" : "duckduckgo";
  },

  async getCollectionByKey(key) {
    if (!key) {
      return null;
    }
    const libraryID = this.currentTaskLibraryID();
    return Zotero.Collections.getByLibraryAndKeyAsync
      ? Zotero.Collections.getByLibraryAndKeyAsync(libraryID, key)
      : Zotero.Collections.getByLibraryAndKey(libraryID, key);
  },

  async readReaderPageText(state, pageIndex) {
    if (state.pdfApp) {
      const pdfDocument = safeCall(() => state.pdfApp.pdfDocument) || safeCall(() => state.pdfApp.pdfViewer && state.pdfApp.pdfViewer.pdfDocument);
      if (!pdfDocument || typeof pdfDocument.getPage !== "function") {
        return { available: false, text: "", source: "pdfjs", error: "PDF Reader 没有暴露 pdfDocument.getPage。" };
      }
      const page = await pdfDocument.getPage(pageIndex + 1);
      const content = page && typeof page.getTextContent === "function" ? await page.getTextContent() : null;
      return {
        available: true,
        text: this.textFromPDFTextContent(content),
        source: "pdfjs-getTextContent"
      };
    }
    if (this.isEPUBAttachment(state.attachment)) {
      const epubText = this.readEPUBReaderPageText(state, pageIndex);
      if (epubText.available) {
        return epubText;
      }
    }
    for (const object of this.readerObjectCandidates(state.reader)) {
      for (const method of ["getPageText", "getPageTextContent", "getTextForPage"]) {
        if (typeof object[method] !== "function") {
          continue;
        }
        const raw = await this.resolveMaybePromise(object[method](pageIndex));
        const text = typeof raw === "string" ? raw : this.textFromPDFTextContent(raw);
        return {
          available: true,
          text: normalizeFulltextContent(text),
          source: method
        };
      }
    }
    return { available: false, text: "", source: "", error: "当前 Reader 没有暴露可用的页面文本接口。" };
  },

  async readCurrentContext(libraryID = this.currentTaskLibraryID()) {
    const win = this.firstWindow();
    const pane = win && win.ZoteroPane;
    const activeLibraryID = this.getActiveLibraryID(win);
    const sameLibrary = activeLibraryID === libraryID;
    const selectedItems = sameLibrary && pane && pane.getSelectedItems ? pane.getSelectedItems() : [];
    const selectedCollection = sameLibrary && pane && pane.getSelectedCollection ? pane.getSelectedCollection() : null;
    const items = selectedItems.slice(0, MAX_CONTEXT_SELECTED_ITEMS).map((item) => this.itemSummary(item));
    const currentReader = await this.currentReaderHint(libraryID);
    return {
      boundLibrary: {
        id: libraryID,
        name: this.getLibraryName(libraryID)
      },
      activeLibrary: {
        id: activeLibraryID,
        name: this.getLibraryName(activeLibraryID)
      },
      activeLibraryMatchesTask: sameLibrary,
      selectedCollection: selectedCollection ? this.collectionSummary(selectedCollection) : null,
      selectedItems: items,
      selectedItemCount: selectedItems.length,
      limitApplied: selectedItems.length > MAX_CONTEXT_SELECTED_ITEMS,
      currentReader,
      note: sameLibrary ? "" : "The Zotero UI focus moved to another library after this task started, so selection-based context is suppressed."
    };
  },

  async toolUpdateMetadata(args) {
    const item = await this.getItemByKey(args.itemKey);
    if (!item) {
      return { ok: false, error: "找不到条目。" };
    }
    const hasFields = !!(args.fields && typeof args.fields === "object");
    const hasCreators = Array.isArray(args.creators);
    if (!hasFields && !hasCreators) {
      return { ok: false, error: "update_metadata 至少需要 fields 或 creators 之一。" };
    }
    if (args.fields && (Object.prototype.hasOwnProperty.call(args.fields, "itemType") || Object.prototype.hasOwnProperty.call(args.fields, "itemTypeID"))) {
      return { ok: false, error: "update_metadata 不能修改 itemType。要把顶层附件变成书籍/文章父条目，请改用 create_parent_item。" };
    }
    const before = {};
    for (const [field, value] of Object.entries(args.fields || {})) {
      before[field] = item.getField(field);
      item.setField(field, value);
    }
    let beforeCreators = null;
    if (hasCreators) {
      beforeCreators = this.currentCreatorsSnapshot(item);
      const creators = this.normalizeCreators(args.creators);
      if (typeof item.setCreators === "function") {
        item.setCreators(creators);
      }
    }
    await item.saveTx();
    this.undoStack.push({
      type: "restore_fields",
      itemID: item.id,
      before,
      beforeCreators,
      summary: "撤销元数据修改"
    });
    this.markLibraryIndexDirty(this.currentTaskLibraryID());
    return {
      ok: true,
      changedFieldNames: Object.keys(args.fields || {}),
      changedCreators: hasCreators,
      item: this.itemSummary(item)
    };
  },

  isSupportedParentItemType(itemType) {
    const normalized = String(itemType || "").trim();
    if (!normalized) {
      return false;
    }
    if (normalized === "attachment" || normalized === "note" || normalized === "annotation") {
      return false;
    }
    try {
      const probe = new Zotero.Item(normalized);
      return !isAttachmentItem(probe) && !this.isNoteItem(probe) && !this.isAnnotationItem(probe);
    } catch (error) {
      return false;
    }
  },

  async resolveMaybePromise(value) {
    try {
      if (value && typeof value.then === "function") {
        return await value;
      }
      return value;
    } catch (error) {
      return "";
    }
  },

  async toolExpandedContext(args) {
    const libraryID = this.currentTaskLibraryID();
    if (!this.hasSessionReadGrant(libraryID)) {
      return {
        ok: false,
        error: "当前库尚未开放本会话整库元数据读取。"
      };
    }
    const overview = await this.getLibraryOverviewPayload(libraryID);
    return {
      ok: true,
      granted: true,
      library: {
        id: libraryID,
        name: this.getLibraryName(libraryID)
      },
      requestedScope: args.scope || "当前激活库整库元数据",
      reason: args.reason || "",
      overview
    };
  },

  async toolRequestReadApproval(args) {
    const safeArgs = args || {};
    const targetTool = String(safeArgs.targetTool || "").trim();
    if (!targetTool) {
      return { ok: false, error: "缺少 targetTool，请说明你接下来要调用的读工具。" };
    }
    const mode = Zotero.Prefs.get(PREFS.safetyMode, true) || DEFAULT_SAFETY_MODE;
    if (mode !== "review") {
      // Outside review mode there is no AI review layer; reads are governed by the existing
      // static rules. Tell the model it may proceed directly.
      return {
        ok: true,
        approved: true,
        mode,
        level: "n/a",
        reason: "当前安全模式不启用 AI 审核，可直接调用目标读工具。"
      };
    }
    const audit = await this.auditToolCall(REQUEST_READ_APPROVAL_TOOL, {
      targetTool,
      reason: safeArgs.reason || "",
      scopeHint: safeArgs.scopeHint || ""
    });
    return {
      ok: true,
      approved: audit.level === "low",
      level: audit.level,
      reason: audit.reason,
      targetTool
    };
  },

  async getActiveReaderState() {
    const win = this.firstWindow();
    if (!win) {
      return { ok: false, error: "无法找到 Zotero 主窗口。" };
    }
    const tabID = this.selectedZoteroTabID(win);
    const reader = await this.readerForTab(win, tabID);
    if (!reader) {
      return {
        ok: false,
        error: "当前前台标签不是 Zotero 阅读器，或 Zotero 未暴露该标签的 Reader 对象。",
        tabID: tabID || ""
      };
    }
    const attachment = this.readerAttachmentItem(reader);
    if (!attachment) {
      return {
        ok: false,
        error: "已找到当前 Reader，但无法解析对应附件条目。",
        tabID: tabID || "",
        reader
      };
    }
    const owner = this.resolveOwningItem(attachment);
    const pdfApp = this.readerPDFApplication(reader);
    const pageInfo = this.readerPageInfo(reader, pdfApp);
    return {
      ok: true,
      win,
      tabID,
      reader,
      attachment,
      owner,
      pdfApp,
      pageInfo,
      textAPIAvailable: !!(pdfApp || this.readerEPUBPageTextAvailable(reader) || this.readerPageTextMethodAvailable(reader))
    };
  },

  async toolCreateCollection(args) {
    if ((this.task.roundCreatedCollections || 0) >= MAX_COLLECTIONS_PER_MODEL_ROUND) {
      return { ok: false, error: `本轮模型调用已达到最多 ${MAX_COLLECTIONS_PER_MODEL_ROUND} 个新建分类的限制。请下一轮再建。` };
    }
    const collection = new Zotero.Collection();
    collection.libraryID = this.currentTaskLibraryID();
    collection.name = args.name;
    if (args.parentKey) {
      const parent = await this.getCollectionByKey(args.parentKey);
      if (parent) {
        collection.parentID = parent.id;
      }
    }
    await collection.saveTx();
    this.task.roundCreatedCollections = (this.task.roundCreatedCollections || 0) + 1;
    this.task.createdCollections++;
    this.undoStack.push({
      type: "delete_collection",
      collectionID: collection.id,
      summary: `撤销创建 collection：${collection.name}`
    });
    this.markLibraryIndexDirty(this.currentTaskLibraryID());
    return { ok: true, collection: this.collectionSummary(collection) };
  },

  async toolCreateParentItem(args) {
    const attachment = await this.getItemByKey(args.attachmentKey);
    if (!attachment) {
      return { ok: false, error: "找不到附件条目。" };
    }
    if (!isAttachmentItem(attachment)) {
      return { ok: false, error: "create_parent_item 只支持附件条目。" };
    }
    if (attachment.parentID) {
      return { ok: false, error: "该附件已经有父条目，不能重复创建父条目。" };
    }
    const itemType = String(args.itemType || "").trim();
    if (!this.isSupportedParentItemType(itemType)) {
      return { ok: false, error: `不支持的父条目类型：${itemType || "空值"}。请使用 Zotero 常规顶层类型，例如 book、journalArticle、report、thesis、document、webpage。` };
    }

    const fields = Object.assign({}, args.fields || {});
    if (args.title && !fields.title) {
      fields.title = args.title;
    }
    if (!fields.title) {
      fields.title = this.defaultParentTitleForAttachment(attachment);
    }
    if (Object.prototype.hasOwnProperty.call(fields, "itemType")) {
      delete fields.itemType;
    }
    if (Object.prototype.hasOwnProperty.call(fields, "itemTypeID")) {
      delete fields.itemTypeID;
    }

    const creators = this.normalizeCreators(args.creators);
    const copyCollections = args.copyCollections !== false;
    const copyTags = args.copyTags !== false;
    const attachmentCollectionIDs = this.itemCollectionIDs(attachment);
    const copiedTags = copyTags ? this.itemTagNames(attachment) : [];

    const parent = new Zotero.Item(itemType);
    parent.libraryID = attachment.libraryID;
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined || value === null) {
        continue;
      }
      try {
        parent.setField(field, value);
      } catch (error) {
        return { ok: false, error: `字段 ${field} 不能用于 ${itemType}：${error}` };
      }
    }
    if (creators.length && typeof parent.setCreators === "function") {
      parent.setCreators(creators);
    }
    for (const tag of copiedTags) {
      parent.addTag(tag);
    }
    await parent.saveTx();
    if (copyCollections && attachmentCollectionIDs.length) {
      await this.addItemToCollectionIDs(parent.id, attachmentCollectionIDs);
    }

    attachment.parentID = parent.id;
    await attachment.saveTx();

    this.undoStack.push({
      type: "detach_attachment_from_parent_item",
      parentItemID: parent.id,
      attachmentItemID: attachment.id,
      attachmentCollectionIDs,
      summary: `撤销为附件创建 ${itemType} 父条目`
    });
    this.markLibraryIndexDirty(this.currentTaskLibraryID());
    return {
      ok: true,
      parentItem: this.itemSummary(parent),
      attachment: this.itemSummary(attachment, {
        parentItemKey: parent.key,
        parentItemID: parent.id
      }),
      copiedCollections: copyCollections ? attachmentCollectionIDs.length : 0,
      copiedTags: copiedTags.length
    };
  },

  async toolReadFulltextPage(args) {
    const itemKey = String(args.itemKey || "").trim();
    if (!itemKey) {
      return { ok: false, error: "itemKey 为空。" };
    }
    const item = await this.getItemByKey(itemKey);
    if (!item) {
      return { ok: false, error: "找不到条目。" };
    }
    const target = this.resolveFulltextTarget(item);
    if (!target) {
      return { ok: false, error: "该条目没有可读取全文的附件。" };
    }
    const fulltextResult = await this.readFulltextText(target);
    if (!fulltextResult.ok) {
      return fulltextResult;
    }
    const text = fulltextResult.text;
    if (!text) {
      return { ok: false, error: "该条目没有可用全文内容。" };
    }
    const offset = Math.max(Number(args.cursor || 0) || 0, 0);
    const slice = text.slice(offset, offset + FULLTEXT_PAGE_CHARS);
    const nextOffset = offset + slice.length;
    const owner = this.resolveOwningItem(item);
    return {
      ok: true,
      library: {
        id: this.currentTaskLibraryID(),
        name: this.getLibraryName(this.currentTaskLibraryID())
      },
      itemKey: owner ? owner.key : item.key,
      attachmentKey: target.key,
      title: owner ? (safeCall(() => owner.getField("title")) || safeCall(() => owner.getDisplayTitle())) : (safeCall(() => item.getField("title")) || safeCall(() => item.getDisplayTitle())),
      cursor: String(offset),
      nextCursor: nextOffset < text.length ? String(nextOffset) : null,
      hasMore: nextOffset < text.length,
      text: slice,
      totalLength: text.length,
      fulltextSource: fulltextResult.source || "unknown",
      indexedOnDemand: !!fulltextResult.indexedOnDemand
    };
  },

  async addItemToCollectionIDs(itemID, collectionIDs) {
    const uniqueIDs = Array.from(new Set((collectionIDs || []).filter(Boolean)));
    if (!uniqueIDs.length) {
      return;
    }
    await Zotero.DB.executeTransaction(async () => {
      for (const collectionID of uniqueIDs) {
        const collection = Zotero.Collections.get(collectionID);
        if (collection) {
          await collection.addItems([itemID]);
        }
      }
    });
  },

  async toolBrowseLibraryItems(args) {
    const libraryID = this.currentTaskLibraryID();
    if (!this.hasSessionReadGrant(libraryID)) {
      return {
        ok: false,
        error: "当前库尚未开放本会话整库元数据读取。请先调用 request_expanded_context。"
      };
    }
    const index = await this.ensureLibraryIndex(libraryID);
    const pageSize = Math.min(Math.max(Number(args.pageSize || DEFAULT_BROWSE_PAGE_SIZE), 1), MAX_BROWSE_PAGE_SIZE);
    const page = Math.max(Number(args.page || 1), 1);
    const filtered = this.filterLibraryItems(index, args);
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    return {
      ok: true,
      library: {
        id: libraryID,
        name: this.getLibraryName(libraryID)
      },
      page,
      pageSize,
      totalCount: filtered.length,
      hasMore: start + pageSize < filtered.length,
      appliedFilters: {
        query: args.query || "",
        collectionKey: args.collectionKey || "",
        includeDescendants: args.includeDescendants !== false,
        tag: args.tag || "",
        creator: args.creator || "",
        year: args.year || ""
      },
      items
    };
  },

  async toolListPluginCommands() {
    const win = this.firstWindow();
    const doc = win && win.document;
    if (!doc) {
      return { ok: false, error: "没有可用的 Zotero 主窗口。" };
    }
    const commands = Array.from(doc.querySelectorAll("menuitem[id]"))
      .map((node) => ({
        id: node.id,
        label: node.getAttribute("label") || node.textContent || "",
        disabled: node.hasAttribute("disabled")
      }))
      .filter((command) => command.id !== "zotero-assistant-tools-menu" && command.label)
      .slice(0, 200);
    return { ok: true, commands };
  },

  async readResponseTextLimited(response, maxBytes) {
    if (!response || !response.body || typeof response.body.getReader !== "function") {
      const text = await response.text();
      return text.length > maxBytes ? text.slice(0, maxBytes) : text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let received = 0;
    let chunks = "";
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      received += value.length;
      if (received > maxBytes) {
        chunks += decoder.decode(value.slice(0, value.length - (received - maxBytes)), { stream: true });
        try {
          await reader.cancel();
        } catch (error) {
          /* ignore */
        }
        break;
      }
      chunks += decoder.decode(value, { stream: true });
    }
    chunks += decoder.decode();
    return chunks;
  },

  readerPageTextMethodAvailable(reader) {
    return this.readerObjectCandidates(reader).some((object) => {
      return ["getPageText", "getPageTextContent", "getTextForPage"].some((name) => typeof object[name] === "function");
    });
  },

  async toolReadLibraryOverview() {
    const libraryID = this.currentTaskLibraryID();
    if (!this.hasSessionReadGrant(libraryID)) {
      return {
        ok: false,
        error: "当前库尚未开放本会话整库元数据读取。请先调用 request_expanded_context。"
      };
    }
    return this.getLibraryOverviewPayload(libraryID);
  },

  async toolTriggerPluginCommand(args) {
    const win = this.firstWindow();
    const doc = win && win.document;
    const node = doc && doc.getElementById(args.commandId);
    if (!node) {
      return { ok: false, error: "找不到已发现的插件命令。" };
    }
    node.dispatchEvent(new win.Event("command", { bubbles: true, cancelable: true }));
    this.markAllIndexesDirty();
    return { ok: true, commandId: args.commandId };
  },

  async toolRequestClarification(args) {
    this.task.status = "waiting";
    this.task.phase = "needs_user";
    this.task.pendingApproval = null;
    const questionText = [
      args.question || this.t("needTaskClarification"),
      args.recommendedAnswer ? this.t("recommendedAnswer", { answer: args.recommendedAnswer }) : ""
    ].filter(Boolean).join("\n");
    this.flushChatTurnToDisplay();
    const state = this.firstState();
    if (state) {
      this.showMessage(state, questionText);
    }
    return { ok: true, waitingForUser: true };
  },

  async toolAddItemsToCollection(args) {
    const collection = await this.getCollectionByKey(args.collectionKey);
    if (!collection) {
      return { ok: false, error: "找不到目标 collection。" };
    }
    const itemIDs = [];
    for (const key of args.itemKeys || []) {
      const item = await this.getItemByKey(key);
      if (item) {
        itemIDs.push(item.id);
      }
    }
    if (itemIDs.length > MAX_ITEMS_PER_MODEL_ROUND) {
      return { ok: false, error: `本轮模型调用单次加入分类不得超过 ${MAX_ITEMS_PER_MODEL_ROUND} 条。请分批或在下一轮继续。` };
    }
    const before = new Set(collection.getChildItems(true));
    await Zotero.DB.executeTransaction(async () => {
      await collection.addItems(itemIDs);
    });
    await collection.loadDataType("childItems", true);
    const after = new Set(collection.getChildItems(true));
    const added = itemIDs.filter((id) => after.has(id) && !before.has(id));
    const missing = itemIDs.filter((id) => !after.has(id));
    this.undoStack.push({
      type: "remove_items_from_collection",
      collectionID: collection.id,
      itemIDs: added,
      summary: `撤销加入 ${collection.name} 的 ${added.length} 个条目`
    });
    this.markLibraryIndexDirty(this.currentTaskLibraryID());
    return {
      ok: missing.length === 0,
      addedCount: added.length,
      skippedCount: itemIDs.length - added.length - missing.length,
      missingItemIDs: missing,
      error: missing.length ? `有 ${missing.length} 个条目未能加入目标 collection。` : null
    };
  },

  defaultParentTitleForAttachment(attachment) {
    return safeCall(() => attachment.getField("title"))
      || safeCall(() => attachment.getDisplayTitle())
      || safeCall(() => attachment.attachmentFilename)
      || "Imported attachment";
  },

  async getLibraryOverviewPayload(libraryID) {
    const index = await this.ensureLibraryIndex(libraryID);
    return {
      ok: true,
      library: {
        id: libraryID,
        name: index.libraryName
      },
      builtAt: index.builtAt,
      totals: {
        topLevelItems: index.items.length,
        collections: index.collections.length,
        notes: index.noteCount,
        annotations: index.annotationCount
      },
      itemTypes: index.itemTypeStats,
      topTags: index.tagStats.slice(0, MAX_OVERVIEW_TAGS),
      collectionTree: index.collections.slice(0, MAX_OVERVIEW_COLLECTIONS).map((collection) => ({
        key: collection.key,
        name: collection.name,
        level: collection.level,
        itemCount: collection.itemCount,
        childCollectionCount: collection.childCollectionCount
      })),
      collectionTreeTruncated: index.collections.length > MAX_OVERVIEW_COLLECTIONS
    };
  },

  async readFulltextFromModernAPI(fulltext, item) {
    const contentType = String(item && item.attachmentContentType || "").trim();
    if (!fulltext || typeof fulltext.getItemCacheFile !== "function") {
      return { text: "", source: "", usedCache: false };
    }

    const cacheFile = fulltext.getItemCacheFile(item);
    const cachePath = cacheFile && cacheFile.path;
    if (cachePath && await this.pathExists(cachePath)) {
      const text = await this.readAttachmentTextFromPath(cachePath, "utf-8");
      if (text) {
        return { text, source: "zotero9-cache", usedCache: true };
      }
    }

    const isTextType = !!(Zotero.MIME && typeof Zotero.MIME.isTextType === "function" && Zotero.MIME.isTextType(contentType));
    if (isTextType && typeof item.getFilePathAsync === "function") {
      const filePath = await item.getFilePathAsync();
      if (filePath && await this.pathExists(filePath)) {
        const text = await this.readAttachmentTextFromPath(filePath, item.attachmentCharset);
        if (text) {
          return { text, source: "zotero9-source-file", usedCache: false };
        }
      }
    }

    return { text: "", source: "", usedCache: false };
  },

  async readAttachmentTextFromPath(path, charset) {
    if (!path || !Zotero.File || typeof Zotero.File.getContentsAsync !== "function") {
      return "";
    }
    try {
      const content = await Zotero.File.getContentsAsync(path, charset || undefined);
      return normalizeFulltextContent(content);
    } catch (error) {
      return "";
    }
  },

  async toolReadCurrentReaderPages() {
    const state = await this.getActiveReaderState();
    if (!state.ok) {
      await this.maybeWriteDebugReport("reader_page_unavailable", {
        reason: state.error,
        reader: this.readerDebugSnapshot(state)
      });
      return { ok: false, error: state.error || "无法读取当前阅读器页面。" };
    }
    const attachment = state.attachment;
    if (attachment.libraryID !== this.currentTaskLibraryID()) {
      return {
        ok: false,
        error: "当前阅读器附件不属于任务绑定库。为避免跨库读取，本工具已拒绝读取。",
        readerLibraryID: attachment.libraryID,
        taskLibraryID: this.currentTaskLibraryID()
      };
    }
    const pageInfo = state.pageInfo || {};
    if (!Number.isInteger(pageInfo.pageIndex)) {
      await this.maybeWriteDebugReport("reader_page_unavailable", {
        reason: "无法取得当前阅读器页码。",
        reader: this.readerDebugSnapshot(state)
      });
      return { ok: false, error: "已找到当前 Reader，但无法取得当前页码。" };
    }
    if (!state.textAPIAvailable) {
      await this.maybeWriteDebugReport("reader_page_unavailable", {
        reason: "Reader 没有暴露页面文本接口。",
        reader: this.readerDebugSnapshot(state)
      });
      return {
        ok: false,
        error: this.isEPUBAttachment(attachment)
          ? "当前 EPUB Reader 已找到，但没有暴露可用的页面文本接口。"
          : "当前 Reader 没有暴露可用的页面文本接口。"
      };
    }

    const indexes = [];
    for (let index = pageInfo.pageIndex - READER_NEIGHBOR_PAGE_RADIUS; index <= pageInfo.pageIndex + READER_NEIGHBOR_PAGE_RADIUS; index++) {
      if (index < 0) {
        continue;
      }
      if (Number.isInteger(pageInfo.totalPages) && index >= pageInfo.totalPages) {
        continue;
      }
      indexes.push(index);
    }
    const annotationItems = await this.annotationItemsForAttachment(attachment);
    const pages = [];
    const warnings = [];
    let textAPIFailure = null;
    for (const index of indexes) {
      const label = this.readerPageLabel(state.pdfApp, index) || this.readerEPUBPageLabel(state.reader, index) || String(index + 1);
      let pageText = "";
      let source = "";
      let textAvailable = false;
      try {
        const textResult = await this.readReaderPageText(state, index);
        textAvailable = !!textResult.available;
        source = textResult.source || "";
        pageText = textResult.text || "";
        if (!textAvailable && textResult.error) {
          textAPIFailure = textResult.error;
        }
      } catch (error) {
        textAPIFailure = String(error);
        warnings.push(`第 ${index + 1} 页读取失败：${error}`);
      }
      const clipped = pageText.length > READER_PAGE_CHARS ? pageText.slice(0, READER_PAGE_CHARS) : pageText;
      pages.push({
        pageIndex: index,
        pageNumber: index + 1,
        pageLabel: label,
        isCurrentPage: index === pageInfo.pageIndex,
        text: clipped,
        textLength: pageText.length,
        textTruncated: pageText.length > READER_PAGE_CHARS,
        textSource: source,
        noTextReason: pageText ? "" : (textAvailable ? "该页没有可读文本，可能是扫描页或文本缓存为空。" : (textAPIFailure || "页面文本接口不可用。")),
        annotations: annotationItems
          .filter((annotation) => this.annotationMatchesPage(annotation, index, label))
          .map((annotation) => this.annotationSummary(annotation))
      });
    }
    const owner = state.owner;
    const hasAnyText = pages.some((page) => !!page.text);
    if (!hasAnyText) {
      warnings.push("当前页窗口没有可读文本；未做 OCR，也未从全文索引猜测页面内容。");
    }
    this.log("reader.pages.read", {
      itemKey: owner ? owner.key : "",
      attachmentKey: attachment.key,
      currentPage: pageInfo.pageNumber,
      pageCount: pages.length,
      textPageCount: pages.filter((page) => page.text).length
    });
    return {
      ok: true,
      library: {
        id: attachment.libraryID,
        name: this.getLibraryName(attachment.libraryID)
      },
      item: owner ? this.itemSummary(owner) : null,
      attachment: {
        id: attachment.id,
        key: attachment.key,
        title: safeCall(() => attachment.getField("title")) || safeCall(() => attachment.getDisplayTitle()),
        contentType: String(attachment.attachmentContentType || ""),
        kind: this.attachmentKind(attachment)
      },
      reader: {
        tabID: state.tabID || "",
        currentPageIndex: pageInfo.pageIndex,
        currentPageNumber: pageInfo.pageNumber,
        currentPageLabel: pageInfo.pageLabel || String(pageInfo.pageNumber || ""),
        totalPages: pageInfo.totalPages,
        usePhysicalPageNumbers: !!pageInfo.usePhysicalPageNumbers
      },
      pageWindow: {
        radius: READER_NEIGHBOR_PAGE_RADIUS,
        requestedPageIndexes: indexes
      },
      hasAnyText,
      warnings,
      pages
    };
  },

  async annotationItemsForAttachment(attachment) {
    let raw = await this.resolveMaybePromise(safeCall(() => attachment.getAnnotations && attachment.getAnnotations()));
    if (!Array.isArray(raw) || !raw.length) {
      raw = await this.resolveMaybePromise(safeCall(() => Zotero.Items.getByParentAsync && Zotero.Items.getByParentAsync(attachment.id)));
    }
    if (!Array.isArray(raw) || !raw.length) {
      raw = await this.resolveMaybePromise(safeCall(() => Zotero.Items.getByParent && Zotero.Items.getByParent(attachment.id)));
    }
    if (!Array.isArray(raw) || !raw.length) {
      const allItems = await this.resolveMaybePromise(safeCall(() => Zotero.Items.getAll && Zotero.Items.getAll(attachment.libraryID)));
      raw = Array.isArray(allItems) ? allItems.filter((item) => item && item.parentID === attachment.id) : [];
    }
    return (Array.isArray(raw) ? raw : [])
      .map((entry) => typeof entry === "number" ? Zotero.Items.get(entry) : entry)
      .filter((item) => item && this.isAnnotationItem(item));
  }
};
})();
