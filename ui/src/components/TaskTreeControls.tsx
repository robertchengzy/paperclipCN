import { t as translateCopy, useTranslation } from "@/i18n";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PauseCircle, PlayCircle, Repeat, XCircle } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

/** Shared by the task header and its Storybook composition. */
export function TaskTreeControlMenuItems({
  scope,
  canPause,
  canResume,
  canCancel,
  canRestore,
  pending,
  onPause,
  onResume,
  onCancel,
  onRestore,
}: {
  scope: "leaf" | "subtree";
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canRestore: boolean;
  pending?: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRestore: () => void;
}) {
  const { t: translateCopy } = useTranslation();
  const itemClass =
    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 disabled:opacity-50 disabled:pointer-events-none";
  return (
    <>
      {canPause ? (
        <button disabled={pending} className={itemClass} onClick={onPause}>
          <PauseCircle className="h-3 w-3" />
          {scope === "leaf" ? translateCopy("app.issueUi.taskTreeControls.pauseWork") : translateCopy("app.issueUi.taskTreeControls.pauseSubtree")}
        </button>
      ) : null}
      {canResume ? (
        <button disabled={pending} className={itemClass} onClick={onResume}>
          <PlayCircle className="h-3 w-3" />
          {scope === "leaf" ? translateCopy("app.issueUi.taskTreeControls.resumeWork") : translateCopy("app.issueUi.taskTreeControls.resumeSubtree")}
        </button>
      ) : null}
      {canCancel ? (
        <button
          disabled={pending}
          className={`${itemClass} text-destructive`}
          onClick={onCancel}
        >
          <XCircle className="h-3 w-3" />
          {translateCopy("app.issueUi.taskTreeControls.cancelSubtree")}
        </button>
      ) : null}
      {canRestore ? (
        <button disabled={pending} className={itemClass} onClick={onRestore}>
          <Repeat className="h-3 w-3" />
          {translateCopy("app.issueUi.taskTreeControls.restoreSubtree")}
        </button>
      ) : null}
    </>
  );
}

export function TaskTreeControlDialog({
  open,
  onOpenChange,
  mode,
  scope,
  affectedCount,
  affectedAgentCount,
  loading,
  error,
  pending,
  valid,
  wakeAgents,
  onWakeAgentsChange,
  onRetry,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "resume" | "cancel" | "restore";
  scope: "leaf" | "subtree";
  affectedCount: number;
  affectedAgentCount: number;
  loading: boolean;
  error?: string | null;
  pending: boolean;
  valid: boolean;
  wakeAgents: boolean;
  onWakeAgentsChange: (wake: boolean) => void;
  onRetry: () => void;
  onApply: () => void;
}) {
  const { t: translateCopy } = useTranslation();
  const cancel = mode === "cancel";
  const tasks = affectedCount === 1 ? translateCopy("app.issueUi.taskTreeControls.oneTask", { count: affectedCount }) : translateCopy("app.issueUi.taskTreeControls.manyTasks", { count: affectedCount });
  const title = cancel
    ? translateCopy("app.issueUi.taskTreeControls.cancelSubtree2")
    : mode === "restore"
      ? translateCopy("app.issueUi.taskTreeControls.restoreSubtree2")
      : scope === "leaf"
        ? translateCopy("app.issueUi.taskTreeControls.resumeWork")
        : translateCopy("app.issueUi.taskTreeControls.resumeSubtree");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="max-h-(--sz-calc-18) overflow-y-auto sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {loading
              ? translateCopy("app.issueUi.taskTreeControls.loading")
              : cancel
                ? translateCopy("app.issueUi.taskTreeControls.tasksCancelled", { tasks })
                : mode === "restore" ? translateCopy("app.issueUi.taskTreeControls.tasksRestored", { tasks }) : translateCopy("app.issueUi.taskTreeControls.tasksResumed", { tasks })}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onRetry}
            >
              {translateCopy("app.issueUi.taskTreeControls.retryPreview")}
            </Button>
          </div>
        ) : null}
        {!cancel ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wakeAgents}
              disabled={pending || loading || affectedAgentCount === 0}
              onChange={(event) => onWakeAgentsChange(event.target.checked)}
            />
            {translateCopy("app.issueUi.taskTreeControls.wakeCount", { count: affectedAgentCount })}
          </label>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancel ? translateCopy("app.issueUi.taskTreeControls.keepTasks") : translateCopy("app.issueUi.taskTreeControls.close")}
          </Button>
          <Button
            variant={cancel ? "destructive" : "default"}
            disabled={pending || loading || !!error || !valid}
            onClick={onApply}
          >
            {pending
              ? translateCopy("app.issueUi.taskTreeControls.applying")
              : cancel
                ? translateCopy("app.issueUi.taskTreeControls.cancelTasks", { tasks })
                : mode === "restore"
                  ? translateCopy("app.issueUi.taskTreeControls.restoreTasks", { tasks })
                  : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Quiet, persistent pause feedback shared by the task page and previews. */
export function TaskPauseNotice({
  scope,
  onResume,
  pending,
  className,
  resumeLink,
}: {
  scope: "leaf" | "subtree";
  onResume?: () => void;
  pending?: boolean;
  className?: string;
  resumeLink?: ReactNode;
}) {
  const { t: translateCopy } = useTranslation();
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <span>
        {scope === "subtree" ? translateCopy("app.issueUi.taskTreeControls.subtreeIsPaused") : translateCopy("app.issueUi.taskTreeControls.taskIsPaused")}
      </span>
      {resumeLink ??
        (onResume ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={onResume}
          >
            {scope === "subtree" ? translateCopy("app.issueUi.taskTreeControls.resumeSubtree") : translateCopy("app.issueUi.taskTreeControls.resumeWork")}
          </Button>
        ) : null)}
    </div>
  );
}
