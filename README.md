# Zotero 助手

Zotero 助手是一个 Zotero 9 桌面端插件原型。它不提供 MCP、不开放本地 HTTP 接口，也不让外部 AI 客户端直接控制 Zotero。用户必须在 Zotero 侧边栏中明确指定任务后，助手才会启动任务线程。

## 当前实现

- Zotero 9 插件清单和 bootstrap 入口。
- 右侧助手侧边栏，包含模型设置、安全模式、任务状态、授权卡片、执行日志和撤销按钮。
- OpenAI 兼容 Chat Completions 接口，要求模型支持 function calling。
- 三种安全模式：确认模式、AI 审核模式、完全开放模式。
- 低风险工具：创建 collection、添加标签、创建笔记、把条目加入 collection；**live_search**、**web_fetch**（公网检索与抓取，按任务次数限制；旧名 `web_search` 已废弃）。
- 高风险工具：扩展上下文、元数据修改、设置修改、移到回收站、触发其他插件命令。
- 按钮授权：“允许本次”“记住此命令”“拒绝”。
- 结构化事件日志，默认保留 30 天。
- 最近可逆操作撤销。
- 无第三方依赖的 XPI 打包脚本。
- 前端脚本按模块拆分在 `chrome/content/`：基础层（常量、样式、工具函数、工具分发表）+ `assistant-plugin-*.js` 原型 mixin（UI、侧栏、聊天、模型、任务、偏好、文库工具、核心生命周期），主文件 `zotero-assistant.js` 仅保留构造函数与 `Object.assign` 装配；由 `bootstrap.js` 按顺序 `loadSubScript` 加载。

## 使用

```bash
npm run check
npm run build
```

构建产物在 `build/zotero-assistant.xpi`。

在 Zotero 9 中打开插件调试或插件安装界面，加载 `build/zotero-assistant.xpi`。这是 unsigned XPI，适合开发和自用验证。

## 重要边界

- 助手没有默认任务，不会自动整理书架。
- 如果用户任务描述模糊，助手应先追问关键目标。
- 插件不直接写 `zotero.sqlite`。
- 删除只允许移到 Zotero 回收站，不提供永久删除工具。
- 其他插件仅通过已发现并已授权的菜单命令触发，不调用未知内部 API。
- API key 当前保存到 Zotero preferences，请只在可信本机上使用。
