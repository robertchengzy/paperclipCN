# Web UI 简体中文化：进度与后续计划

日期：2026-09-24

## 目标与边界

让 Board Web UI 在简体中文下可完整使用，同时保留英文切换。范围是 `ui/` 中由前端维护的界面文案、无障碍标签与时间显示；服务端返回的消息、用户或智能体生成的内容、CLI 和其他客户端不在本轮范围内。提交到 Git 不代表已部署或完成实际使用验收。

参考上游 [中文化 PR #11373](https://github.com/paperclipai/paperclip/pull/11373) 的页面清单、词条校验及回归思路。本分支采用简体中文作为首次访问的 UI 语言；该 PR 的英文默认语言、构建时默认语言设置和全站覆盖不属于当前已完成内容。

## 当前进度

以下按 2026-09-24 的源码记录，描述本轮实现范围。

| 项目 | 当前状态 |
|---|---|
| 语言运行时 | `ui/src/i18n/index.ts` 优先读取 `paperclip.ui.language`，无有效存储值时启动简体中文；英文仍是缺失词条的回退语言。切换时更新 `<html lang>`。 |
| 切换入口 | 登录页和侧边栏账户菜单提供简体中文 / English 选择，选择写入浏览器本地存储。 |
| 已接入界面 | 登录页、主侧边栏及账户菜单、主题开关、首页仪表盘、审批列表与审批卡片/详情文案。相关相对时间支持简体中文格式。 |
| 词条 | `en.json` 与 `zh-CN.json` 各有 184 个叶子词条；这 184 个简中值均与对应英文值不同。40 个语言文件维持同一词条结构，其他语言在本轮新增的词条主要使用英文回退文本。 |
| 校验 | 现有 locale 校验测试覆盖词条结构和语言切换；通用 UI 测试固定英文，语言切换测试显式进入简中。 |

这是局部页面中文化，不能按词条数推算全站完成比例。已接入页面中仍可能有动态内容、错误消息和新加的组件显示英文，需逐页检查。

## 后续实施顺序

1. **建立覆盖清单。** 按路由及弹窗、表单、命令面板、空状态、错误提示列出前端维护的可见文案和无障碍标签；对已接入页面做一次中英双语检查，标注来自 API、插件或用户内容的例外。
2. **补齐主要工作流。** 先覆盖任务详情与创建、收件箱、项目、智能体、组织、目标、审批完整流程，再覆盖例程、连接器、设置、成本与活动。每一批同时更新英文键、简中翻译和调用点，避免只加词条而页面仍硬编码英文。
3. **补齐边缘界面。** 覆盖新用户引导、插件与适配器配置、工作区、搜索、快捷命令、提示消息、加载与错误态，以及日期、数字和复数等依赖语言的格式。品牌名和用户数据保持原样。
4. **维护与回归。** 增加静态词条引用检查和词条同步工具，持续检查其他语言文件与英文键结构一致；在英文和简中下分别验证关键页面、语言持久化、刷新、无存储权限和屏幕阅读器语言标记。

每一批完成时，记录已覆盖的页面、剩余英文来源、校验命令与结果。全站完成的判断依据是路由和交互流程检查，而不是仅有 locale 文件的键数。

## 本轮交付检查

- [x] 文档区分当前部分覆盖和后续全站目标。
- [x] UI 类型检查、相关单元测试、UI 构建和 token gate 通过。
- [ ] 中文与英文手动走查登录、导航、首页和审批流程。
- [ ] 运行版本核对和实际使用验收（仅在部署后进行）。

验证记录（2026-09-24）：`pnpm --filter @paperclipai/ui typecheck`、`pnpm check:token-gates`、6 个相关 UI 测试文件（55 条用例）和 `pnpm --filter @paperclipai/ui build` 通过。仓库级 `pnpm -r typecheck` 在 Runner 的 Rust 检查处因环境缺少 `cargo` 停止。`pnpm test:run` 在耗时较长的服务端串行套件中停止，未取得全量结果。4 worker 的全 UI 测试出现 3 条 `CompanySettings` 失败；该未修改文件单独运行 4/4 通过，全 UI 测试尚不能标记通过。

## 第二批（2026-09-24 晚）

| 项目 | 状态 |
|---|---|
| 工具 | 新增 `scripts/sync-locales.mjs`（`pnpm locales:sync` / `pnpm locales:check`，以 `en.json` 为准同步其余 39 个语言文件，缺失键填英文回退）；新增 `ui/src/i18n/key-reference.test.ts`（静态 `t("...")` 键必须存在于 `en.json`）；新增 `ui/src/i18n/labels.ts` 状态/优先级标签助手。两份工具移植自上游 PR #11373。 |
| 公共 | `app.common`：任务/智能体/通用状态、优先级、受阻原因、常用按钮；`StatusIcon`、`StatusBadge`、`PriorityIcon`、`MobileBottomNav` 已接入。 |
| 任务列表 | `app.issues`：`Issues`、`MyIssues`、`IssuesList`、`IssueFiltersPopover`、`IssueColumns`、`IssueRow`、`KanbanBoard`。 |
| 新建任务与属性面板 | `app.newIssue`：`NewIssueDialog`、`issue-properties/*`。 |
| 收件箱 | `app.inbox`：`Inbox`、`InboxAgentPolicyControl`、`BlockedInboxView`、`FeedCard`。 |
| 项目与目标 | `app.projects`、`app.goals`：列表、详情、新建对话框、属性面板、目标树。 |
| 智能体 | `app.agents`：`Agents` 列表、`NewAgent` 面包屑、`AgentProperties`、`AgentConfigForm`。 |
| 词条 | `en.json` / `zh-CN.json` 各 1290 个叶子词条；仅 8 条与英文相同（ID、CEO/CTO 等角色缩写、纯占位符）。 |

语言可运行时切换，本批不在模块顶层调用 `t()`；英文值与原字面量逐字一致，现有英文断言不变。
`chat-ui-contract.test.ts` 的源码正则改为同时接受 `t("app.inbox.errors.retryRunFailed")`，并断言其英文值不变。

仍为英文（下一批）：`IssueDetail`（8000+ 行）、`AgentDetail`、`new-agent/*` 创建流程、
`agent-config-primitives` 帮助文本、`LegacyInbox` / `LegacyIssuesList`（关闭 Streamlined UI 时使用）、
`lib/` 下的日期分组、相对时间、恢复/监控文案、`EmptyState`、`PageTabBar`、`CollectionToolbar`，
以及例程、流水线、设置、成本、密钥、技能等页面。

验证记录（第二批）：`pnpm --filter @paperclipai/ui typecheck`、`pnpm check:token-gates`、
`pnpm locales:check` 通过；全 UI 测试（2 worker）635 个文件 6662 条，唯一失败为上面的源码契约测试，修正后单独运行 13/13 通过。
未做浏览器中文走查，未部署。

## 第三批（2026-09-24 晚，分支 `feat/i18n-batch-3`）

| 命名空间 | 覆盖 |
|---|---|
| `issueDetail` | 任务详情页 `IssueDetail.tsx`：头部、菜单、标签页、子任务、成本、附件、提示与错误 |
| `issueChat` | 任务对话 `IssueChatThread.tsx`、`CommentThread.tsx`：输入框、消息外框、系统提示、运行块 |
| `agentDetail` | 智能体详情页 `AgentDetail.tsx`：头部、暂停/恢复、概览、修订、权限、指令、运行、日志、API key |
| `agentSetup` | 新建智能体流程 `components/new-agent/*`；`agent-config-primitives.tsx` 新增 `helpText` / `useAgentConfigHelp` / `adapterLabel` / `roleLabel`（原导出保持英文） |
| `format`、`shared` | `lib/` 日期显示随界面语言、日期分组、监控 ETA、审核策略、重试原因、恢复标签、外部对象、工作模式、"你"；`PageTabBar`、`CollectionToolbar`、`StarToggle`、`MembershipAction` |

词条：`en.json` / `zh-CN.json` 各 2123 个叶子词条，15 条与英文相同（ID、角色缩写、API key、纯占位符等）。
`chat-ui-contract.test.ts` 对 IssueDetail 的 "Retry queued" 同样改为接受 `t(...)` 并断言英文值。

仍为英文（下一批候选）：`AgentConfigForm` 与 `adapters/*/config-fields.tsx` 里仍直接读取英文 `help.*` 的调用点；
`lib/issue-chat-messages.ts`、`transcriptPresentation`、`SystemNotice`、交接/提及相关小组件；
智能体详情页的 `AgentActionButtons`、`AgentSkillsTab`、`AgentToolsTab`、运行详情子组件；
任务详情页的 `TaskSidePanel`、`IssueRunLedger`、文档/工作区区块、`IssueRecoveryActionCard`；
`LegacyInbox` / `LegacyIssuesList`；例程、流水线、设置、成本、密钥、技能等页面。

验证记录（第三批）：UI typecheck、`pnpm check:token-gates`、`pnpm locales:check` 通过；
全 UI 测试（2 worker）635 个文件 6662 条全部通过。未做浏览器中文走查，未部署。
