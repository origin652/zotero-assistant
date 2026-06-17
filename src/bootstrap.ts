declare const Services: any;
declare let ZoteroAssistant: any;

let ZoteroAssistantBootstrap: any;

export function install() {}

export async function startup(data: any) {
  Services.scriptloader.loadSubScript(data.rootURI + "chrome/content/zotero-assistant.js");
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
