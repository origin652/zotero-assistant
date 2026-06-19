var ZoteroAssistantBootstrap;

function install() {}

function loadAssistantScripts(rootURI) {
  const base = rootURI + "chrome/content/";
  const files = [
    "assistant-constants.js",
    "assistant-i18n.js",
    "assistant-util.js",
    "assistant-styles.js",
    "assistant-tool-dispatch.js",
    "assistant-plugin-ui-dom.js",
    "assistant-plugin-sidebar.js",
    "assistant-plugin-approval-ui.js",
    "assistant-plugin-chat.js",
    "assistant-plugin-model.js",
    "assistant-plugin-task.js",
    "assistant-plugin-prefs.js",
    "assistant-plugin-library.js",
    "assistant-plugin-core.js",
    "zotero-assistant.js"
  ];
  for (const file of files) {
    Services.scriptloader.loadSubScript(base + file);
  }
}

async function startup(data, reason) {
  loadAssistantScripts(data.rootURI);
  ZoteroAssistantBootstrap = ZoteroAssistant.create(data);
  await ZoteroAssistantBootstrap.startup();
}

function onMainWindowLoad({ window }) {
  if (ZoteroAssistantBootstrap) {
    ZoteroAssistantBootstrap.addToWindow(window);
  }
}

function onMainWindowUnload({ window }) {
  if (ZoteroAssistantBootstrap) {
    ZoteroAssistantBootstrap.removeFromWindow(window);
  }
}

function shutdown(data, reason) {
  if (ZoteroAssistantBootstrap) {
    ZoteroAssistantBootstrap.shutdown();
    ZoteroAssistantBootstrap = null;
  }
  if (typeof ZoteroAssistant !== "undefined") {
    ZoteroAssistant = undefined;
  }
}

function uninstall() {}
