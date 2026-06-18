# Zotero Assistant

[中文介绍](docs/README.zh-CN.md)

Zotero Assistant is an in-client AI assistant for Zotero 9. It adds a chat-based task interface inside Zotero so you can ask it to organize references, read the current PDF or EPUB page, create notes, update metadata, manage tags and collections, and operate other Zotero plugin commands.

The plugin runs inside Zotero. It does not require a separate desktop app, and it does not connect your Zotero library to an external control service. Model requests are sent only to the AI API endpoint that you configure.

## Features

- Organize selected references into collections.
- Add tags to selected or searched items.
- Read item metadata, annotations, notes, indexed full text, and the current reader page.
- Support current-page reading in Zotero PDF and EPUB readers.
- Create notes and update item metadata.
- Open Zotero preference panes and trigger discovered plugin commands.
- Use approval controls for sensitive reads and write operations.
- Keep a local audit trail and expose reversible actions where possible.

Example tasks:

- "Group these papers by research topic."
- "Add the tag `read` to the selected items."
- "Read the current paper page and draft a note."
- "Find missing year and author metadata for this item."
- "Open the Zotero sync settings."

## Installation

1. Download `zotero-assistant.xpi` from the latest release.
2. Open Zotero 9.
3. Go to `Tools` -> `Add-ons`.
4. Install the downloaded `.xpi` file.
5. Restart Zotero if prompted.

## Configuration

Open Zotero preferences and select `Zotero Assistant`.

Configure:

- API base URL
- model name
- API key
- API mode
- safety mode

The API should be compatible with chat or responses-style model calls used by the plugin.

## Safety Modes

Zotero Assistant supports three safety modes:

- AI review mode: the default mode. The assistant asks an audit model to classify sensitive reads or write actions, and asks for human approval when needed.
- Confirm mode: write actions require explicit confirmation.
- Open mode: actions run without confirmation. Use this only for trusted workflows.

Deletion-style operations move items to the Zotero trash instead of permanently deleting them.

## Privacy

Your API key is stored in Zotero preferences on your own machine. The plugin does not upload your library to a separate service. Content is sent to the model provider only when a task requires model processing and according to the tools used in that task.

Debug logs, if enabled, may include task context, model responses, metadata, or document text. Write debug logs only to a trusted local directory.

## Development

Build the XPI:

```bash
npm run build
```

Run JavaScript syntax checks:

```bash
npm run check
```

The generated package is written to `build/zotero-assistant.xpi`.
