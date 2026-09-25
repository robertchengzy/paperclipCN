/**
 * Canonical state inventory for the chat-style task thread (the default task
 * view; the classic legacy view sits behind enableClassicTaskInterface).
 *
 * This list is the single source of truth for:
 *   - the dev harness state switcher (/dev/task-chat-lab), and
 *   - the finish-line test that asserts every state renders without error.
 *
 * Each id traces to a real agent-protocol state (plan Deliverable 1). `tier`
 * marks whether the state already streams live ("live") or is emitted upstream
 * but dropped by acpx today ("tier-b", driven by synthetic events in the
 * harness, live wiring flagged). `surface` says where the state renders.
 */

import { t } from "@/i18n";

export const TASK_CHAT_STATES = [
  "session-start",
  "human-message",
  "agent-message",
  "thinking",
  "responding",
  "responding-burst",
  "tool-call",
  "diff",
  "working",
  "running",
  "completed",
  "activity-phases",
  "awaiting-approval",
  "plan-todo",
  "interrupted",
  "refused",
  "truncated",
  "live-token-cost",
] as const;

export type TaskChatStateId = (typeof TASK_CHAT_STATES)[number];

export type TaskChatStateTier = "live" | "tier-b";
export type TaskChatStateSurface = "thread" | "plan";

export interface TaskChatStateMeta {
  id: TaskChatStateId;
  /** Resolved on read so the harness follows the active UI language. */
  readonly label: string;
  tier: TaskChatStateTier;
  surface: TaskChatStateSurface;
  /** Real protocol source, quoted for the harness inspector. */
  protocol: string;
}

export const TASK_CHAT_STATE_META: Record<TaskChatStateId, TaskChatStateMeta> = {
  "session-start": {
    id: "session-start",
    get label() {
      return t("app.taskChat.taskChatStates.sessionStart");
    },
    tier: "live",
    surface: "thread",
    protocol: 'acpx.session → TranscriptEntry kind:"init"',
  },
  "human-message": {
    id: "human-message",
    get label() {
      return t("app.taskChat.taskChatStates.humanMessage");
    },
    tier: "live",
    surface: "thread",
    protocol: 'IssueComment authorType:"user"',
  },
  "agent-message": {
    id: "agent-message",
    get label() {
      return t("app.taskChat.taskChatStates.finalResponse");
    },
    tier: "live",
    surface: "thread",
    protocol: 'PRP item.delta kind:"agentMessage" channel:"final"',
  },
  thinking: {
    id: "thinking",
    get label() {
      return t("app.taskChat.taskChatStates.thinking");
    },
    tier: "live",
    surface: "thread",
    protocol: "text_delta stream:thought (ACP agent_thought_chunk)",
  },
  responding: {
    id: "responding",
    get label() {
      return t("app.taskChat.taskChatStates.progressUpdateStreaming");
    },
    tier: "live",
    surface: "thread",
    protocol: 'PRP item.delta kind:"agentMessage" channel:"progress"',
  },
  "responding-burst": {
    id: "responding-burst",
    get label() {
      return t("app.taskChat.taskChatStates.progressUpdateBurst");
    },
    tier: "live",
    surface: "thread",
    protocol: "text_delta stream:output ×N, tool calls between (PAP-368 dwell)",
  },
  "tool-call": {
    id: "tool-call",
    get label() {
      return t("app.taskChat.taskChatStates.toolCall");
    },
    tier: "live",
    surface: "thread",
    protocol: "acpx.tool_call (ACP tool_call / tool_call_update)",
  },
  diff: {
    id: "diff",
    get label() {
      return t("app.taskChat.taskChatStates.diff");
    },
    tier: "live",
    surface: "thread",
    protocol: 'ToolCallContent type:"diff" → TranscriptEntry kind:"diff"',
  },
  working: {
    id: "working",
    get label() {
      return t("app.taskChat.taskChatStates.working");
    },
    tier: "live",
    surface: "thread",
    protocol: "heartbeat.run.progress + acpx.status",
  },
  running: {
    id: "running",
    get label() {
      return t("app.taskChat.taskChatStates.running");
    },
    tier: "live",
    surface: "thread",
    protocol: 'message.status.type === "running"',
  },
  completed: {
    id: "completed",
    get label() {
      return t("app.taskChat.taskChatStates.completedCollapsed");
    },
    tier: "live",
    surface: "thread",
    protocol: "acpx.result (StopReason in subtype)",
  },
  "activity-phases": {
    id: "activity-phases",
    get label() {
      return t("app.taskChat.taskChatStates.longRunActivityPhases");
    },
    tier: "live",
    surface: "thread",
    protocol: "assistant boundaries + chronological tool calls",
  },
  "awaiting-approval": {
    id: "awaiting-approval",
    get label() {
      return t("app.taskChat.taskChatStates.awaitingApproval");
    },
    tier: "tier-b",
    surface: "thread",
    protocol: "ACP RequestPermissionRequest + PermissionOptionKind",
  },
  "plan-todo": {
    id: "plan-todo",
    get label() {
      return t("app.taskChat.taskChatStates.planTodo");
    },
    tier: "tier-b",
    surface: "plan",
    protocol: "ACP Plan { entries: PlanEntry[] }, PlanEntryStatus",
  },
  interrupted: {
    id: "interrupted",
    get label() {
      return t("app.taskChat.taskChatStates.interrupted");
    },
    tier: "tier-b",
    surface: "thread",
    protocol: 'AcpRuntimeTurnResult.status:"cancelled" / StopReason "cancelled"',
  },
  refused: {
    id: "refused",
    get label() {
      return t("app.taskChat.taskChatStates.refused");
    },
    tier: "tier-b",
    surface: "thread",
    protocol: 'StopReason "refusal"',
  },
  truncated: {
    id: "truncated",
    get label() {
      return t("app.taskChat.taskChatStates.truncated");
    },
    tier: "tier-b",
    surface: "thread",
    protocol: 'StopReason "max_tokens" | "max_turn_requests"',
  },
  "live-token-cost": {
    id: "live-token-cost",
    get label() {
      return t("app.taskChat.taskChatStates.liveTokenCost");
    },
    tier: "tier-b",
    surface: "thread",
    protocol: "ACP UsageUpdate { used, size, cost }",
  },
};

export const TASK_CHAT_STATE_LIST: TaskChatStateMeta[] = TASK_CHAT_STATES.map(
  (id) => TASK_CHAT_STATE_META[id],
);
