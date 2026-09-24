import { t } from "@/i18n";
import { formatDateTime } from "./utils";

type RetryAwareRun = {
  status: string;
  retryOfRunId?: string | null;
  scheduledRetryAt?: string | Date | null;
  scheduledRetryAttempt?: number | null;
  scheduledRetryReason?: string | null;
  retryExhaustedReason?: string | null;
};

export type RunRetryStateSummary = {
  kind: "scheduled" | "exhausted" | "attempted";
  badgeLabel: string;
  tone: string;
  detail: string | null;
  secondary: string | null;
  retryOfRunId: string | null;
};

const retryReasonLabels = (): Record<string, string> => ({
  transient_failure: t("app.shared.retry.reasons.transientFailure"),
  missing_issue_comment: t("app.shared.retry.reasons.missingIssueComment"),
  process_lost: t("app.shared.retry.reasons.processLost"),
  assignment_recovery: t("app.shared.retry.reasons.assignmentRecovery"),
  issue_continuation_needed: t("app.shared.retry.reasons.issueContinuationNeeded"),
  max_turns_continuation: t("app.shared.retry.reasons.maxTurnsContinuation"),
});

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function joinFragments(parts: Array<string | null>) {
  const filtered = parts.filter((part): part is string => Boolean(part));
  return filtered.length > 0 ? filtered.join(" · ") : null;
}

export function formatRetryReason(reason: string | null | undefined) {
  const normalized = readNonEmptyString(reason);
  if (!normalized) return null;
  return retryReasonLabels()[normalized] ?? normalized.replace(/_/g, " ");
}

export function describeRunRetryState(run: RetryAwareRun): RunRetryStateSummary | null {
  const attempt =
    typeof run.scheduledRetryAttempt === "number" && Number.isFinite(run.scheduledRetryAttempt) && run.scheduledRetryAttempt > 0
      ? run.scheduledRetryAttempt
      : null;
  const attemptLabel = attempt ? t("app.shared.retry.attempt", { attempt }) : null;
  const reasonLabel = formatRetryReason(run.scheduledRetryReason);
  const retryOfRunId = readNonEmptyString(run.retryOfRunId);
  const exhaustedReason = readNonEmptyString(run.retryExhaustedReason);
  const dueAt = run.scheduledRetryAt ? formatDateTime(run.scheduledRetryAt) : null;
  const isMaxTurnContinuation = run.scheduledRetryReason === "max_turns_continuation";
  const hasRetryMetadata =
    Boolean(retryOfRunId)
    || Boolean(reasonLabel)
    || Boolean(dueAt)
    || Boolean(attemptLabel)
    || Boolean(exhaustedReason);

  if (!hasRetryMetadata) return null;

  if (run.status === "scheduled_retry") {
    return {
      kind: "scheduled",
      badgeLabel: isMaxTurnContinuation
        ? t("app.shared.retry.continuationScheduled")
        : t("app.shared.retry.retryScheduled"),
      tone: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
      detail: joinFragments([attemptLabel, reasonLabel]),
      secondary: dueAt
        ? isMaxTurnContinuation
          ? t("app.shared.retry.nextContinuationAt", { dueAt })
          : t("app.shared.retry.nextRetryAt", { dueAt })
        : isMaxTurnContinuation
          ? t("app.shared.retry.nextContinuationPending")
          : t("app.shared.retry.nextRetryPending"),
      retryOfRunId,
    };
  }

  if (exhaustedReason) {
    return {
      kind: "exhausted",
      badgeLabel: isMaxTurnContinuation
        ? t("app.shared.retry.continuationExhausted")
        : t("app.shared.retry.retryExhausted"),
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      detail: joinFragments([attemptLabel, reasonLabel, t("app.shared.retry.automaticRetriesExhausted")]),
      secondary: exhaustedReason.includes("Manual intervention required")
        ? exhaustedReason
        : t("app.shared.retry.manualInterventionRequired", { reason: exhaustedReason }),
      retryOfRunId,
    };
  }

  return {
    kind: "attempted",
    badgeLabel: isMaxTurnContinuation ? t("app.shared.retry.continuedRun") : t("app.shared.retry.retriedRun"),
    tone: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    detail: joinFragments([attemptLabel, reasonLabel]),
    secondary: null,
    retryOfRunId,
  };
}
