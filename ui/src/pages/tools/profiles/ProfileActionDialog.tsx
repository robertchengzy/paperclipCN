import { AlertTriangle } from "lucide-react";
import type { ToolProfileWithDetails } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";

export type ProfileActionDialogKind = "archive" | "delete" | "restore";

export function ProfileActionDialog({
  kind,
  profile,
  pending,
  onClose,
  onArchive,
  onRestore,
  onDelete,
}: {
  kind: ProfileActionDialogKind | null;
  profile: ToolProfileWithDetails | null;
  pending: boolean;
  onClose: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  if (!kind || !profile) return null;

  const defaultDeleteBlocked = kind === "delete" && profile.summary.isCompanyDefault;
  const copy = {
    archive: {
      title: t("app.tools.profileActionDialog.archiveTitle"),
      body:
        profile.summary.appliesToAgentCount === 1
          ? t("app.tools.profileActionDialog.archiveBodyOne")
          : t("app.tools.profileActionDialog.archiveBodyMany", { count: profile.summary.appliesToAgentCount }),
      confirm: t("app.common.actions.archive"),
      action: onArchive,
    },
    restore: {
      title: t("app.tools.profileActionDialog.restoreTitle"),
      body: t("app.tools.profileActionDialog.restoreBody"),
      confirm: t("app.common.actions.restore"),
      action: onRestore,
    },
    delete: {
      title: t("app.tools.profileActionDialog.deleteTitle"),
      body: defaultDeleteBlocked
        ? t("app.tools.profileActionDialog.deleteBlockedBody")
        : profile.summary.assignmentCount === 1
          ? t("app.tools.profileActionDialog.deleteBodyOne")
          : t("app.tools.profileActionDialog.deleteBodyMany", { count: profile.summary.assignmentCount }),
      confirm: t("app.common.actions.delete"),
      action: onDelete,
    },
  }[kind];

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        {defaultDeleteBlocked ? (
          <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("app.tools.profileActionDialog.deleteBlockedHint")}</span>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("app.common.actions.cancel")}</Button>
          <Button
            variant={kind === "delete" ? "destructive" : "default"}
            disabled={pending || defaultDeleteBlocked}
            onClick={copy.action}
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
