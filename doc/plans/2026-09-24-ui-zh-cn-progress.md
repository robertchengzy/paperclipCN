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

## 全站中文化（2026-09-25～26，分支 `feat/i18n-full`）

本轮把 `ui/src` 按 25 组全部接入 `t()`，并与上游 `c341588bd` 同步（合并提交 `e58070a6b`）。相对 `master` 只改 `ui/` 与 `doc/`（`doc/SPEC-implementation.md` 来自上游合并）；`server/`、`packages/db/src/migrations/`、`pnpm-lock.yaml` 无差异。

| 项目 | 状态 |
|---|---|
| 词条 | `en.json` / `zh-CN.json` 各 14524 个叶子词条，其中 62 条与英文相同（品牌、产品名、第三方控制台字段名如 Slack `Signing Secret`、`Webhook URL` 等缩写术语）。其余 38 个语言文件由 `pnpm locales:sync` 同步，新键用英文回退。 |
| 静态门禁 | `ui/src/i18n/hardcoded-strings.test.ts` 改为严格模式：整个 `ui/src` 扫描结果必须为空，删除按文件计数的基线。保留英文的项目在 `hardcoded-strings.exemptions.json` 逐项豁免（20 个文件级、66 个值、105 个精确条目），理由见 `2026-09-25-ui-zh-cn-exemptions.md`。 |
| 语言行为 | 首次访问默认简体中文；登录页与侧边栏账户菜单可切换，写入 `paperclip.ui.language`，刷新保持；`<html lang>` 随切换更新。 |
| 英文行为 | 英文词条值与原字面量一致，现有英文断言不改。少数原本直接显示原始值的位置（案例活动的状态流转、实例访问页的成员角色）在英文下仍显示原值，只在简中下翻译。 |

### 浏览器走查发现并修复的漏译

静态扫描覆盖不到 JSX 中插值两侧的英文文本和运行时拼接的值。隔离实例走查发现以下漏译，已修复（`1f3da4320`、`60d0ff512`）：

- 插值计数：智能体技能页 “N of M enabled”、导入技能对话框的 workspace / scannable 计数、运行转录的日志行 / 系统消息分组、任务对话的待接管数、密钥提议人、技能工作室 “updated …”。
- 原始枚举值：组织列表状态徽标、实例访问页的角色与状态、组织架构图的角色标签。
- 相对时间：`lib/timeAgo.ts` 的语言参数原默认 `"en"`，约一半的调用（按 grep 统计，36 处中约 19 处）未传语言；改为默认当前界面语言，英文输出不变。
- `app.common.labels.apiKey`、`app.agentSetup.connection.apiKey` 的简中值统一为 “API 密钥”。

全 UI 测试首轮发现 3 条由本分支引起的英文回归（这 3 条在 `master` 上均通过），已修复（`5dd206564`）：案例活动的状态流转在英文下改回原始值；案例 “Children N” 标题恢复空格；`chat-ui-contract.test.ts` 接受 `LegacyInbox` 的 `translateCopy("app.issueUi.legacyInbox.runRetryFailed")`，并断言其英文值仍为 “Run retry failed”。

### 验证记录

在 `60d0ff512` 上运行（3 CPU，Vitest 2 worker）：

| 检查 | 结果 |
|---|---|
| `pnpm --filter @paperclipai/ui typecheck` | 通过 |
| `pnpm check:token-gates` | 全部通过 |
| `pnpm locales:check` | 39 个语言文件与 `en.json` 结构一致 |
| `cd ui && npx vitest run --maxWorkers=2 --testTimeout=60000` | 639 个文件、6709 条全部通过 |
| `pnpm --filter @paperclipai/ui build` | 通过（仅有 chunk 体积警告） |

浏览器走查在 `1f3da4320` 上运行，使用隔离的 `local_trusted` 实例（临时 `PAPERCLIP_HOME`，端口 3198），不连接现网实例。`60d0ff512` 只多改了技能工作室一行文案，未重跑走查。

- 路由走查：streamlined 与 legacy 布局各 84 个路由，共 168 个页面，均无页面异常，`<html lang>` 均为 `zh-CN`。6 个重点页面在 390px 宽度下采样，`scrollWidth` 均等于视口宽度，无横向溢出。
- 操作走查：侧边栏账户菜单切换中英文，刷新后保持，`localStorage` 值正确；用中文创建任务并发表评论；审批的同意与拒绝；修改智能体名称并保存。以上都通过 API 核对了结果。`local_trusted` 模式没有登录页（`/auth` 会跳转到新手引导），所以语言切换改从侧边栏账户菜单验证，登录页的切换入口未在浏览器中验证。
- 页面上剩余的英文逐条归类如下，均保留：测试夹具名称（Sweep/Actions/Language Org 等）；本地 Board 用户名；品牌与产品名（GitHub、Slack、Claude Code 等）；适配器与插件 ID、npm 包名、技能 slug、搜索运算符（`status:todo`）、活动事件类型（`issue.created`）；服务端返回的内容（应用目录与插件的描述、技能描述、成员删除限制原因 “You cannot remove yourself.”、组织导出警告）；导出包里生成的 `README.md` 内容；运行转录中等宽显示的调试元数据（invocation/audit/card）。浏览器原生文件选择控件的 “Choose File” 由浏览器语言决定。

走查脚本与报告在当时的临时目录中，未提交进仓库。

### 未验证项

- 登录页（authenticated 模式）的语言切换入口未在浏览器中验证。
- 屏幕阅读器的实际朗读效果、无存储权限的浏览器环境。
- 服务端返回的错误与提示消息、插件自带界面、CLI 仍是英文，不在本轮范围内。
- 部署后的运行版本核对与现网验收。

## 同步上游 `bd2030932`（2026-09-26，分支 `sync/upstream-20260926`）

合并上游 15 个提交（合并提交 `1fefa83b8`）：Slack 聊天设置、记忆连接器、MCP 聚合器默认开启、移动端选择器视口、Codex 配额修复、lockfile 刷新；没有新迁移。9 个文件有冲突，处理原则是采用上游逻辑，同时保留已有译文：

- `NewIssueDialog` 的选择器改用上游的 `contentStyle`，不再用 `disablePortal`。
- 连接设置去掉 MCP 聚合器开关检查，改为检查记忆连接器；实验性设置里的卡片随之换成“记忆连接器”。
- 远程 MCP 设置采用上游的 `RemoteMcpAccountChoice` 和“通过 X 连接 Y”标题，均已翻译。
- GitHub 与 Slack 设置提示共用上游的 `SetupPrompt`。复制给外部 AI 的指令保持英文，作为逐项豁免：实例 URL 两句从 `GitHubSetupPrompt.tsx` 移到 `SetupPrompt.tsx`，新增 `SlackSetupPrompt.tsx` 条目。
- `codex-home.test.ts` 采用上游等价的 `http_headers` 断言，上游已包含 fork 原有的同类修复。

新增 12 个词条（`en.json` / `zh-CN.json` 各 14535 个叶子词条）。上游新增界面中，静态扫描漏掉了 `RemoteMcpAccountChoice` 的说明段落（含插值），人工逐文件检查了上游改动的 UI 文件后补译。

验证（`1fefa83b8`）：UI typecheck、`pnpm check:token-gates`、`pnpm locales:check`、严格扫描为 0、UI build 通过；全 UI 测试 640 个文件、6725 条全部通过；`codex-local` 的 `src` 测试 30 个文件、465 条通过。隔离实例走查结果与上次相同：168 个页面无异常，`lang` 均为 `zh-CN`，窄屏无溢出，3 个操作用例通过。新出现的英文只有 Zapier、Composio、Arcade、Executor 等应用名称及其目录描述，它们来自服务端应用定义，因聚合器默认开启而显示。服务端测试套件未运行，服务端改动以上游为准，由部署构建和现网启动检查覆盖。

## 同步上游 `4ca404b49` 并修复 iPhone 无法加载（2026-09-26，分支 `sync/upstream-20260926b`）

**iPhone 无法加载**：部署 `352843a24` 后，iPhone（iOS 26，Chrome/WebKit）打开页面只显示 “Paperclip couldn’t start”，桌面 Chrome 正常。nginx 日志显示 iPhone 下载新前端后再没有发出 `/api/` 请求。原因推测：`ui/src/i18n/locales.ts` 用 `import.meta.glob("./locales/*.json", { eager: true })` 把 40 个语言文件（各约 900 KB，其中 38 个是 `en.json` 的镜像）打进同一个约 30 MB 的 chunk。修复提交 `8c5a785fb`：glob 只包含界面可选的 `en` 与 `zh-CN`，该 chunk 降到约 2.2 MB。其他语言文件继续由 `pnpm locales:sync` 维护，只是不再打包。

**合并上游**（合并提交 `4e7789f98`，6 个提交）：心跳 drain 期间的唤醒排队、恢复重试预算、工作区恢复失败的诊断与标记、处置恢复通知（`DispositionRecoveryNotice`）、工作产物的执行工作区引用校验。没有新迁移，lockfile 未变。3 个文件有冲突，均为上游改了英文文案、fork 已改为翻译调用的位置：

- `TaskChatThread`：保留翻译调用，采用上游新增的工作区恢复失败逻辑。上游去掉了停止说明中的“before returning an answer”，`en`/`zh-CN` 的对应词条同步改为新措辞（键名不变）。
- `TaskChatRichInput`：采用上游 `showImageAttachControls = false` 的默认值，`attachAriaLabel` 保留 fork 的翻译回退。
- `TaskChatSystemNotice`：同时保留 `useTranslation` 和上游的 `useDispositionRecoverySnapshot`。

新增 49 个词条：`DispositionRecoveryNotice` 全部文案、`lib/workspace-restore-marker.ts`、`IssueDetail` 的恢复重试不可用原因，以及“查看已保存的计划”“工作区恢复失败”。`DesignGuide` 新增的说明段落属于已豁免的设计页面，保持英文。

验证（`8c5a785fb`）：UI typecheck、`pnpm check:token-gates`、`pnpm locales:check`、严格扫描为 0、UI build 通过；全 UI 测试 642 个文件、6774 条全部通过。构建后最大的 chunk 是 `index-*.js`（6.6 MB），语言包所在的 `createLucideIcon-*.js` 从 30 MB 降到 2.2 MB。iPhone 上是否恢复以部署后真机访问为准（本机无法运行 WebKit）。服务端测试套件未运行。

## 中文审计修正（2026-09-26）

审计发现静态扫描归零仍可能漏掉小写 JSX、动态状态和依赖组件的文案。本轮修复已识别问题并按用户偏好保留技术术语英文，详情见 [修正记录](2026-09-26-ui-zh-cn-audit-fixes.md)。全仓类型与 token gates 通过；全 UI/浏览器及最终部署结果随交付记录提供。实例版本按完整 SHA 验证，不以代码提交或本进度条目代替上线证据。

## 语义精校第二批（2026-09-26）

以 `acbaa3edd` 为基线精校 2,393 条高风险候选，并修复真实会话中复现的移动保存栏重叠。重点纠正预算恢复、密钥定义删除、审批/执行与重试排队边界；详见 [第二批记录](2026-09-26-ui-zh-cn-semantic-batch2.md)。最终版本与验收以实例部署记录为准，不将源码进展直接当作上线事实。

## 2026-09-26 中英文范围收敛

按用户要求恢复上一批 18 条英文改写、保留中文修订，删除其它语言镜像，并将侧栏反馈入口改为语言切换。保留手机布局修复及功能回归，详见 [本批说明](2026-09-26-bilingual-only.md)。
