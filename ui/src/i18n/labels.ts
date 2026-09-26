import type { TFunction } from "i18next";

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Title-cased task status label, e.g. "In Progress". Unknown values keep the legacy formatting. */
export function issueStatusLabel(t: TFunction, status: string): string {
  return t(`app.common.issueStatus.${status}`, { defaultValue: titleCase(status) });
}

/** Lower-case status label for generic badges (runs, goals, approvals, agents). */
export function statusLabel(t: TFunction, status: string): string {
  return t(`app.common.status.${status}`, { defaultValue: status.replace(/[_-]/g, " ") });
}

export function agentStatusLabel(t: TFunction, status: string): string {
  return t(`app.common.agentStatus.${status}`, { defaultValue: status.replace(/_/g, " ") });
}

export function priorityLabel(t: TFunction, priority: string): string {
  return t(`app.common.priority.${priority}`, { defaultValue: titleCase(priority) });
}

/** Secret lifecycle labels for prose; API values and unknown diagnostics stay unchanged. */
export function secretStatusLabel(t: TFunction, status: string): string {
  switch (status) {
    case "active": return t("app.secrets.secretStatus.active");
    case "disabled": return t("app.common.status.disabled");
    case "archived": return t("app.common.status.archived");
    case "deleted": return t("app.secrets.secretStatus.deleted");
    default: return status;
  }
}
