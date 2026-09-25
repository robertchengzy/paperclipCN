/**
 * Provider-neutral tool vocabulary shared by live status, transcript rows,
 * and canonical provider activity. Exact semantic tools get purpose-specific
 * copy; ACP kinds and normalized name prefixes cover future adapters.
 */
import {
  BookOpen,
  Brain,
  ChevronsLeftRightEllipsis,
  CircleHelp,
  Clock3,
  FilePenLine,
  Image,
  ListChecks,
  MessageSquareReply,
  Network,
  Search,
  SearchCode,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { t } from "@/i18n";
import { McpIcon } from "./McpIcon";

/** Lucide icons and hand-rolled SVGs (the MCP logo) share this shape. */
export type ToolIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type ToolFamily =
  | "terminal"
  | "grep"
  | "search"
  | "read"
  | "edit"
  | "web"
  | "plan"
  | "question"
  | "agent"
  | "safety"
  | "image"
  | "wait"
  | "mcp"
  | "other";

export interface ToolTaxonomyEntry {
  family: ToolFamily;
  icon: ToolIcon;
  /** Progressive verb for the status pill, without the trailing ellipsis. */
  verbLabel: string;
}

export type ToolClassificationConfidence = "exact" | "kind" | "inferred" | "fallback" | "unnamed";

export interface ToolActivityPresentationInput {
  name?: string | null;
  transport?: string | null;
  namespace?: string | null;
  /** ACP kind or canonical operation. */
  operation?: string | null;
  target?: string | null;
  progress?: string | null;
}

export interface ToolSummaryGroup {
  key: string;
  singular: string;
  plural: string;
}

export interface ToolActivityPresentation {
  icon: ToolIcon;
  family: ToolFamily;
  runningLabel: string;
  completedLabel: string;
  failedLabel: string;
  interruptedLabel: string;
  displayName: string;
  sourceLabel?: string;
  technicalName?: string;
  confidence: ToolClassificationConfidence;
  summaryGroup: ToolSummaryGroup;
}

/** ACPX's placeholder title must never displace real lifecycle identity. */
const GENERIC_TOOL_NAMES = new Set(["tool", "tool call", "tool_call", "acp_tool"]);

export function isGenericToolName(name: string | undefined | null): boolean {
  const raw = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\((?:pending|in[_ -]?progress|completed|failed|cancelled|canceled)\)$/, "");
  return !raw || GENERIC_TOOL_NAMES.has(raw);
}

interface McpIdentity {
  namespace: string;
  name: string;
}

export function mcpToolIdentity(name: string): McpIdentity | null {
  const doubleUnderscore = name.match(/^mcp__(.+?)__(.+)$/i);
  if (doubleUnderscore) return { namespace: doubleUnderscore[1], name: doubleUnderscore[2] };
  const dotted = name.match(/^mcp\.([^.]+)\.(.+)$/i);
  return dotted ? { namespace: dotted[1], name: dotted[2] } : null;
}

function identifierWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function sentenceCase(words: readonly string[]): string {
  if (words.length === 0) return "";
  const text = words.map((word) => {
    if (["api", "id", "lsp", "mcp", "pr", "url"].includes(word)) return word.toUpperCase();
    return word;
  }).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function humanizeToolName(name: string | undefined | null): string {
  const raw = (name ?? "").trim();
  if (isGenericToolName(raw)) return t("app.taskChat.toolTaxonomy.unnamedTool");
  const mcp = mcpToolIdentity(raw);
  return sentenceCase(identifierWords(mcp?.name ?? raw));
}

/** Humanized MCP tool segment for both mcp__server__tool and mcp.server.tool. */
export function mcpToolSegment(name: string): string | null {
  const identity = mcpToolIdentity(name);
  return identity ? humanizeToolName(identity.name) : null;
}

type Action =
  | "read" | "list" | "search" | "fetch" | "open" | "update" | "create"
  | "delete" | "move" | "run" | "request" | "post" | "start" | "stop"
  | "wait" | "finish" | "block" | "think" | "switch" | "other";

interface ExactAction {
  action: Action;
  running?: () => string;
  completed?: () => string;
  group?: ToolSummaryGroup;
  family?: ToolFamily;
}

const group = (key: string, singular: string, plural: string): ToolSummaryGroup => ({ key, singular, plural });

const EXACT_ACTIONS: Record<string, ExactAction> = {
  bash: { action: "run" },
  terminal: { action: "run" },
  shell: { action: "run" },
  command: { action: "run" },
  run: { action: "run" },
  execute: { action: "run" },
  exec_command: { action: "run" },
  apply_patch: { action: "update", running: () => t("app.taskChat.toolTaxonomy.applyingAPatch"), completed: () => t("app.taskChat.toolTaxonomy.appliedAPatch") },
  read: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingAFile"), completed: () => t("app.taskChat.toolTaxonomy.readAFile") },
  write: { action: "update", running: () => t("app.taskChat.toolTaxonomy.writingAFile"), completed: () => t("app.taskChat.toolTaxonomy.wroteAFile") },
  edit: { action: "update", running: () => t("app.taskChat.toolTaxonomy.editingAFile"), completed: () => t("app.taskChat.toolTaxonomy.editedAFile") },
  notebook_read: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingANotebook"), completed: () => t("app.taskChat.toolTaxonomy.readANotebook") },
  notebook_edit: { action: "update", running: () => t("app.taskChat.toolTaxonomy.editingANotebook"), completed: () => t("app.taskChat.toolTaxonomy.editedANotebook") },
  glob: { action: "search", running: () => t("app.taskChat.toolTaxonomy.searchingFiles"), completed: () => t("app.taskChat.toolTaxonomy.searchedFiles") },
  grep: { action: "search", running: () => t("app.taskChat.toolTaxonomy.searchingFileContents"), completed: () => t("app.taskChat.toolTaxonomy.searchedFileContents"), family: "grep" },
  tool_search: { action: "search", running: () => t("app.taskChat.toolTaxonomy.searchingAvailableTools"), completed: () => t("app.taskChat.toolTaxonomy.searchedAvailableTools"), group: group("tool_search", "tool search", "tool searches") },
  web_search: { action: "search", running: () => t("app.taskChat.toolTaxonomy.searchingTheWeb"), completed: () => t("app.taskChat.toolTaxonomy.searchedTheWeb"), family: "web" },
  web_fetch: { action: "fetch", running: () => t("app.taskChat.toolTaxonomy.fetchingAWebPage"), completed: () => t("app.taskChat.toolTaxonomy.fetchedAWebPage"), family: "web" },
  todo_write: { action: "update", running: () => t("app.taskChat.toolTaxonomy.updatingTheTaskList"), completed: () => t("app.taskChat.toolTaxonomy.updatedTheTaskList"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  task_create: { action: "create", running: () => t("app.taskChat.toolTaxonomy.creatingATask"), completed: () => t("app.taskChat.toolTaxonomy.createdATask"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  task_update: { action: "update", running: () => t("app.taskChat.toolTaxonomy.updatingATask"), completed: () => t("app.taskChat.toolTaxonomy.updatedATask"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  task_list: { action: "list", running: () => t("app.taskChat.toolTaxonomy.listingTasks"), completed: () => t("app.taskChat.toolTaxonomy.listedTasks"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  task_get: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingATask"), completed: () => t("app.taskChat.toolTaxonomy.readATask"), family: "plan", group: group("task_operation", "task operation", "task operations") },
  enter_plan_mode: { action: "switch", running: () => t("app.taskChat.toolTaxonomy.enteringPlanMode"), completed: () => t("app.taskChat.toolTaxonomy.enteredPlanMode"), family: "plan" },
  exit_plan_mode: { action: "switch", running: () => t("app.taskChat.toolTaxonomy.leavingPlanMode"), completed: () => t("app.taskChat.toolTaxonomy.leftPlanMode"), family: "plan" },
  skill: { action: "read", running: () => t("app.taskChat.toolTaxonomy.loadingASkill"), completed: () => t("app.taskChat.toolTaxonomy.loadedASkill") },
  ask_user_question: { action: "request", running: () => t("app.taskChat.toolTaxonomy.requestingInput"), completed: () => t("app.taskChat.toolTaxonomy.requestedInput"), family: "question" },
  request_human_input: { action: "request", running: () => t("app.taskChat.toolTaxonomy.requestingInput"), completed: () => t("app.taskChat.toolTaxonomy.requestedInput"), family: "question", group: group("task_operation", "task operation", "task operations") },
  agent: { action: "start", running: () => t("app.taskChat.toolTaxonomy.startingASubagent"), completed: () => t("app.taskChat.toolTaxonomy.startedASubagent"), family: "agent" },
  task: { action: "start", running: () => t("app.taskChat.toolTaxonomy.startingASubagent"), completed: () => t("app.taskChat.toolTaxonomy.startedASubagent"), family: "agent" },
  task_output: { action: "read", running: () => t("app.taskChat.toolTaxonomy.checkingSubagentProgress"), completed: () => t("app.taskChat.toolTaxonomy.checkedSubagentProgress"), family: "agent" },
  task_stop: { action: "stop", running: () => t("app.taskChat.toolTaxonomy.stoppingASubagent"), completed: () => t("app.taskChat.toolTaxonomy.stoppedASubagent"), family: "agent" },
  send_message: { action: "post", running: () => t("app.taskChat.toolTaxonomy.messagingASubagent"), completed: () => t("app.taskChat.toolTaxonomy.messagedASubagent"), family: "agent" },
  spawn_agent: { action: "start", running: () => t("app.taskChat.toolTaxonomy.startingASubagent"), completed: () => t("app.taskChat.toolTaxonomy.startedASubagent"), family: "agent" },
  wait_agent: { action: "wait", running: () => t("app.taskChat.toolTaxonomy.checkingSubagentProgress"), completed: () => t("app.taskChat.toolTaxonomy.checkedSubagentProgress"), family: "agent" },
  wait_threads: { action: "wait", running: () => t("app.taskChat.toolTaxonomy.checkingTaskProgress"), completed: () => t("app.taskChat.toolTaxonomy.checkedTaskProgress"), family: "agent" },
  interrupt_agent: { action: "stop", running: () => t("app.taskChat.toolTaxonomy.interruptingASubagent"), completed: () => t("app.taskChat.toolTaxonomy.interruptedASubagent"), family: "agent" },
  report_findings: { action: "post", running: () => t("app.taskChat.toolTaxonomy.reportingFindings"), completed: () => t("app.taskChat.toolTaxonomy.reportedFindings"), family: "safety" },
  guardian_review: { action: "think", running: () => t("app.taskChat.toolTaxonomy.reviewingSafety"), completed: () => t("app.taskChat.toolTaxonomy.reviewedSafety"), family: "safety" },
  lsp: { action: "read", running: () => t("app.taskChat.toolTaxonomy.inspectingCodeIntelligence"), completed: () => t("app.taskChat.toolTaxonomy.inspectedCodeIntelligence") },
  compact_conversation: { action: "think", running: () => t("app.taskChat.toolTaxonomy.compactingContext"), completed: () => t("app.taskChat.toolTaxonomy.compactedContext") },
  image_generation: { action: "create", running: () => t("app.taskChat.toolTaxonomy.generatingAnImage"), completed: () => t("app.taskChat.toolTaxonomy.generatedAnImage"), family: "image" },
  view_image: { action: "read", running: () => t("app.taskChat.toolTaxonomy.viewingAnImage"), completed: () => t("app.taskChat.toolTaxonomy.viewedAnImage"), family: "image" },
  multi_tool_use_parallel: { action: "run", running: () => t("app.taskChat.toolTaxonomy.runningToolsInParallel"), completed: () => t("app.taskChat.toolTaxonomy.ranToolsInParallel") },
  get_task_context: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingTaskContext"), completed: () => t("app.taskChat.toolTaxonomy.readTaskContext") },
  get_task_history: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingTaskHistory"), completed: () => t("app.taskChat.toolTaxonomy.readTaskHistory") },
  list_documents: { action: "list", running: () => t("app.taskChat.toolTaxonomy.listingDocuments"), completed: () => t("app.taskChat.toolTaxonomy.listedDocuments") },
  read_document: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingADocument"), completed: () => t("app.taskChat.toolTaxonomy.readADocument") },
  list_document_revisions: { action: "list", running: () => t("app.taskChat.toolTaxonomy.listingDocumentRevisions"), completed: () => t("app.taskChat.toolTaxonomy.listedDocumentRevisions") },
  report_progress: { action: "post", running: () => t("app.taskChat.toolTaxonomy.reportingProgress"), completed: () => t("app.taskChat.toolTaxonomy.reportedProgress") },
  answer_status_question: { action: "post", running: () => t("app.taskChat.toolTaxonomy.answeringAStatusQuestion"), completed: () => t("app.taskChat.toolTaxonomy.answeredAStatusQuestion") },
  write_document: { action: "update", running: () => t("app.taskChat.toolTaxonomy.writingADocument"), completed: () => t("app.taskChat.toolTaxonomy.wroteADocument") },
  register_deliverable: { action: "create", running: () => t("app.taskChat.toolTaxonomy.registeringADeliverable"), completed: () => t("app.taskChat.toolTaxonomy.registeredADeliverable") },
  finish_task: { action: "finish", running: () => t("app.taskChat.toolTaxonomy.reportingCompletion"), completed: () => t("app.taskChat.toolTaxonomy.reportedCompletion") },
  paperclip_finish: { action: "finish", running: () => t("app.taskChat.toolTaxonomy.reportingCompletion"), completed: () => t("app.taskChat.toolTaxonomy.reportedCompletion") },
  block_task: { action: "block", running: () => t("app.taskChat.toolTaxonomy.reportingABlocker"), completed: () => t("app.taskChat.toolTaxonomy.reportedABlocker") },
  paperclip_block: { action: "block", running: () => t("app.taskChat.toolTaxonomy.reportingABlocker"), completed: () => t("app.taskChat.toolTaxonomy.reportedABlocker") },
  request_review: { action: "request", running: () => t("app.taskChat.toolTaxonomy.requestingReview"), completed: () => t("app.taskChat.toolTaxonomy.requestedReview") },
  list_agents: { action: "list", running: () => t("app.taskChat.toolTaxonomy.listingAgents"), completed: () => t("app.taskChat.toolTaxonomy.listedAgents") },
  get_agent: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingAgentDetails"), completed: () => t("app.taskChat.toolTaxonomy.readAgentDetails") },
  search_tasks: { action: "search", running: () => t("app.taskChat.toolTaxonomy.searchingTasks"), completed: () => t("app.taskChat.toolTaxonomy.searchedTasks") },
  list_approvals: { action: "list", running: () => t("app.taskChat.toolTaxonomy.listingApprovals"), completed: () => t("app.taskChat.toolTaxonomy.listedApprovals") },
  get_approval: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingAnApproval"), completed: () => t("app.taskChat.toolTaxonomy.readAnApproval") },
  get_approval_context: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingApprovalContext"), completed: () => t("app.taskChat.toolTaxonomy.readApprovalContext") },
  get_workspace_runtime: { action: "read", running: () => t("app.taskChat.toolTaxonomy.readingWorkspaceStatus"), completed: () => t("app.taskChat.toolTaxonomy.readWorkspaceStatus") },
  control_workspace_service: { action: "run", running: () => t("app.taskChat.toolTaxonomy.controllingAWorkspaceService"), completed: () => t("app.taskChat.toolTaxonomy.controlledAWorkspaceService") },
  set_dependencies: { action: "update", running: () => t("app.taskChat.toolTaxonomy.updatingTaskDependencies"), completed: () => t("app.taskChat.toolTaxonomy.updatedTaskDependencies") },
  create_task: { action: "create", running: () => t("app.taskChat.toolTaxonomy.creatingATask"), completed: () => t("app.taskChat.toolTaxonomy.createdATask") },
  request_approval: { action: "request", running: () => t("app.taskChat.toolTaxonomy.requestingApproval"), completed: () => t("app.taskChat.toolTaxonomy.requestedApproval") },
  decide_approval: { action: "update", running: () => t("app.taskChat.toolTaxonomy.decidingAnApproval"), completed: () => t("app.taskChat.toolTaxonomy.decidedAnApproval") },
  comment_on_approval: { action: "post", running: () => t("app.taskChat.toolTaxonomy.commentingOnAnApproval"), completed: () => t("app.taskChat.toolTaxonomy.commentedOnAnApproval") },
  schedule_wake: { action: "create", running: () => t("app.taskChat.toolTaxonomy.schedulingAWakeUp"), completed: () => t("app.taskChat.toolTaxonomy.scheduledAWakeUp"), family: "wait" },
  generic_api_request: { action: "request", running: () => t("app.taskChat.toolTaxonomy.callingThePaperclipAPI"), completed: () => t("app.taskChat.toolTaxonomy.calledThePaperclipAPI") },
};

const ACTION_PREFIXES: Record<Action, readonly string[]> = {
  read: ["get", "read", "inspect", "view"],
  list: ["list", "glob"],
  search: ["find", "search", "grep", "query", "lookup"],
  fetch: ["fetch", "browse"],
  open: ["open"],
  update: ["write", "edit", "update", "set", "patch", "upsert", "sync"],
  create: ["create", "add", "register", "upload"],
  delete: ["delete", "remove"],
  move: ["move", "rename"],
  run: ["run", "execute", "bash", "shell", "command"],
  request: ["request", "ask", "prompt"],
  post: ["send", "message", "comment", "report", "answer"],
  start: ["start", "spawn", "delegate"],
  stop: ["stop", "cancel", "interrupt"],
  wait: ["wait", "sleep", "poll"],
  finish: ["finish", "complete"],
  block: ["block"],
  think: ["think", "reason", "compact", "review"],
  switch: ["switch", "enter", "exit"],
  other: [],
};

const OPERATION_ACTIONS: Record<string, Action> = {
  read: "read",
  edit: "update",
  delete: "delete",
  move: "move",
  search: "search",
  list: "list",
  execute: "run",
  think: "think",
  fetch: "fetch",
  switch_mode: "switch",
};

function normalizedKey(name: string): string {
  return identifierWords(name).join("_");
}

function inferredAction(words: readonly string[]): Action | null {
  const first = words[0];
  if (!first) return null;
  for (const [action, prefixes] of Object.entries(ACTION_PREFIXES) as Array<[Action, readonly string[]]>) {
    if (prefixes.includes(first)) return action;
  }
  return null;
}

function actionFamily(action: Action): ToolFamily {
  if (action === "run") return "terminal";
  if (action === "read" || action === "list") return "read";
  if (action === "search") return "search";
  if (action === "fetch" || action === "open") return "web";
  if (["update", "create", "delete", "move"].includes(action)) return "edit";
  if (action === "request") return "question";
  if (action === "start" || action === "stop") return "agent";
  if (action === "wait") return "wait";
  return "other";
}

const FAMILY_ICONS: Record<ToolFamily, ToolIcon> = {
  terminal: Terminal,
  grep: SearchCode,
  search: Search,
  read: BookOpen,
  edit: FilePenLine,
  web: ChevronsLeftRightEllipsis,
  plan: ListChecks,
  question: CircleHelp,
  agent: Network,
  safety: ShieldCheck,
  image: Image,
  wait: Clock3,
  mcp: McpIcon,
  other: Wrench,
};

function actionCopy(action: Action, object: string | undefined): { running: string; completed: string } {
  const withObject = (objectKey: string, fallback: string) =>
    object ? t(objectKey, { object }) : t(fallback);
  switch (action) {
    case "read": return { running: withObject("app.taskChat.toolTaxonomy.readingObject", "app.taskChat.toolTaxonomy.readingData"), completed: withObject("app.taskChat.toolTaxonomy.readObject", "app.taskChat.toolTaxonomy.readData") };
    case "list": return { running: withObject("app.taskChat.toolTaxonomy.listingObject", "app.taskChat.toolTaxonomy.listingItems"), completed: withObject("app.taskChat.toolTaxonomy.listedObject", "app.taskChat.toolTaxonomy.listedItems") };
    case "search": return { running: withObject("app.taskChat.toolTaxonomy.searchingObject", "app.taskChat.toolTaxonomy.searching"), completed: withObject("app.taskChat.toolTaxonomy.searchedObject", "app.taskChat.toolTaxonomy.searched") };
    case "fetch": return { running: withObject("app.taskChat.toolTaxonomy.fetchingObject", "app.taskChat.toolTaxonomy.fetchingData"), completed: withObject("app.taskChat.toolTaxonomy.fetchedObject", "app.taskChat.toolTaxonomy.fetchedData") };
    case "open": return { running: withObject("app.taskChat.toolTaxonomy.openingObject", "app.taskChat.toolTaxonomy.openingItem"), completed: withObject("app.taskChat.toolTaxonomy.openedObject", "app.taskChat.toolTaxonomy.openedItem") };
    case "update": return { running: withObject("app.taskChat.toolTaxonomy.updatingObject", "app.taskChat.toolTaxonomy.updatingData"), completed: withObject("app.taskChat.toolTaxonomy.updatedObject", "app.taskChat.toolTaxonomy.updatedData") };
    case "create": return { running: withObject("app.taskChat.toolTaxonomy.creatingObject", "app.taskChat.toolTaxonomy.creatingItem"), completed: withObject("app.taskChat.toolTaxonomy.createdObject", "app.taskChat.toolTaxonomy.createdItem") };
    case "delete": return { running: withObject("app.taskChat.toolTaxonomy.deletingObject", "app.taskChat.toolTaxonomy.deletingItem"), completed: withObject("app.taskChat.toolTaxonomy.deletedObject", "app.taskChat.toolTaxonomy.deletedItem") };
    case "move": return { running: withObject("app.taskChat.toolTaxonomy.movingObject", "app.taskChat.toolTaxonomy.movingItem"), completed: withObject("app.taskChat.toolTaxonomy.movedObject", "app.taskChat.toolTaxonomy.movedItem") };
    case "run": return { running: t("app.taskChat.toolTaxonomy.runningACommand"), completed: t("app.taskChat.toolTaxonomy.ranACommand") };
    case "request": return { running: withObject("app.taskChat.toolTaxonomy.requestingObject", "app.taskChat.toolTaxonomy.requestingInput"), completed: withObject("app.taskChat.toolTaxonomy.requestedObject", "app.taskChat.toolTaxonomy.requestedInput") };
    case "post": return { running: withObject("app.taskChat.toolTaxonomy.postingObject", "app.taskChat.toolTaxonomy.postingUpdate"), completed: withObject("app.taskChat.toolTaxonomy.postedObject", "app.taskChat.toolTaxonomy.postedUpdate") };
    case "start": return { running: withObject("app.taskChat.toolTaxonomy.startingObject", "app.taskChat.toolTaxonomy.startingOperation"), completed: withObject("app.taskChat.toolTaxonomy.startedObject", "app.taskChat.toolTaxonomy.startedOperation") };
    case "stop": return { running: withObject("app.taskChat.toolTaxonomy.stoppingObject", "app.taskChat.toolTaxonomy.stoppingOperation"), completed: withObject("app.taskChat.toolTaxonomy.stoppedObject", "app.taskChat.toolTaxonomy.stoppedOperation") };
    case "wait": return { running: t("app.taskChat.toolTaxonomy.waiting"), completed: t("app.taskChat.toolTaxonomy.finishedWaiting") };
    case "finish": return { running: t("app.taskChat.toolTaxonomy.reportingCompletion"), completed: t("app.taskChat.toolTaxonomy.reportedCompletion") };
    case "block": return { running: t("app.taskChat.toolTaxonomy.reportingABlocker"), completed: t("app.taskChat.toolTaxonomy.reportedABlocker") };
    case "think": return { running: t("app.taskChat.toolTaxonomy.thinking"), completed: t("app.taskChat.toolTaxonomy.finishedThinking") };
    case "switch": return { running: withObject("app.taskChat.toolTaxonomy.switchingObject", "app.taskChat.toolTaxonomy.switchingMode"), completed: withObject("app.taskChat.toolTaxonomy.switchedObject", "app.taskChat.toolTaxonomy.switchedMode") };
    case "other": return { running: t("app.taskChat.toolTaxonomy.running"), completed: t("app.taskChat.toolTaxonomy.ran") };
  }
}

function defaultSummaryGroup(action: Action): ToolSummaryGroup {
  switch (action) {
    case "run": return group("command", "command", "commands");
    case "read":
    case "list": return group("read", "read", "reads");
    case "search": return group("search", "search", "searches");
    case "update":
    case "create":
    case "delete":
    case "move": return group("file_change", "file change", "file changes");
    case "start":
    case "stop": return group("delegation", "delegation", "delegations");
    case "wait": return group("wait", "wait", "waits");
    default: return group("tool_action", "tool action", "tool actions");
  }
}

function paperclipSummaryGroup(action: Action): ToolSummaryGroup {
  if (action === "read" || action === "list") return group("paperclip_read", "Paperclip read", "Paperclip reads");
  return group("task_operation", "task operation", "task operations");
}

/** Running copy for a tool that is only known by its humanized name. */
export function runningToolLabel(displayName: string): string {
  return t("app.taskChat.toolTaxonomy.runningNamedTool", { name: displayName });
}

/**
 * Resolve one tool into status-specific copy and iconography. Precedence is:
 * exact aliases, canonical ACP operation/kind, normalized verb, then a named
 * fallback. MCP remains visible as the source icon without losing semantics.
 */
export function toolActivityPresentation(input: ToolActivityPresentationInput): ToolActivityPresentation {
  const rawName = (input.name ?? "").trim();
  const parsedMcp = mcpToolIdentity(rawName);
  const namespace = (input.namespace ?? parsedMcp?.namespace ?? "").trim();
  // The name itself is authoritative for historical ACPX records that were
  // persisted as builtin before MCP transport normalization existed.
  const transport = (parsedMcp ? "mcp" : input.transport ?? "builtin").toLowerCase();
  const semanticName = (parsedMcp?.name ?? rawName).trim();
  const words = identifierWords(semanticName);
  const key = normalizedKey(semanticName);
  const exact = EXACT_ACTIONS[key];
  const operationAction = OPERATION_ACTIONS[(input.operation ?? "").trim().toLowerCase()];
  const inferred = inferredAction(words);
  const action = exact?.action ?? operationAction ?? inferred ?? "other";
  const confidence: ToolClassificationConfidence = exact
    ? "exact"
    : operationAction
      ? "kind"
      : inferred
        ? "inferred"
        : isGenericToolName(semanticName)
          ? "unnamed"
          : "fallback";
  const displayName = isGenericToolName(semanticName) ? t("app.taskChat.toolTaxonomy.unnamedTool") : humanizeToolName(semanticName);
  const identifierLikeName = /^[A-Za-z][A-Za-z0-9_.:-]*$/.test(semanticName);
  const objectWords = inferred && identifierLikeName && words.length > 1 ? words.slice(1) : [];
  const object = objectWords.length ? sentenceCase(objectWords).replace(/^./, (letter) => letter.toLowerCase()) : undefined;
  const copy = exact?.running && exact.completed
    ? { running: exact.running(), completed: exact.completed() }
    : action === "other"
      ? isGenericToolName(semanticName)
        ? { running: t("app.taskChat.toolTaxonomy.runningAnUnnamedTool"), completed: t("app.taskChat.toolTaxonomy.ranAnUnnamedTool") }
        : { running: runningToolLabel(displayName), completed: t("app.taskChat.toolTaxonomy.ranNamedTool", { name: displayName }) }
      : actionCopy(action, exact ? undefined : object);
  const semanticFamily = exact?.family ?? actionFamily(action);
  const family = transport === "mcp" ? "mcp" : semanticFamily;
  const sourceLabel = namespace
    ? humanizeToolName(namespace)
    : transport === "mcp"
      ? "MCP"
      : undefined;
  const summaryGroup = namespace.toLowerCase() === "paperclip"
    ? paperclipSummaryGroup(action)
    : exact?.group ?? defaultSummaryGroup(action);

  return {
    icon: FAMILY_ICONS[family],
    family,
    runningLabel: copy.running,
    completedLabel: copy.completed,
    failedLabel: t("app.taskChat.toolTaxonomy.failedLabel", { label: copy.completed }),
    interruptedLabel: t("app.taskChat.toolTaxonomy.stoppedLabel", { label: copy.running }),
    displayName,
    sourceLabel,
    technicalName: rawName || undefined,
    confidence,
    summaryGroup,
  };
}

/** Compact compatibility mapping used by legacy tool rows and live pills. */
export function toolTaxonomy(name: string | undefined | null): ToolTaxonomyEntry {
  const presentation = toolActivityPresentation({ name });
  return {
    family: presentation.family,
    icon: presentation.icon,
    verbLabel: presentation.runningLabel,
  };
}

/** Icons for tool-free informative statuses. */
export function statusLabelIcon(label: string | undefined | null): ToolIcon | null {
  const raw = (label ?? "").trim().toLowerCase();
  if (raw === "thinking") return Brain;
  if (raw === "responding" || raw.startsWith("responding (")) return MessageSquareReply;
  return null;
}
