var ZoteroAssistant = (() => {
  class AssistantPlugin {
    constructor(data) {
      this.id = data.id;
      this.version = data.version;
      this.rootURI = data.rootURI;
      this.windows = new Map();
      this.task = null;
      this.eventLog = [];
      this.rememberedApprovals = {};
      this.undoStack = [];
      this.prefPaneID = null;
      this.sessionReadGrants = new Set();
      this.sessionPreferenceApprovals = new Set();
      this.sessionMemoryByLibraryID = new Map();
      this.libraryIndexes = new Map();
      this.notifierID = null;
      this.chatDisplayLog = [];
      this.chatTurnPending = { userText: "", aiReadable: [], process: [] };
      this.taskLoopActive = false;
      this._toolDispatch = ZoteroAssistantToolDispatch.buildDispatchTable();
    }
  }

  Object.assign(AssistantPlugin.prototype,
    ZoteroAssistantPluginApprovalUi,
    ZoteroAssistantPluginChat,
    ZoteroAssistantPluginCore,
    ZoteroAssistantPluginLibrary,
    ZoteroAssistantPluginModel,
    ZoteroAssistantPluginPrefs,
    ZoteroAssistantPluginSidebar,
    ZoteroAssistantPluginTask,
    ZoteroAssistantPluginUiDom
  );

  function create(data) {
    return new AssistantPlugin(data);
  }

  return { create };
})();
