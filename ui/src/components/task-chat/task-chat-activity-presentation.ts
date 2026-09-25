import {
  AlertTriangle,
  BookOpen,
  Bot,
  Box,
  Clock3,
  Database,
  FileCheck2,
  FilePenLine,
  FileText,
  GitBranch,
  ListChecks,
  PackageCheck,
  Search,
  ShieldCheck,
  TerminalSquare,
  Users,
} from "lucide-react";
import { t } from "@/i18n";
import type {
  TaskChatMaterializedResourceItem,
  TaskChatProtocolItem,
  TaskChatProviderActivityItem,
  TaskChatWorkspaceChangeItem,
  TaskChatWorkspaceFileItem,
} from "./task-chat-model";
import {
  humanizeToolName,
  isGenericToolName,
  mcpToolIdentity,
  runningToolLabel,
  toolActivityPresentation,
  type ToolIcon,
} from "./tool-taxonomy";

export interface TaskChatActivityPresentation {
  icon: ToolIcon;
  runningLabel: string;
  completedLabel: string;
  failedLabel?: string;
  interruptedLabel?: string;
  detail?: string;
}

function providerDetail(item: TaskChatProviderActivityItem, ...labels: string[]): string | undefined {
  return item.details.find((entry) => labels.includes(entry.label))?.value;
}

function meaningfulToolDetail(value: string | undefined): string | undefined {
  if (!value || isGenericToolName(value) || /^tool(?:\s+|_)call\b/i.test(value)) return undefined;
  return value;
}

export function providerActivityPresentation(item: TaskChatProviderActivityItem): TaskChatActivityPresentation {
  const detail = item.summary
    ?? providerDetail(item, "Query", "URL", "Target", "Name", "Reference", "Reason", "Summary");
  switch (item.family) {
    case "research": {
      const action = providerDetail(item, "Action")?.toLowerCase();
      if (action === "open_page") {
        return { icon: Search, runningLabel: t("app.taskChat.taskChatActivityPresentation.openingAWebPage"), completedLabel: t("app.taskChat.taskChatActivityPresentation.openedAWebPage"), failedLabel: t("app.taskChat.taskChatActivityPresentation.couldntOpenTheWebPage"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.stoppedOpeningTheWebPage"), detail };
      }
      if (action === "find_in_page") {
        return { icon: Search, runningLabel: t("app.taskChat.taskChatActivityPresentation.searchingThePage"), completedLabel: t("app.taskChat.taskChatActivityPresentation.searchedThePage"), failedLabel: t("app.taskChat.taskChatActivityPresentation.pageSearchFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.pageSearchStopped"), detail };
      }
      return { icon: Search, runningLabel: t("app.taskChat.taskChatActivityPresentation.searchingTheWeb"), completedLabel: t("app.taskChat.taskChatActivityPresentation.searchedTheWeb"), failedLabel: t("app.taskChat.taskChatActivityPresentation.webSearchFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.webSearchStopped"), detail };
    }
    case "tool_execution": {
      const name = providerDetail(item, "Name");
      const target = providerDetail(item, "Target");
      const progress = providerDetail(item, "Progress");
      const tool = toolActivityPresentation({
        name,
        transport: providerDetail(item, "Transport"),
        namespace: providerDetail(item, "Namespace"),
        operation: providerDetail(item, "Operation"),
        target,
        progress,
      });
      const boundedActivity = meaningfulToolDetail(item.summary)
        ?? meaningfulToolDetail(progress)
        ?? meaningfulToolDetail(target);
      const activityIsIdentity = Boolean(
        boundedActivity && name && humanizeToolName(boundedActivity) === humanizeToolName(name),
      );
      const technicalName = name ? mcpToolIdentity(name)?.name ?? name : tool.displayName;
      const source = tool.sourceLabel
        ? `${tool.sourceLabel} · ${technicalName}`
        : name && !isGenericToolName(name) && tool.runningLabel !== runningToolLabel(humanizeToolName(name))
          ? name
          : undefined;
      return {
        icon: tool.icon,
        runningLabel: tool.runningLabel,
        completedLabel: tool.completedLabel,
        failedLabel: tool.failedLabel,
        interruptedLabel: tool.interruptedLabel,
        detail: [activityIsIdentity ? undefined : boundedActivity, source].filter(Boolean).join(" · ") || undefined,
      };
    }
    case "plan":
      return { icon: ListChecks, runningLabel: t("app.taskChat.taskChatActivityPresentation.updatingThePlan"), completedLabel: t("app.taskChat.taskChatActivityPresentation.updatedThePlan"), failedLabel: t("app.taskChat.taskChatActivityPresentation.planUpdateFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.planUpdateStopped"), detail };
    case "delegation": {
      const action = providerDetail(item, "Action")?.toLowerCase();
      if (action === "message") return { icon: Users, runningLabel: t("app.taskChat.taskChatActivityPresentation.messagingASubagent"), completedLabel: t("app.taskChat.taskChatActivityPresentation.messagedASubagent"), failedLabel: t("app.taskChat.taskChatActivityPresentation.subagentMessageFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.subagentMessageStopped"), detail };
      if (action === "resume") return { icon: Users, runningLabel: t("app.taskChat.taskChatActivityPresentation.resumingASubagent"), completedLabel: t("app.taskChat.taskChatActivityPresentation.resumedASubagent"), failedLabel: t("app.taskChat.taskChatActivityPresentation.couldntResumeTheSubagent"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.subagentResumeStopped"), detail };
      if (action === "close") return { icon: Users, runningLabel: t("app.taskChat.taskChatActivityPresentation.closingASubagent"), completedLabel: t("app.taskChat.taskChatActivityPresentation.closedASubagent"), failedLabel: t("app.taskChat.taskChatActivityPresentation.couldntCloseTheSubagent"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.subagentCloseStopped"), detail };
      if (action === "wait") return { icon: Users, runningLabel: t("app.taskChat.taskChatActivityPresentation.waitingForSubagents"), completedLabel: t("app.taskChat.taskChatActivityPresentation.finishedWaitingForSubagents"), failedLabel: t("app.taskChat.taskChatActivityPresentation.subagentWaitFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.stoppedWaitingForSubagents"), detail };
      return { icon: Users, runningLabel: t("app.taskChat.taskChatActivityPresentation.startingASubagent"), completedLabel: t("app.taskChat.taskChatActivityPresentation.startedASubagent"), failedLabel: t("app.taskChat.taskChatActivityPresentation.subagentStartFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.subagentStartStopped"), detail };
    }
    case "model_identity":
      return item.eventType === "model.route.changed"
        ? { icon: Bot, runningLabel: t("app.taskChat.taskChatActivityPresentation.switchingModels"), completedLabel: t("app.taskChat.taskChatActivityPresentation.switchedModels"), failedLabel: t("app.taskChat.taskChatActivityPresentation.modelSwitchFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.modelSwitchStopped"), detail }
        : { icon: Bot, runningLabel: t("app.taskChat.taskChatActivityPresentation.verifyingTheModel"), completedLabel: t("app.taskChat.taskChatActivityPresentation.verifiedTheModel"), failedLabel: t("app.taskChat.taskChatActivityPresentation.modelVerificationFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.modelVerificationStopped"), detail };
    case "context":
      return { icon: Database, runningLabel: t("app.taskChat.taskChatActivityPresentation.compactingContext"), completedLabel: t("app.taskChat.taskChatActivityPresentation.compactedContext"), failedLabel: t("app.taskChat.taskChatActivityPresentation.contextCompactionFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.contextCompactionStopped"), detail };
    case "artifact": {
      const viewed = item.eventType === "artifact.viewed";
      return viewed
        ? { icon: Box, runningLabel: t("app.taskChat.taskChatActivityPresentation.viewingAnArtifact"), completedLabel: t("app.taskChat.taskChatActivityPresentation.viewedAnArtifact"), failedLabel: t("app.taskChat.taskChatActivityPresentation.couldntViewTheArtifact"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.artifactViewStopped"), detail }
        : { icon: Box, runningLabel: t("app.taskChat.taskChatActivityPresentation.generatingAnArtifact"), completedLabel: t("app.taskChat.taskChatActivityPresentation.generatedAnArtifact"), failedLabel: t("app.taskChat.taskChatActivityPresentation.artifactGenerationFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.artifactGenerationStopped"), detail };
    }
    case "review": {
      const state = providerDetail(item, "State")?.toLowerCase();
      return state === "exited"
        ? { icon: FileCheck2, runningLabel: t("app.taskChat.taskChatActivityPresentation.leavingReviewMode"), completedLabel: t("app.taskChat.taskChatActivityPresentation.leftReviewMode"), failedLabel: t("app.taskChat.taskChatActivityPresentation.couldntLeaveReviewMode"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.reviewModeChangeStopped"), detail }
        : { icon: FileCheck2, runningLabel: t("app.taskChat.taskChatActivityPresentation.enteringReviewMode"), completedLabel: t("app.taskChat.taskChatActivityPresentation.enteredReviewMode"), failedLabel: t("app.taskChat.taskChatActivityPresentation.couldntEnterReviewMode"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.reviewModeChangeStopped"), detail };
    }
    case "hook":
      return { icon: GitBranch, runningLabel: t("app.taskChat.taskChatActivityPresentation.runningAHook"), completedLabel: t("app.taskChat.taskChatActivityPresentation.ranAHook"), failedLabel: t("app.taskChat.taskChatActivityPresentation.hookFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.hookStopped"), detail };
    case "memory":
      return { icon: BookOpen, runningLabel: t("app.taskChat.taskChatActivityPresentation.checkingMemory"), completedLabel: t("app.taskChat.taskChatActivityPresentation.referencedMemory"), failedLabel: t("app.taskChat.taskChatActivityPresentation.memoryLookupFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.memoryLookupStopped"), detail };
    case "safety":
      return { icon: ShieldCheck, runningLabel: t("app.taskChat.taskChatActivityPresentation.reviewingSafety"), completedLabel: t("app.taskChat.taskChatActivityPresentation.reviewedSafety"), failedLabel: t("app.taskChat.taskChatActivityPresentation.safetyReviewFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.safetyReviewStopped"), detail };
    case "terminal":
      return { icon: TerminalSquare, runningLabel: t("app.taskChat.taskChatActivityPresentation.sendingTerminalInput"), completedLabel: t("app.taskChat.taskChatActivityPresentation.sentTerminalInput"), failedLabel: t("app.taskChat.taskChatActivityPresentation.terminalInputFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.terminalInputStopped"), detail };
    case "wait":
      return { icon: Clock3, runningLabel: t("app.taskChat.taskChatActivityPresentation.waiting"), completedLabel: t("app.taskChat.taskChatActivityPresentation.finishedWaiting"), failedLabel: t("app.taskChat.taskChatActivityPresentation.waitFailed"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.waitStopped"), detail };
    case "provider_notice":
      return { icon: AlertTriangle, runningLabel: t("app.taskChat.taskChatActivityPresentation.providerNotice"), completedLabel: t("app.taskChat.taskChatActivityPresentation.providerNotice"), failedLabel: t("app.taskChat.taskChatActivityPresentation.providerError"), interruptedLabel: t("app.taskChat.taskChatActivityPresentation.providerNotice"), detail };
  }
}

function workspaceChangePresentation(item: TaskChatWorkspaceChangeItem): TaskChatActivityPresentation {
  const count = item.totals.files || item.files.length;
  const detail = count > 0
    ? count === 1
      ? t("app.taskChat.taskChatActivityPresentation.oneFile")
      : t("app.taskChat.taskChatActivityPresentation.manyFiles", { count })
    : undefined;
  return { icon: FilePenLine, runningLabel: t("app.taskChat.taskChatActivityPresentation.editingFiles"), completedLabel: t("app.taskChat.taskChatActivityPresentation.editedFiles"), detail };
}

function workspaceFilePresentation(item: TaskChatWorkspaceFileItem): TaskChatActivityPresentation {
  return {
    icon: FileText,
    runningLabel: t("app.taskChat.taskChatActivityPresentation.referencingAFile"),
    completedLabel: t("app.taskChat.taskChatActivityPresentation.referencedAFile"),
    detail: item.line == null ? item.path : `${item.path}:${item.line}`,
  };
}

function resourcePresentation(item: TaskChatMaterializedResourceItem): TaskChatActivityPresentation {
  return {
    icon: item.resourceKind === "document" ? FileText : PackageCheck,
    runningLabel: t("app.taskChat.taskChatActivityPresentation.savingAResource"),
    completedLabel: item.resourceKind === "document" ? t("app.taskChat.taskChatActivityPresentation.addedADocument") : t("app.taskChat.taskChatActivityPresentation.addedADeliverable"),
    detail: item.title,
  };
}

export function protocolActivityPresentation(item: TaskChatProtocolItem): TaskChatActivityPresentation | null {
  switch (item.surface) {
    case "provider_activity": return providerActivityPresentation(item);
    case "workspace_change": return workspaceChangePresentation(item);
    case "workspace_file": return workspaceFilePresentation(item);
    case "resource": return resourcePresentation(item);
    case "runtime_request":
    case "run_result":
    case "run_terminal":
      return null;
  }
}

export function protocolActivityIsRunning(item: TaskChatProtocolItem): boolean {
  if (item.surface === "provider_activity") return item.status === "running";
  if (item.surface === "workspace_change") return !item.complete;
  return false;
}

export function protocolActivityLabel(item: TaskChatProtocolItem, presentation: TaskChatActivityPresentation): string {
  if (item.surface !== "provider_activity") {
    return protocolActivityIsRunning(item) ? presentation.runningLabel : presentation.completedLabel;
  }
  if (item.status === "failed") return presentation.failedLabel ?? t("app.taskChat.taskChatActivityPresentation.failedLabel", { label: presentation.completedLabel });
  if (item.status === "interrupted") return presentation.interruptedLabel ?? t("app.taskChat.taskChatActivityPresentation.interruptedLabel", { label: presentation.completedLabel });
  return item.status === "running" ? presentation.runningLabel : presentation.completedLabel;
}
