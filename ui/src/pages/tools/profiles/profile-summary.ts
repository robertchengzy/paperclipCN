import type { ToolProfileStatus, ToolProfileSummary, ToolProfileWithDetails } from "@paperclipai/shared";
import { t } from "@/i18n";

/**
 * Prosumer copy for the access-profile index (PAP-10997, AP1). Reads the
 * server-computed `summary` and renders the friendly "Allows" / "Assigned to"
 * lines the table shows. Vocabulary gate: nothing here says
 * binding/entry/selector/priority — only "tools", "apps", "agents".
 */

function toolCount(n: number): string {
  return n === 1 ? t("app.tools.profileSummary.oneTool") : t("app.tools.profileSummary.manyTools", { count: n });
}

function appCount(n: number): string {
  return n === 1 ? t("app.tools.profileSummary.oneApp") : t("app.tools.profileSummary.manyApps", { count: n });
}

/** "9 tools · 3 apps" / "All tools" / "All except 2 tools". */
export function allowsLabel(summary: ToolProfileSummary): string {
  if (summary.accessMode === "all_except") {
    return summary.excludedToolCount === 0
      ? t("app.tools.profileSummary.allTools")
      : t("app.tools.profileSummary.allExcept", { tools: toolCount(summary.excludedToolCount) });
  }
  const parts = [toolCount(summary.allowedToolCount)];
  if (summary.allowedApplicationCount > 0) {
    parts.push(appCount(summary.allowedApplicationCount));
  }
  return parts.join(" · ");
}

export interface AssignedLabel {
  text: string;
  /** A profile with no assignment has no effect — the index shows a quiet hint. */
  unassigned: boolean;
}

/** "Organization default" / "2 agents" / "Not assigned yet". */
export function assignedLabel(summary: ToolProfileSummary): AssignedLabel {
  if (summary.isCompanyDefault) return { text: t("app.tools.profileSummary.organizationDefault"), unassigned: false };
  if (summary.appliesToAgentCount > 0) {
    const count = summary.appliesToAgentCount;
    return { text: count === 1 ? t("app.tools.profileSummary.oneAgent") : t("app.tools.profileSummary.manyAgents", { count }), unassigned: false };
  }
  if (summary.assignmentCount > 0) {
    const count = summary.assignmentCount;
    return { text: count === 1 ? t("app.tools.profileSummary.oneAssignment") : t("app.tools.profileSummary.manyAssignments", { count }), unassigned: false };
  }
  return { text: t("app.tools.profileSummary.notAssignedYet"), unassigned: true };
}

// Getters so each read resolves in the current UI language.
export const STATUS_LABEL: Record<ToolProfileStatus, string> = {
  get draft() {
    return t("app.common.states.draft");
  },
  get active() {
    return t("app.common.states.active");
  },
  get disabled() {
    return t("app.tools.profileSummary.statusOff");
  },
  get archived() {
    return t("app.common.states.archived");
  },
};

export function isDraft(profile: Pick<ToolProfileWithDetails, "status">): boolean {
  return profile.status === "draft";
}
