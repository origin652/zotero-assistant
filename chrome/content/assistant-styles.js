var ZoteroAssistantStyles = (() => {
  const STYLE_ID = "zotero-assistant-global-styles";
  const STYLE_REV = "za-selection-ask-20260618";
  function getGlobalStylesText() {
    return `
#zotero-assistant-ui-root,
#zotero-assistant-ui-root * {
  box-sizing: border-box;
}
#zotero-assistant-ui-root {
  --za-bg: #f4f6f9;
  --za-surface: #ffffff;
  --za-surface-muted: #f8fafc;
  --za-border: rgba(15, 23, 42, 0.10);
  --za-border-strong: rgba(15, 23, 42, 0.14);
  --za-text: #0f172a;
  --za-text-muted: #64748b;
  --za-accent: #c45c26;
  --za-accent-hover: #a84d1f;
  --za-accent-soft: rgba(196, 92, 38, 0.12);
  --za-radius: 12px;
  --za-radius-sm: 8px;
  --za-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08);
  --za-font: system-ui, "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif;
}
#zotero-assistant-sidebar {
  display: flex !important;
  flex-direction: column !important;
  min-width: 0 !important;
  font-family: var(--za-font) !important;
  background: var(--za-bg) !important;
  color: var(--za-text) !important;
  border-left: 1px solid var(--za-border-strong) !important;
  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.10) !important;
}
#zotero-assistant-sidebar .zotero-assistant-header {
  flex: 0 0 auto !important;
  padding: 14px 16px !important;
  border-bottom: 1px solid var(--za-border) !important;
  background: linear-gradient(180deg, var(--za-surface) 0%, var(--za-surface-muted) 100%) !important;
}
#zotero-assistant-sidebar .za-brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
#zotero-assistant-sidebar .za-brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.2;
}
#zotero-assistant-sidebar .za-brand-sub {
  font-size: 11px;
  color: var(--za-text-muted);
  font-weight: 500;
}
#zotero-assistant-sidebar .zotero-assistant-body {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  padding: 12px 14px 16px !important;
  display: block !important;
}
#zotero-assistant-sidebar .zotero-assistant-panel {
  border: 1px solid var(--za-border) !important;
  border-radius: var(--za-radius) !important;
  background: var(--za-surface) !important;
  box-shadow: var(--za-shadow) !important;
  overflow: visible !important;
  min-width: 0 !important;
  height: auto !important;
  max-height: none !important;
  margin-bottom: 12px !important;
}
#zotero-assistant-sidebar .zotero-assistant-panel:last-child {
  margin-bottom: 0 !important;
}
#zotero-assistant-sidebar .za-panel-header {
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.02em;
  color: var(--za-text-muted) !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid var(--za-border) !important;
  background: var(--za-surface-muted) !important;
  flex: 0 0 auto !important;
}
#zotero-assistant-sidebar .zotero-assistant-panel-body {
  padding: 12px !important;
  font-size: 13px !important;
  line-height: 1.55 !important;
  min-width: 0 !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  word-wrap: break-word !important;
  overflow-wrap: anywhere !important;
  white-space: normal !important;
}
#zotero-assistant-sidebar .zotero-assistant-form {
  flex: 0 0 auto !important;
  border-top: 1px solid var(--za-border) !important;
  padding: 12px 14px 14px !important;
  background: var(--za-surface) !important;
  flex-direction: column !important;
  gap: 10px !important;
  display: flex !important;
}
#zotero-assistant-sidebar .zotero-assistant-form textarea {
  border: 1px solid var(--za-border-strong) !important;
  border-radius: var(--za-radius-sm) !important;
  padding: 10px 12px !important;
  font-family: var(--za-font) !important;
  font-size: 13px !important;
  line-height: 1.5 !important;
  background: var(--za-surface-muted) !important;
  color: var(--za-text) !important;
  min-height: 72px !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
#zotero-assistant-sidebar .zotero-assistant-form textarea:focus {
  outline: none !important;
  border-color: var(--za-accent) !important;
  box-shadow: 0 0 0 3px var(--za-accent-soft) !important;
  background: var(--za-surface) !important;
}
#zotero-assistant-chat-launcher {
  position: fixed !important;
  right: 24px !important;
  bottom: 24px !important;
  width: 54px !important;
  height: 54px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(196, 92, 38, 0.40) !important;
  background: #c45c26 !important;
  color: #ffffff !important;
  box-shadow: 0 14px 34px rgba(196, 92, 38, 0.34) !important;
  z-index: 9997 !important;
  cursor: pointer !important;
  font-family: var(--za-font, system-ui, sans-serif) !important;
  font-size: 15px !important;
  font-weight: 800 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
#zotero-assistant-chat-launcher:hover {
  background: #a84d1f !important;
}
#zotero-assistant-chat-panel {
  position: absolute !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  border: 1px solid #d8dde6 !important;
  border-radius: 12px !important;
  background: #ffffff !important;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.16) !important;
  overflow: hidden !important;
  z-index: 5 !important;
  pointer-events: auto !important;
}
#zotero-assistant-chat-panel .za-floating-chat-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid var(--za-border) !important;
  background: #f0f2f5 !important;
  cursor: move !important;
  flex: 0 0 auto !important;
}
#zotero-assistant-chat-panel .za-floating-chat-title-wrap {
  display: flex !important;
  flex-direction: column !important;
  min-width: 0 !important;
}
#zotero-assistant-chat-panel .za-floating-chat-title {
  font-size: 13px !important;
  font-weight: 800 !important;
  color: var(--za-text) !important;
  line-height: 1.2 !important;
}
#zotero-assistant-chat-panel .za-floating-chat-subtitle {
  color: var(--za-text-muted) !important;
  font-size: 11px !important;
  margin-top: 2px !important;
}
#zotero-assistant-chat-panel .za-floating-chat-actions {
  display: flex !important;
  gap: 6px !important;
  flex: 0 0 auto !important;
}
#zotero-assistant-chat-panel .za-floating-chat-actions .za-btn {
  min-height: 26px !important;
  padding: 4px 10px !important;
  font-size: 11px !important;
}
#zotero-assistant-chat-panel .za-floating-chat-messages {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  padding: 14px 12px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  background: #e9ebef !important;
}
#zotero-assistant-chat-panel .za-floating-chat-approval {
  flex: 0 0 auto !important;
  padding: 0 12px 10px !important;
}
#zotero-assistant-chat-panel .za-floating-chat-footer {
  flex: 0 0 auto !important;
  display: flex !important;
  gap: 8px !important;
  align-items: flex-end !important;
  padding: 10px 12px 12px !important;
  border-top: 1px solid var(--za-border) !important;
  background: #ffffff !important;
}
#zotero-assistant-chat-panel .za-floating-chat-footer textarea {
  flex: 1 1 auto !important;
  resize: none !important;
  min-height: 46px !important;
  max-height: 96px !important;
  border: 1px solid var(--za-border-strong) !important;
  border-radius: 12px !important;
  padding: 9px 10px !important;
  font-family: var(--za-font) !important;
  font-size: 13px !important;
  line-height: 1.45 !important;
  background: #f8fafc !important;
  color: var(--za-text) !important;
}
#zotero-assistant-chat-panel .za-floating-chat-footer textarea:focus {
  outline: none !important;
  border-color: var(--za-accent) !important;
  box-shadow: 0 0 0 3px var(--za-accent-soft) !important;
  background: #ffffff !important;
}
#zotero-assistant-chat-panel .za-chat-row {
  display: flex !important;
  align-items: flex-start !important;
  gap: 8px !important;
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}
#zotero-assistant-chat-panel .za-chat-row-user {
  flex-direction: row !important;
  justify-content: flex-end !important;
}
#zotero-assistant-chat-panel .za-chat-row-ai {
  flex-direction: row !important;
  justify-content: flex-start !important;
}
#zotero-assistant-chat-panel .za-chat-avatar {
  flex: 0 0 36px !important;
  width: 36px !important;
  height: 36px !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  line-height: 1 !important;
  user-select: none !important;
}
#zotero-assistant-chat-panel .za-chat-avatar-ai {
  background: #4a90d9 !important;
  color: #ffffff !important;
}
#zotero-assistant-chat-panel .za-chat-avatar-user {
  background: #c45c26 !important;
  color: #ffffff !important;
}
#zotero-assistant-chat-panel .za-chat-stack {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
  min-width: 0 !important;
  max-width: calc(100% - 52px) !important;
}
#zotero-assistant-chat-panel .za-chat-row-user .za-chat-stack {
  align-items: flex-end !important;
}
#zotero-assistant-chat-panel .za-chat-row-ai .za-chat-stack {
  align-items: flex-start !important;
}
#zotero-assistant-chat-panel .za-chat-name {
  font-size: 11px !important;
  font-weight: 600 !important;
  color: #8a8f99 !important;
  line-height: 1.2 !important;
  padding: 0 4px !important;
}
#zotero-assistant-chat-panel .za-chat-bubble {
  max-width: 100% !important;
  border-radius: 10px !important;
  padding: 9px 12px !important;
  font-size: 13px !important;
  line-height: 1.5 !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06) !important;
  user-select: text !important;
  -moz-user-select: text !important;
  cursor: text !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text,
#zotero-assistant-chat-panel .za-chat-bubble-text * {
  user-select: text !important;
  -moz-user-select: text !important;
  cursor: text !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text a {
  cursor: pointer !important;
}
#zotero-assistant-chat-panel .za-chat-name {
  user-select: none !important;
  -moz-user-select: none !important;
  cursor: default !important;
}
#zotero-assistant-chat-panel .za-floating-chat-messages {
  user-select: text !important;
  -moz-user-select: text !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-user {
  background: #95ec69 !important;
  color: #111827 !important;
  border-bottom-right-radius: 3px !important;
}
@keyframes za-chat-typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-5px); opacity: 1; }
}
#zotero-assistant-chat-panel .za-chat-typing-dots {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 2px 0 !important;
}
#zotero-assistant-chat-panel .za-chat-typing-dots span {
  width: 7px !important;
  height: 7px !important;
  border-radius: 50% !important;
  background: #94a3b8 !important;
  animation: za-chat-typing-bounce 1.2s ease-in-out infinite !important;
}
#zotero-assistant-chat-panel .za-chat-typing-dots span:nth-child(2) {
  animation-delay: 0.15s !important;
}
#zotero-assistant-chat-panel .za-chat-typing-dots span:nth-child(3) {
  animation-delay: 0.3s !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-typing {
  background: #ffffff !important;
  border: 1px solid #e2e5ea !important;
  min-width: 52px !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-ai {
  background: #ffffff !important;
  color: #111827 !important;
  border: 1px solid #e2e5ea !important;
  border-bottom-left-radius: 3px !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown {
  font-size: 13px;
  line-height: 1.5;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown p {
  margin: 0 0 6px 0 !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown p:last-child {
  margin-bottom: 0 !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown pre {
  margin: 0 0 6px 0 !important;
  background: #0f172a !important;
  color: #e2e8f0 !important;
  border-radius: 8px !important;
  padding: 8px 10px !important;
  font-size: 11px !important;
  overflow-x: auto !important;
  max-width: 100% !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown code {
  background: rgba(15, 23, 42, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown ul,
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown ol {
  margin: 0 0 6px 0 !important;
}
#zotero-assistant-chat-panel .za-chat-bubble-text.za-markdown a {
  color: #2563eb;
  font-weight: 600;
}
#zotero-assistant-chat-panel .za-chat-resize-handle {
  position: absolute !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 18px !important;
  height: 18px !important;
  cursor: nwse-resize !important;
  z-index: 6 !important;
  background: linear-gradient(135deg, transparent 50%, rgba(100,116,139,0.35) 50%) !important;
  border-bottom-right-radius: 12px !important;
}
#zotero-assistant-chat-panel .za-chat-notice,
#zotero-assistant-chat-panel .za-chat-empty {
  align-self: center !important;
  max-width: 92% !important;
  border-radius: 999px !important;
  padding: 6px 10px !important;
  font-size: 11px !important;
  color: #64748b !important;
  background: rgba(100, 116, 139, 0.10) !important;
}
#zotero-assistant-chat-panel .za-chat-approval-card {
  border: 1px solid rgba(245, 158, 11, 0.28) !important;
  border-radius: 14px !important;
  background: #fffbeb !important;
  padding: 10px !important;
  font-size: 12px !important;
  line-height: 1.45 !important;
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.12) !important;
}
#zotero-assistant-chat-panel .za-selection-draft-card {
  border: 1px solid rgba(196, 92, 38, 0.30) !important;
  border-radius: 14px !important;
  background: #fff7ed !important;
  padding: 10px !important;
  font-size: 12px !important;
  line-height: 1.45 !important;
  box-shadow: 0 8px 20px rgba(196, 92, 38, 0.10) !important;
}
#zotero-assistant-chat-panel .za-selection-draft-card-title {
  font-weight: 800 !important;
  margin-bottom: 4px !important;
  color: #9a3412 !important;
}
#zotero-assistant-chat-panel .za-selection-draft-card-text {
  color: #64748b !important;
  white-space: pre-wrap !important;
}
#zotero-assistant-launcher {
  font-family: var(--za-font, system-ui, sans-serif) !important;
  font-weight: 700 !important;
  font-size: 11px !important;
  letter-spacing: 0.08em;
  color: var(--za-text, #0f172a) !important;
  background: linear-gradient(135deg, #fff 0%, #f8fafc 100%) !important;
  border: 1px solid rgba(196, 92, 38, 0.35) !important;
  box-shadow: -8px 0 24px rgba(196, 92, 38, 0.15) !important;
}
#zotero-assistant-launcher:hover {
  background: linear-gradient(135deg, #fff7ed 0%, #fff 100%) !important;
  border-color: var(--za-accent, #c45c26) !important;
}
#zotero-assistant-sidebar .za-btn,
#zotero-assistant-chat-panel .za-btn,
#zotero-assistant-approval-popup .za-btn,
#zotero-assistant-log-popup .za-btn {
  font-family: system-ui, "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  border-radius: 999px !important;
  padding: 7px 14px !important;
  cursor: pointer !important;
  border: 1px solid transparent !important;
  line-height: 1.35 !important;
  min-height: 32px !important;
  -moz-appearance: none !important;
  appearance: none !important;
  display: inline-block !important;
  box-sizing: border-box !important;
}
#zotero-assistant-sidebar .za-btn:active,
#zotero-assistant-chat-panel .za-btn:active,
#zotero-assistant-approval-popup .za-btn:active,
#zotero-assistant-log-popup .za-btn:active { transform: scale(0.98); }
#zotero-assistant-sidebar .za-btn:disabled,
#zotero-assistant-chat-panel .za-btn:disabled,
#zotero-assistant-approval-popup .za-btn:disabled,
#zotero-assistant-log-popup .za-btn:disabled { opacity: 0.45; cursor: not-allowed; }
#zotero-assistant-sidebar .za-btn-ghost,
#zotero-assistant-chat-panel .za-btn-ghost,
#zotero-assistant-approval-popup .za-btn-ghost,
#zotero-assistant-log-popup .za-btn-ghost {
  background: #ffffff !important;
  border-color: rgba(15, 23, 42, 0.14) !important;
  color: #64748b !important;
}
#zotero-assistant-sidebar .za-btn-primary,
#zotero-assistant-chat-panel .za-btn-primary,
#zotero-assistant-approval-popup .za-btn-primary,
#zotero-assistant-log-popup .za-btn-primary {
  background: #c45c26 !important;
  color: #ffffff !important;
  border-color: #c45c26 !important;
  box-shadow: 0 4px 14px rgba(196, 92, 38, 0.28);
}
#zotero-assistant-sidebar .za-btn-secondary,
#zotero-assistant-chat-panel .za-btn-secondary,
#zotero-assistant-approval-popup .za-btn-secondary,
#zotero-assistant-log-popup .za-btn-secondary {
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: rgba(15, 23, 42, 0.14) !important;
}
.za-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.za-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.za-pill-running { background: rgba(59, 130, 246, 0.14); color: #1d4ed8; }
.za-pill-waiting { background: rgba(245, 158, 11, 0.16); color: #b45309; }
.za-pill-paused { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
.za-pill-complete { background: rgba(34, 197, 94, 0.14); color: #15803d; }
.za-pill-idle { background: rgba(100, 116, 139, 0.12); color: #475569; }
.za-muted { color: var(--za-text-muted); font-size: 12px; }
.za-error {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: var(--za-radius-sm);
  background: rgba(254, 242, 242, 0.9);
  border: 1px solid rgba(239, 68, 68, 0.22);
  color: #991b1b;
  font-size: 12px;
  white-space: pre-wrap;
}
.za-empty {
  color: var(--za-text-muted);
  font-size: 12px;
  font-style: italic;
}
.za-log-line {
  padding: 8px 0;
  border-bottom: 1px solid var(--za-border);
  font-size: 11px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  color: var(--za-text-muted);
}
.za-log-line:last-of-type { border-bottom: none; }
.za-log-type { color: var(--za-text); font-weight: 600; }
.za-grant-on { color: #15803d; font-weight: 600; }
.za-grant-off { color: #b45309; font-weight: 600; }
.za-risk-low { color: #15803d; font-weight: 600; }
.za-risk-mid { color: #b45309; font-weight: 600; }
.za-risk-high { color: #b91c1c; font-weight: 600; }
#zotero-assistant-sidebar details {
  margin-top: 8px;
  border: 1px solid var(--za-border);
  border-radius: var(--za-radius-sm);
  padding: 8px 10px;
  background: var(--za-surface-muted);
}
#zotero-assistant-sidebar details summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
}
#zotero-assistant-sidebar details pre {
  margin: 8px 0 0;
  font-size: 11px;
  max-height: none;
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
}
#zotero-assistant-sidebar .za-markdown pre {
  margin: 0 0 8px;
  background: #0f172a !important;
  color: #e2e8f0 !important;
  border: none !important;
  border-radius: var(--za-radius-sm) !important;
  padding: 10px 12px !important;
  font-size: 11px !important;
}
#zotero-assistant-sidebar .za-markdown code {
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}
#zotero-assistant-sidebar .za-markdown a {
  color: var(--za-accent);
  font-weight: 600;
}
`;
  }
  return { STYLE_ID, STYLE_REV, getGlobalStylesText };
})();
