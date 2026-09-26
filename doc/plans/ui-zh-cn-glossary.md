# Web UI 简体中文术语表

这是 `ui/src/i18n/locales/zh-CN.json` 的译法约定。新增词条先查本表；本表没有的术语，沿用 `zh-CN.json` 里已有的译法。
需要改译法时，先改本表，再按语境修订显示文案。不要全局替换用户内容、代码、命令、协议值或第三方字段名。

## 核心对象

| 英文 | 中文 | 说明 |
|---|---|---|
| Organization / Company | 组织 | 界面上的 Company 与 Organization 是同一个对象；两种布局都使用“组织” |
| Agent | Agent | Subagent → 子 Agent；保留技术术语英文 |
| Task / Issue | 任务 | Sub-issue / Subtask → 子任务 |
| Project | 项目 | |
| Goal | 目标 | |
| Approval | 审批 | Approve → 同意，Reject → 拒绝，Request revision → 要求修改 |
| Run | 运行 | Heartbeat run → 心跳运行 |
| Heartbeat | 心跳 | |
| Routine | 例程 | Trigger → 触发器，Schedule → 计划 |
| Pipeline | 流水线 | Stage → 阶段，Step → 步骤 |
| Skill | Skill | Skill Studio 保留英文；日常能力描述按语义处理 |
| Secret | 密钥 | Vault → 保管库，Rotate → 轮换 |
| Workspace | 工作区 | Execution workspace → 执行工作区，与 Git Worktree 区分 |
| Worktree | Worktree | Git Worktree；命令 `git worktree` 原样保留 |
| Harness | Harness | Runtime → 运行时 |
| Token | Token | 认证与模型计量按上下文区分；完整外部字段名保留原样 |
| Watchdog | Watchdog | 任务核验与恢复职责，不等同于 Board 权限 |
| Environment | 环境 | Environment variable → 环境变量 |
| Connector | 连接器 | |
| Connection | 连接 | |
| App | 应用 | |
| Gateway | 网关 | |
| Plugin | 插件 | |
| Adapter | 适配器 | |
| Tool | 工具 | Tool profile → 工具配置档 |
| Profile | 配置档 | 指用户或个人资料时译为“个人资料” |
| Budget | 预算 | |
| Cost / Spend | 成本 / 支出 | Biller → 计费方，Finance event → 财务事件 |
| Activity | 活动 | Audit → 审计 |
| Timeline | 时间线 | |
| Inbox | 收件箱 | |
| Member | 成员 | Invite → 邀请，Join request → 加入申请 |
| Board | Board | 身份/人类操作者；Board user → Board 用户；Board view → 看板视图，管理界面 → 管理面板；Admin 仍为管理员 |
| Session | 会话 | |
| Case | 案例 | |
| Document | 文档 | Plan document → 计划文档 |
| Artifact | 产物 | |
| Label | 标签 | |
| Assignee / Responsible | 负责人 | 上游两个词指同一概念 |
| Owner | 负责人 | 指资源所有者时译为“所有者” |
| Sponsor | Sponsor | GitHub 访客授权中的有效组织成员；不是请求发起人，不向访客转授其个人凭据或成员身份 |
| Low-trust review | 低信任审查 | 权限预设名称统一；任务审核、审批仍按各自动作和状态区分 |
| Recovery | 恢复 | |
| Status card | 状态卡片 | |
| Dashboard | 仪表盘 | |
| Settings | 设置 | Instance settings → 实例设置 |
| Experimental | 实验性 | |

## 状态

| 英文 | 中文 |
|---|---|
| Backlog | 待规划 |
| Todo | 待办 |
| In progress | 进行中 |
| In review | 审核中 |
| Blocked | 受阻 |
| Done | 已完成 |
| Cancelled | 已取消 |
| Paused | 已暂停 |
| Idle | 等待中 |
| Running | 运行中 |
| Failed | 失败 |
| Pending | 待处理 |
| Archived | 已归档 |

## 常用操作

| 英文 | 中文 |
|---|---|
| Save / Saving… | 保存 / 保存中… |
| Cancel | 取消 |
| Delete / Remove | 删除 / 移除 |
| Archive / Unarchive | 归档 / 取消归档 |
| Retry / Try again | 重试 / 请重试 |
| Copy / Copied | 复制 / 已复制 |
| Loading… | 加载中… |
| Dismiss | 关闭 |
| Revoke | 撤销 |
| Install / Uninstall | 安装 / 卸载 |
| Connect / Disconnect / Reconnect | 连接 / 断开连接 / 重新连接 |

## 保留原文

- 产品和第三方名称：Paperclip、Claude、Codex、Cursor、OpenCode、Hermes、Pi、GitHub、Slack、Google Sheets、Railway、Zapier、Arcade、Composio 等。
- 技术缩写与格式：API、MCP、ACP、JSON、YAML、CSV、TSV、XML、HTML、CSS、SQL、HTTP(S)、SSH、URL、PDF、ZIP、WASM、PID、ID。
- 技术对象：Agent、Skill、Token、Worktree、Harness、Watchdog、Webhook、OAuth。推理强度的技术级别（如 Ultra）与 Ask 等运行模式名称保留英文，后台枚举值不变。
- 外部控制台的正式字段名：如 `Bot User OAuth Token`、`Signing Secret`、`Application / Client ID`，保持原样以便对照。
- 文件名、命令、环境变量、代码标识、示例值（如 `SKILL.md`、`PAPERCLIP_*`、`PAP-123`）。
- 键盘按键名（Esc、Enter、Tab、Shift、Cmd、Ctrl）。
- 语言切换里的“English”。

## 写法

- 中文与英文、数字、插值占位符之间加一个半角空格（如“运行 {{count}} 次”“连接 GitHub”），与已有词条一致。
- 省略号跟随英文原文：原文是 `…` 就用 `…`，原文是 `...` 也用 `…`。
- 插值占位符（`{{count}}`、`{{name}}`）必须和英文词条一致。
- 语气用陈述句和“请…”，不用“您”。
