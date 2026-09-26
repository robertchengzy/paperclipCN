# 2026-09-26 中文扫描新增豁免记录

本轮增强硬编码扫描后，按源代码消费位置审核并新增 **150 个逐文件、逐值豁免**。没有新增整文件豁免或全局词值豁免。下表仅记录本轮新增项，路径均相对 `ui/src/`。

## 判断边界

- JSX 文本、显示属性、显示对象属性、toast 以及动态插值前后的自然语言需要翻译；小写单词、空格或标点不构成豁免理由。
- 保留英文的技术值必须匹配下表中的文件与完整规范化文本；不能将示例、状态或 CSS 的理由扩展到同文件的其他产品句子。
- 内部状态和判别值保留原值，在真正的显示位置翻译；不得因翻译改变启停、结果渲染、API 或持久化语义。
- 扫描忽略列表是人工判断的记录。后续若同一精确值增加了新的使用位置，需要重新核查；扫描通过不代表动态路径或全量中文语义审核完成。

## 本轮新增项

| 文件 | 精确文本 | 保留理由 |
|---|---|---|
| `adapters/claude-local/config-fields.tsx` | `claude-agent-acp` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `adapters/codex-local/config-fields.tsx` | `agentcore-primary`<br>`codex-acp`<br>`managed-primary` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `adapters/gemini-local/config-fields.tsx` | `gemini --acp` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `adapters/hermes-gateway/config-fields.tsx` | `{"x-custom-header": "value"}` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `adapters/openclaw-gateway/config-fields.tsx` | `agent-123`<br>`operator`<br>`paperclip`<br>`{"x-custom-header": "value"}` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `adapters/runtime-json-fields.tsx` | `{ "agentId": "remote-agent-123", "metadata": { "team": "platform" } }`<br>`{ "services": [ { "name": "preview", "lifecycle": "ephemeral", "metadata": { "purpose": "remote preview" } } ] }` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `components/FrontmatterPanel.tsx` | `allowed-tools`<br>`description`<br>`metadata`<br>`name` | Frontmatter 编辑器直接展示 YAML 字段名，保留字段拼写。 |
| `components/IssueChatThread.tsx` | `comment` | `SourceTrustBadge.artifactLabel` 是类型判别值；组件内已将其转换为中文显示标签。 |
| `components/IssueDocumentsSection.tsx` | `document` | `SourceTrustBadge.artifactLabel` 是类型判别值；组件内已将其转换为中文显示标签。 |
| `components/IssueRecoveryActionCard.tsx` | `&lt;timestamp&gt;` | 模板变量或命令参数占位符语法，需要逐字展示。 |
| `components/IssuesList.tsx` | `agent`<br>`board me human local-board`<br>`board user human`<br>`me board human` | 仅用于搜索匹配的英文别名；可见标签另外翻译。 |
| `components/KanbanBoard.tsx` | `bg-amber-50/45 ring-1 ring-inset ring-amber-500/15 dark:bg-amber-950/15`<br>`bg-blue-50/45 ring-1 ring-inset ring-blue-500/15 dark:bg-blue-950/15`<br>`bg-green-50/45 ring-1 ring-inset ring-green-500/15 dark:bg-green-950/15`<br>`bg-muted/25 ring-1 ring-inset ring-border/50`<br>`bg-muted/30 ring-1 ring-inset ring-border/50`<br>`bg-red-50/45 ring-1 ring-inset ring-red-500/15 dark:bg-red-950/15`<br>`bg-violet-50/45 ring-1 ring-inset ring-violet-500/15 dark:bg-violet-950/15` | `label`、`body`、`title` 或 `description` 属性实际保存 CSS 类，消费位置是样式。 |
| `components/LegacyIssuesList.tsx` | `agent`<br>`board me human local-board`<br>`board user human`<br>`me board human` | 仅用于搜索匹配的英文别名；可见标签另外翻译。 |
| `components/OnboardingWizard.tsx` | `--print - --output-format stream-json --verbose`<br>`exec --json -` | 可执行命令样例，保留 Shell 语法和参数。 |
| `components/ProjectProperties.tsx` | `bash ./scripts/provision-worktree-runtime.sh`<br>`bash ./scripts/provision-worktree.sh`<br>`bash ./scripts/teardown-worktree.sh` | 可执行命令样例，保留 Shell 语法和参数。 |
| `components/ProjectProperties.tsx` | `{{issue.identifier}}-{{slug}}` | 模板变量或命令参数占位符语法，需要逐字展示。 |
| `components/RoutineVariablesEditor.tsx` | `{{name}}`<br>`{{variable_name}}` | 模板变量或命令参数占位符语法，需要逐字展示。 |
| `components/RoutineVariablesEditor.tsx` | `high, medium, low` | 用户自定义枚举或分类的输入样例，保留英文数据值。 |
| `components/RunWorkspaceRecoverySurface.tsx` | `Re-issue (isolated):` | 创建新任务时写入持久化标题的默认前缀；本轮保留任务数据内容。 |
| `components/RunnerInspector.tsx` | `null` | 检查器中 JSON `null` 原始值的表示。 |
| `components/SystemNotice.tsx` | `text-amber-900 dark:text-amber-200`<br>`text-emerald-800 dark:text-emerald-200`<br>`text-muted-foreground`<br>`text-red-900 dark:text-red-200`<br>`text-sky-800 dark:text-sky-200` | `label`、`body`、`title` 或 `description` 属性实际保存 CSS 类，消费位置是样式。 |
| `components/WorkspaceRuntimeControls.tsx` | `run once`<br>`stopped` | 原始状态参与启停、重启判断；`CommandSection` 在显示时翻译状态，不改变机器值。 |
| `components/agent-config-primitives.tsx` | `{{issue.title}}` | 模板变量或命令参数占位符语法，需要逐字展示。 |
| `components/contextual-sidebar-styles.ts` | `px-2 pb-1 text-(length:--text-micro) font-semibold uppercase tracking-wide text-muted-foreground`<br>`px-4 pb-1.5 text-(length:--text-micro) leading-snug text-muted-foreground/70` | `label`、`body`、`title` 或 `description` 属性实际保存 CSS 类，消费位置是样式。 |
| `components/issue-properties/IssueProperties.tsx` | `requester` | 仅用于搜索匹配的英文别名；可见标签另外翻译。 |
| `components/new-agent/NewAgentSetup.tsx` | `kimi-for-coding` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `components/routine-sections/editable-sections.production.tsx` | `{{placeholders}}`<br>`{{placeholder}}` | 模板变量或命令参数占位符语法，需要逐字展示。 |
| `components/routine-sections/editable-sections.tsx` | `{{placeholders}}`<br>`{{placeholder}}` | 模板变量或命令参数占位符语法，需要逐字展示。 |
| `components/search/MatchSourceChip.tsx` | `bg-(--chip-match-title-bg) text-(--chip-match-title-fg) border-(--chip-match-title-border)` | `label`、`body`、`title` 或 `description` 属性实际保存 CSS 类，消费位置是样式。 |
| `components/search/SearchFilterBar.tsx` | `me mine`<br>`unassigned none nobody` | 仅用于搜索匹配的英文别名；可见标签另外翻译。 |
| `components/task-chat/TweakPanel.tsx` | `ms` | 标准毫秒单位后缀。 |
| `components/task-chat/motion-tokens.ts` | `ease-in-out`<br>`ease-out`<br>`ease-out-expo (house)`<br>`linear`<br>`standard (house)` | 开发调试面板中的 CSS 缓动函数与项目预设名称，保留技术名称。 |
| `components/transcript/RunTranscriptView.tsx` | `init`<br>`result`<br>`workspace changes`<br>`workspace diff` | 标准化记录中的原值用于结果分支与稳定标识；`TranscriptEventRow` 在显示时翻译。 |
| `components/transcript/RunTranscriptView.tsx` | `stdout` | 运行流、Token、标识符的技术缩写，或 CLI 客户端产品名，保留英文。 |
| `lib/assignees.ts` | `me board human local-board`<br>`me human` | 仅用于搜索匹配的英文别名；可见标签另外翻译。 |
| `lib/issue-chat-messages.ts` | `stop` | 传给代码或 API 的完成、可见性、关闭或取消原因值；不是显示文案。 |
| `lib/pipeline-item-detail.ts` | `resolved` | 传给代码或 API 的完成、可见性、关闭或取消原因值；不是显示文案。 |
| `lib/pipeline-stage-presentation.ts` | `bg-green-50/30 dark:bg-green-950/10`<br>`bg-violet-50/30 dark:bg-violet-950/10` | `label`、`body`、`title` 或 `description` 属性实际保存 CSS 类，消费位置是样式。 |
| `pages/AdapterManager.tsx` | `/mnt/e/Projects/my-adapter or E:\Projects\my-adapter` | 包目录输入框的 Unix、Windows 路径样例，保留原路径。 |
| `pages/AdapterManager.tsx` | `latest`<br>`my-paperclip-adapter` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `pages/AgentDetail.production.tsx` | `stderr`<br>`stdout`<br>`tok` | 运行流、Token、标识符的技术缩写，或 CLI 客户端产品名，保留英文。 |
| `pages/AgentDetail.tsx` | `stderr`<br>`stdout`<br>`tok` | 运行流、Token、标识符的技术缩写，或 CLI 客户端产品名，保留英文。 |
| `pages/CliAuth.tsx` | `paperclipai cli` | 运行流、Token、标识符的技术缩写，或 CLI 客户端产品名，保留英文。 |
| `pages/CompanyEnvironments.tsx` | `operator cancelled` | 传给代码或 API 的完成、可见性、关闭或取消原因值；不是显示文案。 |
| `pages/CompanyEnvironments.tsx` | `id` | 运行流、Token、标识符的技术缩写，或 CLI 客户端产品名，保留英文。 |
| `pages/CompanySkills.production.tsx` | `skill`<br>`skill-shortname` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `pages/CompanySkills.production.tsx` | `engineering, review, memory` | 用户自定义枚举或分类的输入样例，保留英文数据值。 |
| `pages/CompanySkills.tsx` | `skill`<br>`skill-shortname` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `pages/CompanySkills.tsx` | `engineering, review, memory` | 用户自定义枚举或分类的输入样例，保留英文数据值。 |
| `pages/ExecutionWorkspaceDetail.tsx` | `bash ./scripts/provision-worktree-runtime.sh`<br>`bash ./scripts/provision-worktree.sh`<br>`bash ./scripts/teardown-worktree.sh`<br>`pkill -f vite &#124;&#124; true` | 可执行命令样例，保留 Shell 语法和参数。 |
| `pages/Inbox.tsx` | `agent`<br>`board me human local-board`<br>`board user human`<br>`me board human` | 仅用于搜索匹配的英文别名；可见标签另外翻译。 |
| `pages/IssueDetail.tsx` | `Re-issue (isolated):` | 创建新任务时写入持久化标题的默认前缀；本轮保留任务数据内容。 |
| `pages/LegacyInbox.tsx` | `agent`<br>`board me human local-board`<br>`board user human`<br>`me board human` | 仅用于搜索匹配的英文别名；可见标签另外翻译。 |
| `pages/ProjectWorkspaceDetail.tsx` | `pkill -f vite &#124;&#124; true` | 可执行命令样例，保留 Shell 语法和参数。 |
| `pages/ProjectWorkspaceDetail.tsx` | `codespaces`<br>`frontend`<br>`workspace-123` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `pages/Secrets.tsx` | `admin`<br>`clientsecret`<br>`global`<br>`paperclip`<br>`paperclip-prod`<br>`platform`<br>`prod`<br>`production`<br>`secret`<br>`us-east-1` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `pages/SkillStudio.tsx` | `no template plain input` | 仅用于搜索匹配的英文别名；可见标签另外翻译。 |
| `pages/SkillStudio.tsx` | `code-review`<br>`engineering, review, memory` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `pages/SkillStudio.tsx` | `{{issueId}}`<br>`{{outputDocumentKey}}`<br>`{{runId}}`<br>`{{skillInvocation}}`<br>`{{skillKey}}`<br>`{{skillName}}`<br>`{{skillVersion}}` | 模板变量或命令参数占位符语法，需要逐字展示。 |
| `pages/apps/chat/ChatEndpointDetail.tsx` | `&lt;request&gt;` | 模板变量或命令参数占位符语法，需要逐字展示。 |
| `pages/secrets/proposal-review.tsx` | `client-secret` | 命令、运行环境、provider、slug 或凭据键的输入样例，保留技术标识拼写。 |
| `pages/tools/SmokeLabTab.tsx` | `ms` | 标准毫秒单位后缀。 |
| `pages/tools/connection-dialogs.tsx` | `ms` | 标准毫秒单位后缀。 |
| `pages/tools/shared.tsx` | `allowed`<br>`block`<br>`deferred`<br>`denied`<br>`hidden`<br>`rate limited`<br>`redacted`<br>`require approval` | 策略判定映射保留英文兜底；`DecisionBadge` 按原始 decision 值查询对应词条再展示。 |
| `plugins/launchers.tsx` | `backdrop`<br>`programmatic` | 传给代码或 API 的完成、可见性、关闭或取消原因值；不是显示文案。 |

## 验证

- 新增回归先复现小写文字、动态插值与标点漏扫，再验证修复；同时检查普通机器值、CSS 属性和 `t()` 调用不会被误判。
- 全量扫描使用工作区当前源码和豁免表；本记录生成时返回 0 项未豁免命中。
- 使用变更前豁免表重扫当前源码，新增 150 个逐文件词值实际覆盖 165 处命中；本轮没有留下已失去对应命中的新增豁免。
- WorkspaceRuntimeControls、RunTranscriptView、TaskChatThread 的相关现有组件测试共 198 项通过。
