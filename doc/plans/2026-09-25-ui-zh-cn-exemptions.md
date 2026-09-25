# Web 中文化扫描豁免复核（2026-09-25）

扫描归零只代表静态检查范围内没有未处理命中，不等于所有运行路径均已在浏览器中验证。

仅对稳定程序数据、品牌、示例或开发者诊断保留原文；界面错误提示、数量句及状态标题仍须翻译。

精确文本以 `ui/src/i18n/hardcoded-strings.exemptions.json` 的 `entries` 为准，不用宽泛文件豁免隐藏用户界面文案。

## 已完成批次与跨文件收尾

| 文件（相对 ui/src） | 保留理由 |
|---|---|
| `api/auth.ts` | 错误类名称与 console 网络诊断，不是认证页面文案。 |
| `api/client.ts` | 错误类名称，供程序识别。 |
| `components/AdapterLoginChrome.tsx` | 提供商和 CLI 产品名称。 |
| `components/DecisionTriageStrip.tsx` | 发送给智能体的任务评论指令。 |
| `components/DocumentAnnotationPanel.tsx` | 缺失 annotation target 的开发者契约错误。 |
| `components/IssueDocumentsSection.tsx` | 缺失 issue/subject 的开发者契约错误。 |
| `components/IssueRunLedger.tsx` | 提交到 API 的审计原因。 |
| `components/OnboardingWizard.tsx` | 持久化任务默认标题、凭据默认名称和 CLI 示例指令。 |
| `components/PipelineItemBodyDocument.tsx` | 写入任务评论的审计内容。 |
| `components/RunnerInspector.tsx` | KiB/MiB 单位与协议转换的 Runner 身份。 |
| `components/TaskChatThread.tsx` | 匹配旧版服务器评论的原始常量。 |
| `components/ai-connections/model.ts` | 提供商品牌名称。 |
| `components/chat/ExternallyConnectedTaskBanner.tsx` | 持久化发送草稿的附件名称回退与内部 scope 错误。 |
| `components/new-agent/AgentProviderConnection.tsx` | 品牌及凭据默认名称。 |
| `components/routine-triggers/TriggerWizard.tsx` | 调度输入示例和时区示例。 |
| `components/task-chat/TaskChatComposer.tsx` | 内部异常由本地化错误状态处理；另一项为 CSS 色彩表达式。 |
| `components/task-chat/motion-tokens.ts` | TweakPanel 开发调试面板的分组标识。 |
| `components/task-chat/task-chat-states.ts` | 状态契约说明中的协议类型、来源和事件描述。 |
| `components/task-chat/transcript-adapter.ts` | 工具标识和实时状态标识；状态在 TaskChatStatusPill 渲染时翻译。 |
| `components/transcript/RunTranscriptView.tsx` | 原始转录文本导出格式；正常事件标签已翻译。 |
| `components/transcript/native-run-events.ts` | 用于协议转换和工具分类的原始工具名称。 |
| `context/BreadcrumbContext.tsx` | React Context 缺少 Provider 的开发者契约错误。 |
| `context/CompanyContext.tsx` | React Context 缺少 Provider 的开发者契约错误。 |
| `context/DialogContext.tsx` | React Context 缺少 Provider 的开发者契约错误。 |
| `context/FileViewerContext.tsx` | React Context 缺少 Provider 的开发者契约错误。 |
| `context/PanelContext.tsx` | React Context 缺少 Provider 的开发者契约错误。 |
| `context/SidebarContext.tsx` | React Context 缺少 Provider 的开发者契约错误。 |
| `context/ThemeContext.tsx` | React Context 缺少 Provider 的开发者契约错误。 |
| `context/ToastContext.tsx` | React Context 缺少 Provider 的开发者契约错误。 |
| `features/connections/ConnectionSetupFlow.tsx` | Vercel Connect 产品名及连接标识示例。 |
| `lib/adapter-test-environment.ts` | 错误类名称。 |
| `lib/app-brand-assets.ts` | 资源清单请求和结构校验错误，用于开发诊断。 |
| `lib/comment-submit-result.ts` | 错误类名称。 |
| `lib/cron-fires.ts` | cron 解析器内部校验错误，上层处理失败状态。 |
| `lib/external-objects.ts` | 第三方产品名。 |
| `lib/issue-filters.ts` | 筛选预设的稳定标签键，在 quickFilterPresetLabel 中翻译。 |
| `lib/issue-monitor.ts` | 日期解析内部错误。 |
| `lib/issue-thread-interactions.ts` | 写入回复评论的答案摘要。 |
| `lib/onboarding-launch.ts` | 持久化入门任务标题。 |
| `lib/pipeline-learnings.ts` | 日期分组键，展示由 learningDayLabel 翻译。 |
| `lib/provider-credential.ts` | 写入 API 的凭据名称和说明。 |
| `lib/skill-create.ts` | 持久化技能初始名称、Markdown 内容和副本名称。 |
| `lib/successful-run-handoff.ts` | 匹配服务器通知内容的精确常量，不能改变。 |
| `lib/transcriptPresentation.ts` | 工具输入的稳定标识，展示由 toolInputDetailLabel 翻译。 |
| `lib/utils.ts` | 提供商、产品、认证机制名称。 |
| `lib/vite-sw-build-id.ts` | 构建期 service worker 占位符校验错误。 |
| `lib/wait-for-stopped-runs.ts` | 内部超时异常，上层 catch 转为本地化错误。 |
| `pages/BoardChat.tsx` | localStorage 键及发送给智能体的任务提示词。 |
| `pages/CompanyEnvironments.tsx` | 内部确认取消错误标识。 |
| `pages/CompanyExport.tsx` | 导出 README 文件的固定模板数据。 |
| `pages/ExecutionWorkspaceDetail.tsx` | 工作区 JSON 配置示例。 |
| `pages/PipelineSettings.tsx` | 持久化阶段默认名称。 |
| `pages/Pipelines.tsx` | 写入 API 的审计原因以及 headsUp 内部标识。 |
| `pages/ProfileSettings.tsx` | 保存用户名称时的默认数据。 |
| `pages/ProjectWorkspaceDetail.tsx` | shell 命令和 JSON 配置示例。 |
| `pages/SkillStudio.tsx` | 示例输入、生成的 README 标题与保存的版本标签。 |
| `pages/agent-skills/agent-skill-source.ts` | GitHub、skills.sh 品牌来源标签。 |
| `pages/apps/app-detail/RailwayAccessPanel.tsx` | SSH 主机公钥示例。 |
| `pages/apps/app-detail/SetupPanel.tsx` | 第三方产品名。 |
| `pages/apps/chat/ChatEndpointSetup.tsx` | Slack/Teams 配置导出、API 权限名称及测试消息。 |
| `pages/tools/profiles/ProfileWizard.tsx` | 持久化工具配置档默认名称。 |

`components/ai-connections/AiConnectionDesignExamples.tsx` 和 `lib/announcement-preview.ts` 仅服务开发用 DesignGuide/预览，按文件豁免。

## 扫描规则的已知边界

当前规则会漏过部分小写 JSX 文本、非白名单函数调用参数以及含程序变量的复合句。此次人工复核补了技能页错误回调、旧版任务计数、搜索提示和转录事件标签；最终仍须结合全 UI 测试及两种布局的浏览器走查。

后续任务的保留项在合并时继续补充到本记录；不得仅为满足门禁而添加豁免。
