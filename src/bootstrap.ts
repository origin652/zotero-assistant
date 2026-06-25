declare const Services: any;
declare let ZoteroAssistant: any;

let ZoteroAssistantBootstrap: any;

export function install() {}

function loadAssistantScripts(rootURI: string) {
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

export async function startup(data: any) {
  loadAssistantScripts(data.rootURI);
  ZoteroAssistantBootstrap = ZoteroAssistant.create(data);
  await ZoteroAssistantBootstrap.startup();
}

export function onMainWindowLoad({ window }: { window: Window }) {
  if (ZoteroAssistantBootstrap) {
    ZoteroAssistantBootstrap.addToWindow(window);
  }
}

export function onMainWindowUnload({ window }: { window: Window }) {
  if (ZoteroAssistantBootstrap) {
    ZoteroAssistantBootstrap.removeFromWindow(window);
  }
}

export function shutdown() {
  if (ZoteroAssistantBootstrap) {
    ZoteroAssistantBootstrap.shutdown();
    ZoteroAssistantBootstrap = null;
  }
}

export function uninstall() {}