import { Brain, CirclePause, Gauge, Layers3 } from "lucide-react";
import type { TaskChatActivityPhaseItem } from "./task-chat-model";
import {
  toolActivityPresentation,
  type ToolFamily,
  type ToolIcon,
} from "./tool-taxonomy";
import { protocolActivityPresentation } from "./task-chat-activity-presentation";
import { t } from "@/i18n";

type Activity = TaskChatActivityPhaseItem["items"][number];
const labels: Record<ToolFamily, () => string> = {
  terminal: () => t("app.taskChat.completedActivitySummary.ranCommands"),
  grep: () => t("app.taskChat.completedActivitySummary.searchedFiles"),
  search: () => t("app.taskChat.completedActivitySummary.searchedFiles"),
  read: () => t("app.taskChat.completedActivitySummary.readFiles"),
  edit: () => t("app.taskChat.completedActivitySummary.editedFiles"),
  web: () => t("app.taskChat.completedActivitySummary.searchedTheWeb"),
  plan: () => t("app.taskChat.completedActivitySummary.workedOnAPlan"),
  question: () => t("app.taskChat.completedActivitySummary.requestedInput"),
  agent: () => t("app.taskChat.completedActivitySummary.workedWithAgents"),
  safety: () => t("app.taskChat.completedActivitySummary.reviewedSafety"),
  image: () => t("app.taskChat.completedActivitySummary.workedWithImages"),
  wait: () => t("app.taskChat.completedActivitySummary.waited"),
  mcp: () => t("app.taskChat.completedActivitySummary.usedConnectedTools"),
  other: () => t("app.taskChat.completedActivitySummary.usedTools"),
};

/** Describe observed activities, never infer success from a finished group. */
export function completedActivitySummary(items: Activity[]) {
  const categories = new Map<
    string,
    { label: string; icon: ToolIcon; order: number }
  >();
  const add = (label: string, icon: ToolIcon, order = 0) => {
    const existing = categories.get(label);
    if (!existing || order < existing.order)
      categories.set(label, { label, icon, order });
  };
  const tools: Array<{
    family: ToolFamily;
    icon: ToolIcon;
    completed: boolean;
    order: number;
  }> = [];
  for (const [order, item] of items.entries()) {
    if (item.kind === "tool") {
      const p = toolActivityPresentation({
        name: item.rawName ?? item.name,
        target: item.target,
      });
      tools.push({ ...p, order, completed: item.status === "completed" });
    } else if (item.kind === "protocol") {
      if (
        item.surface === "provider_activity" &&
        item.family === "tool_execution"
      ) {
        const value = (label: string) =>
          item.details.find((d) => d.label === label)?.value;
        const p = toolActivityPresentation({
          name: value("Name"),
          operation: value("Operation"),
          transport: value("Transport"),
          namespace: value("Namespace"),
          target: value("Target"),
        });
        tools.push({ ...p, order, completed: item.status === "completed" });
      } else {
        const p = protocolActivityPresentation(item);
        if (!p) continue;
        const family =
          item.surface === "provider_activity" ? item.family : item.surface;
        const label =
          (
            {
              research: () => t("app.taskChat.completedActivitySummary.searchedTheWeb"),
              plan: () => t("app.taskChat.completedActivitySummary.workedOnAPlan"),
              delegation: () => t("app.taskChat.completedActivitySummary.workedWithAgents"),
              artifact: () => t("app.taskChat.completedActivitySummary.workedWithArtifacts"),
              context: () => t("app.taskChat.completedActivitySummary.managedContext"),
              memory: () => t("app.taskChat.completedActivitySummary.checkedMemory"),
              model_identity: () => t("app.taskChat.completedActivitySummary.checkedModelSettings"),
              review: () => t("app.taskChat.completedActivitySummary.workedInReviewMode"),
              hook: () => t("app.taskChat.completedActivitySummary.ranHooks"),
              safety: () => t("app.taskChat.completedActivitySummary.reviewedSafety"),
              terminal: () => t("app.taskChat.completedActivitySummary.ranCommands"),
              wait: () => t("app.taskChat.completedActivitySummary.waited"),
              provider_notice: () => t("app.taskChat.completedActivitySummary.receivedAProviderUpdate"),
              workspace_change: () => t("app.taskChat.completedActivitySummary.workedOnFiles"),
              workspace_file: () => t("app.taskChat.completedActivitySummary.referencedFiles"),
              resource: () => t("app.taskChat.completedActivitySummary.addedResources"),
            } as Record<string, () => string>
          )[family]?.() ?? t("app.taskChat.completedActivitySummary.usedTools");
        add(label, p.icon, order);
      }
    }
  }
  const completedFamilies = new Set(
    tools.filter((tool) => tool.completed).map((tool) => tool.family),
  );
  // Merge repeated families and retries. Terminal is an action, not an exit-status claim.
  for (const tool of tools) {
    const succeeded = completedFamilies.has(tool.family);
    const label =
      tool.family === "read" && !succeeded
        ? t("app.taskChat.completedActivitySummary.checkedFiles")
        : tool.family === "edit" && !succeeded
          ? t("app.taskChat.completedActivitySummary.workedOnFiles")
          : labels[tool.family]();
    add(label, tool.icon, tool.order);
  }
  if (!categories.size) {
    if (items.some((item) => item.kind === "thinking"))
      add(t("app.taskChat.completedActivitySummary.thoughtThroughTheTask"), Brain);
    else if (items.some((item) => item.kind === "marker"))
      add(t("app.taskChat.completedActivitySummary.activityStopped"), CirclePause);
    else add(t("app.taskChat.completedActivitySummary.recordedUsage"), Gauge);
  }
  const values = [...categories.values()].sort((a, b) => a.order - b.order);
  const join = (parts: string[]) =>
    parts
      .map((p, i) => (i ? p.charAt(0).toLowerCase() + p.slice(1) : p))
      .reduce((previous, next) =>
        t("app.taskChat.completedActivitySummary.listJoin", { previous, next }),
      );
  const fullLabel = join(values.map((v) => v.label));
  return {
    label:
      values.length > 3
        ? t("app.taskChat.completedActivitySummary.andMore", {
            items: join(values.slice(0, 2).map((v) => v.label)),
          })
        : fullLabel,
    fullLabel,
    icon: values.length === 1 ? values[0].icon : Layers3,
  };
}
