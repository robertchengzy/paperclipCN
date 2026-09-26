import { safeWorkspaceRestorePath } from "@paperclipai/shared";
import { t } from "@/i18n";

export function workspaceRestoreMarkerDetail(input: {
  result: Record<string, unknown> | null | undefined;
  savedPlan: boolean;
  hasResponse: boolean;
}): string {
  const parts = [input.savedPlan
    ? t("app.lib.workspaceRestoreMarker.failedAfterPlan")
    : t("app.lib.workspaceRestoreMarker.failed")];
  parts.push(t("app.lib.workspaceRestoreMarker.filesNeedRecovery"));
  if (!input.hasResponse && input.result?.finalResponseRecorded === false) {
    parts.push(t("app.lib.workspaceRestoreMarker.noFinalResponse"));
  }
  const relativePath = safeWorkspaceRestorePath(input.result?.workspaceRestorePath);
  if (relativePath) parts.push(t("app.lib.workspaceRestoreMarker.affectedPath", { path: relativePath }));
  return parts.join(" ");
}
