var ZoteroAssistantConstants = (() => {
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const PREF_PREFIX = "extensions.zoteroAssistant.";
  const PREFS = {
    baseURL: PREF_PREFIX + "baseURL",
    apiKey: PREF_PREFIX + "apiKey",
    model: PREF_PREFIX + "model",
    auditModel: PREF_PREFIX + "auditModel",
    apiMode: PREF_PREFIX + "apiMode",
    safetyMode: PREF_PREFIX + "safetyMode",
    debugMode: PREF_PREFIX + "debugMode",
    debugOutputDir: PREF_PREFIX + "debugOutputDir",
    rememberedApprovals: PREF_PREFIX + "rememberedApprovals",
    eventLog: PREF_PREFIX + "eventLog",
    braveSearchApiKey: PREF_PREFIX + "braveSearchApiKey",
    webSearchProvider: PREF_PREFIX + "webSearchProvider",
    metadataSemanticScholarEnabled: PREF_PREFIX + "metadataSemanticScholarEnabled",
    metadataSemanticScholarApiKey: PREF_PREFIX + "metadataSemanticScholarApiKey",
    metadataPubMedEnabled: PREF_PREFIX + "metadataPubMedEnabled",
    metadataPubMedApiKey: PREF_PREFIX + "metadataPubMedApiKey",
    metadataPubMedEmail: PREF_PREFIX + "metadataPubMedEmail",
    uiLanguage: PREF_PREFIX + "uiLanguage",
    selectionAskShortcut: PREF_PREFIX + "selectionAskShortcut",
    sessionMemoryEnabled: PREF_PREFIX + "sessionMemoryEnabled",
    autoCompressionEnabled: PREF_PREFIX + "autoCompressionEnabled",
    contextCompressionTriggerChars: PREF_PREFIX + "contextCompressionTriggerChars",
    contextCompressionTargetChars: PREF_PREFIX + "contextCompressionTargetChars",
    contextCompressionKeepMessages: PREF_PREFIX + "contextCompressionKeepMessages",
    contextCompressionMaxTokens: PREF_PREFIX + "contextCompressionMaxTokens",
    contextCompressionTargetTokens: PREF_PREFIX + "contextCompressionTargetTokens"
  };

  const DEFAULT_BASE_URL = "https://api.openai.com/v1";
  const DEFAULT_MODEL = "gpt-4.1-mini";
  const DEFAULT_AUDIT_MODEL = "";
  const DEFAULT_API_MODE = "auto";
  const DEFAULT_SAFETY_MODE = "review";
  const DEFAULT_UI_LANGUAGE = "auto";
  const DEFAULT_SELECTION_ASK_SHORTCUT = "Ctrl+Alt+Q";
  const DEFAULT_SESSION_MEMORY_ENABLED = true;
  const DEFAULT_AUTO_COMPRESSION_ENABLED = true;
  const DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS = 80000;
  const DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS = 8000;
  const DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES = 12;
  const DEFAULT_CONTEXT_COMPRESSION_MAX_TOKENS = 128000;
  const DEFAULT_CONTEXT_COMPRESSION_TARGET_TOKENS = 16000;
  const CHARS_PER_TOKEN_ESTIMATE = 4;
  const DEFAULT_CONTEXT_COMPRESSION_TRIGGER_MESSAGES = 80;
  const CHAT_MINIMIZED_HEIGHT = 52;
  const CHAT_MIN_WIDTH = 300;
  const CHAT_MIN_HEIGHT = 280;
  const CHAT_DEFAULT_WIDTH = 520;
  const CHAT_DEFAULT_HEIGHT = 640;
  const CHAT_DRAWER_WIDTH = 240;
  const CHAT_DRAWER_LOG_PREVIEW = 4;
  const MAX_CHAT_DISPLAY_LOG = 200;
  const MAX_CHAT_DISPLAY_CHARS = 24000;
  const COMPRESSED_CONTEXT_MARKER = "[Zotero Assistant compressed task context]";
  const PREF_PANE_ID = "zotero-prefpane-zotero-assistant";
  const LOG_RETENTION_DAYS = 30;
  const MAX_MODEL_RETRIES = 3;
  const MAX_MODEL_FETCH_MS = 180000;
  const AUDIT_FETCH_TIMEOUT_MS = 15000;
  const MAX_COLLECTIONS_PER_MODEL_ROUND = 2;
  const MAX_ITEMS_PER_MODEL_ROUND = 25;
  const MAX_CONTEXT_SELECTED_ITEMS = 100;
  const SELECTION_ASK_MAX_CHARS = 4000;
  const MAX_TASK_LOOPS = 50;
  const DEFAULT_BROWSE_PAGE_SIZE = 25;
  const MAX_BROWSE_PAGE_SIZE = 50;
  const FULLTEXT_PAGE_CHARS = 4000;
  const READER_PAGE_CHARS = 4000;
  const READER_NEIGHBOR_PAGE_RADIUS = 1;
  const NOTE_PREVIEW_LENGTH = 160;
  const ABSTRACT_PREVIEW_LENGTH = 280;
  const MAX_OVERVIEW_TAGS = 20;
  const MAX_OVERVIEW_COLLECTIONS = 200;
  const MAX_LIVE_SEARCH_PER_MODEL_ROUND = 4;
  const LEGACY_WEB_SEARCH_TOOL = "web_search";
  const LIVE_SEARCH_TOOL = "live_search";
  const MAX_WEB_FETCH_PER_MODEL_ROUND = 5;
  const MAX_WEB_SEARCH_RESULTS = 10;
  const WEB_FETCH_TIMEOUT_MS = 30000;
  const WEB_FETCH_MAX_BYTES = 512000;
  const WEB_FETCH_MAX_CHARS = 60000;
  const MAX_METADATA_LOOKUP_ITEMS = 5;
  const MAX_METADATA_LOOKUP_PER_MODEL_ROUND = 5;
  const MAX_METADATA_CANDIDATES_PER_ITEM = 3;
  const MAX_METADATA_ADHOC_CANDIDATES = 10;
  const MAX_METADATA_SOURCE_REQUESTS_PER_ITEM = 14;
  const METADATA_TEXT_PROBE_CHARS = 8000;
  const MAX_CREATED_ITEMS_PER_MODEL_ROUND = 5;
  const MAX_EXPORT_ITEMS = 50;
  const MAX_EXPORT_PER_MODEL_ROUND = 4;
  const MAX_EXPORT_TEXT_CHARS = 60000;
  const MAX_BATCH_STEPS = 50;
  const MAX_BATCH_TOTAL_ITEMS = 500;
  const BATCH_ALLOWED_TOOLS = new Set([
    "create_note",
    "add_tags",
    "add_items_to_collection",
    "create_collection",
    "update_metadata",
    "move_to_trash"
  ]);
  const DEBUG_TEXT_LIMIT = 16000;
  const DEBUG_MESSAGE_LIMIT = 6000;
  const DEBUG_MESSAGE_TAIL = 20;
  const COMPRESSION_MESSAGE_SERIALIZE_LIMIT = 24000;
  const MEMORY_MESSAGE_SERIALIZE_LIMIT = 1800;
  const MEMORY_RECENT_MESSAGE_LIMIT = 30;
  const DEFAULT_PREF_PAGE_SIZE = 50;
  const MAX_PREF_PAGE_SIZE = 200;
  const WEB_SEARCH_USER_AGENT = "Zotero-Assistant/0.3 (research; +https://example.com/zotero-assistant)";
  const INDEX_NOTIFIER_TYPES = ["item", "collection", "collection-item", "item-tag", "tag"];

  const SESSION_GRANT_TOOL = "request_expanded_context";
  const REQUEST_READ_APPROVAL_TOOL = "request_read_approval";
  const SENSITIVE_READ_TOOLS = new Set(["read_fulltext_page", "read_current_reader_pages"]);

  const READ_TOOLS = new Set([
    "search_items",
    "read_current_context",
    "read_item_fields",
    "read_current_reader_pages",
    "read_library_overview",
    "browse_library_items",
    "read_fulltext_page",
    "list_plugin_commands",
    "browse_preferences",
    "search_preferences",
    "read_preferences",
    "list_preference_panes",
    "open_zotero_preferences",
    "live_search",
    "web_fetch",
    "lookup_metadata_candidates",
    "list_export_formats"
  ]);

  const LOW_RISK_WRITE_TOOLS = new Set([
    "create_collection",
    "add_tags",
    "create_note",
    "append_note",
    "add_items_to_collection"
  ]);

  const HIGH_RISK_WRITE_TOOLS = new Set([
    "create_item",
    "create_parent_item",
    "update_metadata",
    "set_preference",
    "request_zotero_restart",
    "move_to_trash",
    "trigger_plugin_command"
  ]);

  const TOOL_DEFINITIONS = [
    {
      type: "function",
      function: {
        name: "request_clarification",
        description: "Ask the user for missing high-impact task information before taking action.",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string" },
            recommendedAnswer: { type: "string" }
          },
          required: ["question"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "search_items",
        description: "Search Zotero items by title, creator, year, or broad quick-search text.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number" }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_current_context",
        description: "Read current Zotero selection, current collection, visible item summary, and a lightweight current reader hint without page text.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "request_expanded_context",
        description: "Ask the user to allow session-scoped metadata access for the current active Zotero library.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string" },
            scope: { type: "string" }
          },
          required: ["reason", "scope"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_item_fields",
        description: "Read a Zotero item's full right-pane metadata fields, current values, and creators for targeted enrichment.",
        parameters: {
          type: "object",
          properties: {
            itemKey: { type: "string" }
          },
          required: ["itemKey"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_library_overview",
        description: "Read the current task library overview after session metadata access has been granted.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browse_library_items",
        description: "Browse library item metadata in pages after session metadata access has been granted.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            collectionKey: { type: "string" },
            includeDescendants: { type: "boolean" },
            tag: { type: "string" },
            creator: { type: "string" },
            year: { type: "string" },
            page: { type: "number" },
            pageSize: { type: "number" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_fulltext_page",
        description: "Read one page of full text for a single item or attachment. This is auto-approved but must be explicitly called.",
        parameters: {
          type: "object",
          properties: {
            itemKey: { type: "string" },
            cursor: { type: "string" }
          },
          required: ["itemKey"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_current_reader_pages",
        description: "Read the current foreground Zotero reader page plus the previous and next page. Returns page text and annotation/comment summaries. Does not use selected items as fallback.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "request_read_approval",
        description: "In review safety mode, declare intent to read full text, reader pages, or a large library scope before calling the actual read tool. Returns whether the read is approved and the AI reviewer's risk assessment. Call this before read_fulltext_page, read_current_reader_pages, or a broad browse_library_items request when safetyMode is review.",
        parameters: {
          type: "object",
          properties: {
            targetTool: { type: "string", description: "The read tool you intend to call next, e.g. read_fulltext_page." },
            reason: { type: "string", description: "Why this read is needed for the current task, in one short sentence." },
            scopeHint: { type: "string", description: "Optional hint about the scope/size of the read, e.g. itemKey or number of items." }
          },
          required: ["targetTool", "reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "live_search",
        description: "Search the public web for recent information (live search). Returns titles, URLs, and snippets. Use for verifying facts, DOIs, publication metadata, or topics not in the Zotero library. Do not call web_search — that name is deprecated; use live_search only.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (min 2 characters)." },
            allowed_domains: {
              type: "array",
              items: { type: "string" },
              description: "If set, only include results from these domains (e.g. scholar.google.com)."
            },
            blocked_domains: {
              type: "array",
              items: { type: "string" },
              description: "Exclude results from these domains."
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "web_fetch",
        description: "Fetch a public HTTP(S) URL and return page content as markdown-like text (similar to Claude Code WebFetch). Optionally include a prompt describing what to extract; the returned body is for you to read and answer from. Do not use for authenticated or private URLs.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "HTTP or HTTPS URL to fetch." },
            prompt: {
              type: "string",
              description: "What you need from this page (e.g. 'Extract the publication date and abstract')."
            }
          },
          required: ["url", "prompt"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "lookup_metadata_candidates",
        description: "Look up bibliographic metadata from authoritative public sources (Crossref, OpenAlex, arXiv, Open Library, Google Books, etc.). Read-only; never writes to Zotero. Use itemKeys for existing Zotero items or attachments (optionally with useTextProbe). Use query (+ optional hints) when the user has no library item yet — e.g. title, DOI, arXiv, ISBN, or author+year. Do not use for local library search (use search_items) or non-bibliographic web pages (use live_search). For low-confidence or multiple close candidates, ask the user before write tools.",
        parameters: {
          type: "object",
          properties: {
            itemKeys: {
              type: "array",
              items: { type: "string" },
              description: "Zotero item or attachment keys to look up. Max 5. Omit when using query."
            },
            query: {
              type: "string",
              description: "Free-text bibliographic search (min 2 characters): title, authors, DOI, arXiv ID, ISBN, PMID, or mixed. Use when there is no itemKey yet."
            },
            hints: {
              type: "object",
              description: "Optional structured hints to improve adhoc query matching.",
              properties: {
                creators: { type: "string", description: "Author names, semicolon-separated if multiple." },
                year: { type: "string", description: "Publication year." },
                doi: { type: "string" },
                isbn: { type: "string" },
                arxiv: { type: "string" },
                pmid: { type: "string" }
              }
            },
            useTextProbe: {
              type: "boolean",
              description: "Item mode only: read a small PDF/EPUB/full-text snippet for identifiers when fields are insufficient. Defaults to true. Ignored for query-only lookups."
            },
            reason: {
              type: "string",
              description: "Why online metadata lookup is needed, especially if useTextProbe may read local document text."
            }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_collection",
        description: "Create a Zotero collection. A task may create at most five collections automatically.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            parentKey: { type: "string" }
          },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_item",
        description: "Create a new top-level Zotero bibliographic item from chosen metadata. High risk: use only after the user has selected or accepted candidate metadata. Does not create or download attachments.",
        parameters: {
          type: "object",
          properties: {
            itemType: {
              type: "string",
              description: "Regular Zotero item type such as book, journalArticle, report, thesis, document, webpage, preprint, or conferencePaper. attachment, note, and annotation are not allowed."
            },
            fields: {
              type: "object",
              description: "Zotero fields to set on the new item, e.g. title, ISBN, DOI, publisher, date, publicationTitle, url, abstractNote. Do not include itemType or itemTypeID."
            },
            creators: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  name: { type: "string" },
                  creatorType: { type: "string" }
                }
              }
            },
            collectionKey: {
              type: "string",
              description: "Optional collection key in the task-bound library to add the new item to."
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags to add to the new item."
            },
            reason: {
              type: "string",
              description: "Why this new Zotero item should be created. Shown in the approval card."
            }
          },
          required: ["itemType", "fields"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "add_items_to_collection",
        description: "Add items to a collection without removing them from existing collections.",
        parameters: {
          type: "object",
          properties: {
            collectionKey: { type: "string" },
            itemKeys: { type: "array", items: { type: "string" } }
          },
          required: ["collectionKey", "itemKeys"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "add_tags",
        description: "Add tags to Zotero items.",
        parameters: {
          type: "object",
          properties: {
            itemKeys: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } }
          },
          required: ["itemKeys", "tags"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_note",
        description: "Create a child note for an item.",
        parameters: {
          type: "object",
          properties: {
            parentItemKey: { type: "string" },
            html: { type: "string" }
          },
          required: ["parentItemKey", "html"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_parent_item",
        description: "Create a new regular Zotero parent item for a top-level attachment, optionally seed metadata, and move the attachment under the new parent item.",
        parameters: {
          type: "object",
          properties: {
            attachmentKey: { type: "string" },
            itemType: { type: "string", description: "Regular Zotero item type such as book, journalArticle, report, thesis, document, or webpage." },
            title: { type: "string" },
            fields: { type: "object" },
            creators: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  name: { type: "string" },
                  creatorType: { type: "string" }
                }
              }
            },
            copyCollections: { type: "boolean" },
            copyTags: { type: "boolean" }
          },
          required: ["attachmentKey", "itemType"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_metadata",
        description: "Update item metadata. This is high risk and requires approval outside fully open mode.",
        parameters: {
          type: "object",
          properties: {
            itemKey: { type: "string" },
            fields: { type: "object" },
            creators: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  name: { type: "string" },
                  creatorType: { type: "string" }
                }
              }
            }
          },
          required: ["itemKey"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "set_preference",
        description: "Set an existing non-sensitive Zotero or plugin preference. Do not use for API keys, tokens, passwords, or secrets.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: {},
            rememberPrefix: {
              type: "string",
              description: "Optional prefix to propose for session-scoped remembered approval, e.g. extensions.somePlugin."
            },
            reason: { type: "string" }
          },
          required: ["name", "value"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browse_preferences",
        description: "Browse Zotero and plugin preferences hierarchically by prefix. Start with an empty prefix, then drill into returned child prefixes.",
        parameters: {
          type: "object",
          properties: {
            prefix: { type: "string", description: "Prefix to browse, such as extensions. or extensions.zoteroAssistant. Empty means the allowed roots." },
            query: { type: "string", description: "Optional name/value search within this prefix." },
            limit: { type: "number" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "search_preferences",
        description: "Search Zotero and installed-plugin preferences by name or non-sensitive value.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            prefix: { type: "string" },
            limit: { type: "number" }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_preferences",
        description: "Read Zotero and installed-plugin preference metadata and current values. Sensitive values are masked and never returned.",
        parameters: {
          type: "object",
          properties: {
            names: { type: "array", items: { type: "string" } },
            prefix: { type: "string" },
            limit: { type: "number" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_preference_panes",
        description: "List Zotero built-in and installed-plugin preference panes (id, label, pluginID). Use the id with open_zotero_preferences.pane_id to open a specific page (e.g. another plugin's settings).",
        parameters: {
          type: "object",
          properties: {
            plugin_id: { type: "string", description: "Optional filter: only panes registered by this plugin ID (e.g. zotero-assistant@example.com)." },
            query: { type: "string", description: "Optional filter: case-insensitive match on pane label or id." },
            limit: { type: "number" }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "open_zotero_preferences",
        description: "Open the Zotero preferences window. Omit pane_id for this assistant's pane, or pass pane_id from list_preference_panes (built-in or another plugin). Use for sensitive API keys or when the user should configure UI manually.",
        parameters: {
          type: "object",
          properties: {
            pane_id: { type: "string", description: "Preference pane id, e.g. zotero-prefpane-general or zotero-prefpane-zotero-assistant." },
            reason: { type: "string" },
            scroll_to: { type: "string", description: "Optional element id inside the pane to scroll to (Zotero navigateToPane scrollTo)." }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "request_zotero_restart",
        description: "Request explicit user authorization to restart Zotero after a setting change that needs restart.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string" }
          },
          required: ["reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "move_to_trash",
        description: "Move Zotero items to trash. Permanent deletion is never exposed.",
        parameters: {
          type: "object",
          properties: {
            itemKeys: { type: "array", items: { type: "string" } },
            reason: { type: "string" }
          },
          required: ["itemKeys", "reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_plugin_commands",
        description: "List discoverable Zotero and plugin menu commands that can be requested through trigger_plugin_command.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "trigger_plugin_command",
        description: "Trigger a discovered and specifically authorized plugin menu command.",
        parameters: {
          type: "object",
          properties: {
            commandId: { type: "string" },
            summary: { type: "string" }
          },
          required: ["commandId", "summary"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_export_formats",
        description: "List the citation/export formats available in this Zotero installation (BibTeX, RIS, Zotero RDF, CSL JSON, etc.). Returns translatorID, label, and labelShort for each. Call this before export_items_citation so you can pass an exact format the user asked for.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "export_items_citation",
        description: "Export a set of Zotero items to a citation format (BibTeX, RIS, etc.) and return the exported text in chat. By default this is a read: it returns the text and writes nothing. If saveToPath is provided, the exported text is also written to that file path on disk (high-risk, requires approval). Always call list_export_formats first to get valid format IDs/labels, unless the user named a common format you can match by label (e.g. BibTeX, RIS).",
        parameters: {
          type: "object",
          properties: {
            itemKeys: {
              type: "array",
              items: { type: "string" },
              description: "Zotero item keys to export. Resolved via the bound task library. Max 50 per call."
            },
            format: {
              type: "string",
              description: "Citation format: either a translatorID from list_export_formats (preferred) or a translator label/labelShort matched case-insensitively. Examples: '9cb70025-a888-4a29-8acc-30763b5c0394' (BibTeX), 'RIS', 'Zotero RDF'."
            },
            saveToPath: {
              type: "string",
              description: "Optional absolute or relative file path. If provided, the exported text is written to this path in addition to being returned in chat. Relative paths resolve against the debug output directory. Omit to keep the result in chat only."
            },
            reason: {
              type: "string",
              description: "One short sentence explaining why the export (and especially the file write, if any) is needed. Shown on the approval card when saveToPath is set."
            }
          },
          required: ["itemKeys", "format"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "run_batch_plan",
        description: "Execute a batch of write operations whose keys are already resolved (batch create notes, add tags, update metadata, add to collection). Runs all steps locally in one call, which is faster and cheaper than calling the individual tools one-by-one over many model rounds. Before calling, you MUST have resolved every itemKey/collectionKey/parentItemKey via search_items/read_current_context/read_item_fields and filled them into the plan. Cross-step references are NOT supported inside one plan (e.g. creating a collection and then using its key in a later step must be two separate rounds, not one batch). Only concrete write tools are allowed in the plan (no clarification/finish/read/export tools). The whole plan needs approval when it contains any write, and high-risk steps (update_metadata, move_to_trash) are flagged on the approval card.",
        parameters: {
          type: "object",
          properties: {
            plan: {
              type: "array",
              description: "Ordered list of steps. Each step: { tool: string, args: object, label?: string }. tool must be one of the allowed batch tools; args are that tool's parameters with keys already resolved.",
              items: {
                type: "object",
                properties: {
                  tool: { type: "string" },
                  args: { type: "object" },
                  label: { type: "string", description: "Short human-readable description of this step, shown on the approval card." }
                },
                required: ["tool", "args"]
              }
            },
            reason: { type: "string", description: "Why this batch is needed, in one short sentence. Shown on the approval card." }
          },
          required: ["plan"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "finish_task",
        description: "End the task ONLY after you have explained results to the user in the selected UI language unless the user explicitly requested another language. summary is mandatory user-facing text (what you tell the user). If you have not sent any other user-visible message this task, summary must be a full explanation (not just 'done').",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Required user-facing message in the selected UI language: what was done, results, and next steps." }
          },
          required: ["summary"]
        }
      }
    }
  ];

  return {
    HTML_NS, PREF_PREFIX, PREFS, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_AUDIT_MODEL, DEFAULT_API_MODE, DEFAULT_SAFETY_MODE, DEFAULT_UI_LANGUAGE, DEFAULT_SELECTION_ASK_SHORTCUT, DEFAULT_SESSION_MEMORY_ENABLED, DEFAULT_AUTO_COMPRESSION_ENABLED, DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS, DEFAULT_CONTEXT_COMPRESSION_TARGET_CHARS, DEFAULT_CONTEXT_COMPRESSION_KEEP_MESSAGES, DEFAULT_CONTEXT_COMPRESSION_MAX_TOKENS, DEFAULT_CONTEXT_COMPRESSION_TARGET_TOKENS, CHARS_PER_TOKEN_ESTIMATE, DEFAULT_CONTEXT_COMPRESSION_TRIGGER_MESSAGES, CHAT_MINIMIZED_HEIGHT, CHAT_MIN_WIDTH, CHAT_MIN_HEIGHT, CHAT_DEFAULT_WIDTH, CHAT_DEFAULT_HEIGHT, CHAT_DRAWER_WIDTH, CHAT_DRAWER_LOG_PREVIEW, MAX_CHAT_DISPLAY_LOG, MAX_CHAT_DISPLAY_CHARS, COMPRESSED_CONTEXT_MARKER, PREF_PANE_ID, LOG_RETENTION_DAYS, MAX_MODEL_RETRIES, MAX_MODEL_FETCH_MS, AUDIT_FETCH_TIMEOUT_MS, MAX_COLLECTIONS_PER_MODEL_ROUND, MAX_ITEMS_PER_MODEL_ROUND, MAX_CONTEXT_SELECTED_ITEMS, SELECTION_ASK_MAX_CHARS, MAX_TASK_LOOPS, DEFAULT_BROWSE_PAGE_SIZE, MAX_BROWSE_PAGE_SIZE, FULLTEXT_PAGE_CHARS, READER_PAGE_CHARS, READER_NEIGHBOR_PAGE_RADIUS, NOTE_PREVIEW_LENGTH, ABSTRACT_PREVIEW_LENGTH, MAX_OVERVIEW_TAGS, MAX_OVERVIEW_COLLECTIONS, MAX_LIVE_SEARCH_PER_MODEL_ROUND, LEGACY_WEB_SEARCH_TOOL, LIVE_SEARCH_TOOL, MAX_WEB_FETCH_PER_MODEL_ROUND, MAX_WEB_SEARCH_RESULTS, WEB_FETCH_TIMEOUT_MS, WEB_FETCH_MAX_BYTES, WEB_FETCH_MAX_CHARS, MAX_METADATA_LOOKUP_ITEMS, MAX_METADATA_LOOKUP_PER_MODEL_ROUND, MAX_METADATA_CANDIDATES_PER_ITEM, MAX_METADATA_ADHOC_CANDIDATES, MAX_METADATA_SOURCE_REQUESTS_PER_ITEM, METADATA_TEXT_PROBE_CHARS, MAX_CREATED_ITEMS_PER_MODEL_ROUND, MAX_EXPORT_ITEMS, MAX_EXPORT_PER_MODEL_ROUND, MAX_EXPORT_TEXT_CHARS, MAX_BATCH_STEPS, MAX_BATCH_TOTAL_ITEMS, BATCH_ALLOWED_TOOLS, DEBUG_TEXT_LIMIT, DEBUG_MESSAGE_LIMIT, DEBUG_MESSAGE_TAIL, COMPRESSION_MESSAGE_SERIALIZE_LIMIT, MEMORY_MESSAGE_SERIALIZE_LIMIT, MEMORY_RECENT_MESSAGE_LIMIT, DEFAULT_PREF_PAGE_SIZE, MAX_PREF_PAGE_SIZE, WEB_SEARCH_USER_AGENT, INDEX_NOTIFIER_TYPES, SESSION_GRANT_TOOL, REQUEST_READ_APPROVAL_TOOL, SENSITIVE_READ_TOOLS, READ_TOOLS, LOW_RISK_WRITE_TOOLS, HIGH_RISK_WRITE_TOOLS, TOOL_DEFINITIONS
  };
})();
