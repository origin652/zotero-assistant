var ZoteroAssistantBootstrap;

function install() {}

async function startup(data, reason) {
  Services.scriptloader.loadSubScript(data.rootURI + "chrome/content/zotero-assistant.js");
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
