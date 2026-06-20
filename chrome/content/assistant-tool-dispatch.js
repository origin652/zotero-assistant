var ZoteroAssistantToolDispatch = (() => {
  function buildDispatchTable() {
    return {
      request_clarification: (ctx, args) => ctx.toolRequestClarification(args),
      search_items: (ctx, args) => ctx.toolSearchItems(args),
      read_current_context: (ctx) => ctx.readCurrentContext(ctx.currentTaskLibraryID()),
      read_item_fields: (ctx, args) => ctx.toolReadItemFields(args),
      read_current_reader_pages: (ctx) => ctx.toolReadCurrentReaderPages(),
      request_read_approval: (ctx, args) => ctx.toolRequestReadApproval(args),
      request_expanded_context: (ctx, args) => ctx.toolExpandedContext(args),
      read_library_overview: (ctx, args) => ctx.toolReadLibraryOverview(args),
      browse_library_items: (ctx, args) => ctx.toolBrowseLibraryItems(args),
      read_fulltext_page: (ctx, args) => ctx.toolReadFulltextPage(args),
      read_fulltext: (ctx, args) => ctx.toolReadFulltextPage(args),
      live_search: (ctx, args) => ctx.toolLiveSearch(args),
      web_search: () =>
        Promise.resolve({
          ok: false,
          error:
            "工具已更名为 live_search。请勿调用 web_search，请改用 live_search 并传入相同参数（如 query）。"
        }),
      web_fetch: (ctx, args) => ctx.toolWebFetch(args),
      lookup_metadata_candidates: (ctx, args) => ctx.toolLookupMetadataCandidates(args),
      create_collection: (ctx, args) => ctx.toolCreateCollection(args),
      add_items_to_collection: (ctx, args) => ctx.toolAddItemsToCollection(args),
      add_tags: (ctx, args) => ctx.toolAddTags(args),
      create_note: (ctx, args) => ctx.toolCreateNote(args),
      append_note: (ctx, args) => ctx.toolCreateNote(args),
      create_parent_item: (ctx, args) => ctx.toolCreateParentItem(args),
      update_metadata: (ctx, args) => ctx.toolUpdateMetadata(args),
      browse_preferences: (ctx, args) => ctx.toolBrowsePreferences(args),
      search_preferences: (ctx, args) => ctx.toolSearchPreferences(args),
      read_preferences: (ctx, args) => ctx.toolReadPreferences(args),
      list_preference_panes: (ctx, args) => ctx.toolListPreferencePanes(args),
      open_zotero_preferences: (ctx, args) => ctx.toolOpenZoteroPreferences(args),
      set_preference: (ctx, args) => ctx.toolSetPreference(args),
      request_zotero_restart: (ctx, args) => ctx.toolRequestZoteroRestart(args),
      list_plugin_commands: (ctx) => ctx.toolListPluginCommands(),
      move_to_trash: (ctx, args) => ctx.toolMoveToTrash(args),
      trigger_plugin_command: (ctx, args) => ctx.toolTriggerPluginCommand(args),
      list_export_formats: (ctx, args) => ctx.toolListExportFormats(args),
      export_items_citation: (ctx, args) => ctx.toolExportItemsCitation(args),
      run_batch_plan: (ctx, args) => ctx.toolRunBatchPlan(args),
      finish_task: (ctx, args) => ctx.toolFinishTask(args)
    };
  }

  return { buildDispatchTable };
})();
