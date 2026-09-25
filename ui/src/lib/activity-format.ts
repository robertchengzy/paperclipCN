import type { Agent } from "@paperclipai/shared";
import type { CompanyUserProfile } from "./company-members";
import { formatReviewPolicyValue } from "./review-policy";
import { t } from "@/i18n";

type ActivityDetails = Record<string, unknown> | null | undefined;

type ActivityParticipant = {
  type: "agent" | "user";
  agentId?: string | null;
  userId?: string | null;
};

type ActivityIssueReference = {
  id?: string | null;
  identifier?: string | null;
  title?: string | null;
};

interface ActivityFormatOptions {
  agentMap?: Map<string, Agent>;
  userProfileMap?: Map<string, CompanyUserProfile>;
  currentUserId?: string | null;
}

/** Action → i18n key of the verb phrase that precedes the entity in an activity row. */
const ACTIVITY_ROW_VERBS: Record<string, string> = {
  "issue.created": "app.lib.activityFormat.row.issueCreated",
  "issue.updated": "app.lib.activityFormat.row.issueUpdated",
  "issue.read_marked": "app.lib.activityFormat.row.issueReadMarked",
  "issue.read_unmarked": "app.lib.activityFormat.row.issueReadUnmarked",
  "issue.checked_out": "app.lib.activityFormat.row.issueCheckedOut",
  "issue.released": "app.lib.activityFormat.row.issueReleased",
  "issue.comment_added": "app.lib.activityFormat.row.issueCommentAdded",
  "issue.comment_cancelled": "app.lib.activityFormat.row.issueCommentCancelled",
  "issue.queued_comment_edited": "app.lib.activityFormat.row.issueQueuedCommentEdited",
  "issue.queued_comments_reordered": "app.lib.activityFormat.row.issueQueuedCommentsReordered",
  "issue.queued_comment_discarded": "app.lib.activityFormat.row.issueQueuedCommentDiscarded",
  "issue.comment_deleted": "app.lib.activityFormat.row.issueCommentDeleted",
  "issue.attachment_added": "app.lib.activityFormat.row.issueAttachmentAdded",
  "issue.attachment_removed": "app.lib.activityFormat.row.issueAttachmentRemoved",
  "issue.document_created": "app.lib.activityFormat.row.issueDocumentCreated",
  "issue.document_updated": "app.lib.activityFormat.row.issueDocumentUpdated",
  "issue.document_locked": "app.lib.activityFormat.row.issueDocumentLocked",
  "issue.document_unlocked": "app.lib.activityFormat.row.issueDocumentUnlocked",
  "issue.document_deleted": "app.lib.activityFormat.row.issueDocumentDeleted",
  "issue.monitor_scheduled": "app.lib.activityFormat.row.issueMonitorScheduled",
  "issue.monitor_triggered": "app.lib.activityFormat.row.issueMonitorTriggered",
  "issue.monitor_cleared": "app.lib.activityFormat.row.issueMonitorCleared",
  "issue.monitor_skipped": "app.lib.activityFormat.row.issueMonitorSkipped",
  "issue.monitor_exhausted": "app.lib.activityFormat.row.issueMonitorExhausted",
  "issue.monitor_recovery_wake_queued": "app.lib.activityFormat.row.issueMonitorRecoveryWakeQueued",
  "issue.monitor_recovery_issue_created": "app.lib.activityFormat.row.issueMonitorRecoveryIssueCreated",
  "issue.monitor_escalated_to_board": "app.lib.activityFormat.row.issueMonitorEscalatedToBoard",
  "issue.commented": "app.lib.activityFormat.row.issueCommented",
  "issue.deleted": "app.lib.activityFormat.row.issueDeleted",
  "issue.successful_run_handoff_required": "app.lib.activityFormat.row.issueSuccessfulRunHandoffRequired",
  "issue.successful_run_handoff_resolved": "app.lib.activityFormat.row.issueSuccessfulRunHandoffResolved",
  "issue.successful_run_handoff_escalated": "app.lib.activityFormat.row.issueSuccessfulRunHandoffEscalated",
  "issue.accepted_plan_decomposition_updated": "app.lib.activityFormat.row.issueAcceptedPlanDecompositionUpdated",
  "issue.recovery_action_opened": "app.lib.activityFormat.row.issueRecoveryActionOpened",
  "issue.recovery_action_resolved": "app.lib.activityFormat.row.issueRecoveryActionResolved",
  "issue.recovery_action_escalated": "app.lib.activityFormat.row.issueRecoveryActionEscalated",
  "agent.created": "app.lib.activityFormat.row.agentCreated",
  "agent.updated": "app.lib.activityFormat.row.agentUpdated",
  "agent.paused": "app.lib.activityFormat.row.agentPaused",
  "agent.resumed": "app.lib.activityFormat.row.agentResumed",
  "agent.error_cleared": "app.lib.activityFormat.row.agentErrorCleared",
  "agent.terminated": "app.lib.activityFormat.row.agentTerminated",
  "agent.key_created": "app.lib.activityFormat.row.agentKeyCreated",
  "agent.budget_updated": "app.lib.activityFormat.row.agentBudgetUpdated",
  "agent.runtime_session_reset": "app.lib.activityFormat.row.agentRuntimeSessionReset",
  "heartbeat.invoked": "app.lib.activityFormat.row.heartbeatInvoked",
  "heartbeat.cancelled": "app.lib.activityFormat.row.heartbeatCancelled",
  "heartbeat.output_stale_source_resolved": "app.lib.activityFormat.row.heartbeatOutputStaleSourceResolved",
  "heartbeat.output_stale_recovery_recursion_refused": "app.lib.activityFormat.row.heartbeatOutputStaleRecoveryRecursionRefused",
  "approval.created": "app.lib.activityFormat.row.approvalCreated",
  "approval.approved": "app.lib.activityFormat.row.approvalApproved",
  "approval.rejected": "app.lib.activityFormat.row.approvalRejected",
  // Interaction outcomes (PAP-16506). An agent may now resolve one — including a
  // review of its own work — so these must read as outcomes in the feed instead
  // of falling through to the raw "issue thread interaction accepted" action id.
  // `details.interactionKind` sharpens the wording; see INTERACTION_OUTCOME_LABELS.
  "issue.thread_interaction_created": "app.lib.activityFormat.row.issueThreadInteractionCreated",
  "issue.thread_interaction_accepted": "app.lib.activityFormat.row.issueThreadInteractionAccepted",
  "issue.thread_interaction_rejected": "app.lib.activityFormat.row.issueThreadInteractionRejected",
  "issue.thread_interaction_answered": "app.lib.activityFormat.row.issueThreadInteractionAnswered",
  "issue.thread_interaction_withdrawn": "app.lib.activityFormat.row.issueThreadInteractionWithdrawn",
  "issue.thread_interaction_cancelled": "app.lib.activityFormat.row.issueThreadInteractionCancelled",
  "issue.thread_interaction_skipped": "app.lib.activityFormat.row.issueThreadInteractionSkipped",
  "issue.thread_interaction_expired": "app.lib.activityFormat.row.issueThreadInteractionExpired",
  "issue.thread_interaction_item_verdicts_submitted": "app.lib.activityFormat.row.issueThreadInteractionItemVerdictsSubmitted",
  "issue.stalled_review_decided": "app.lib.activityFormat.row.issueStalledReviewDecided",
  "project.created": "app.lib.activityFormat.row.projectCreated",
  "project.updated": "app.lib.activityFormat.row.projectUpdated",
  "project.deleted": "app.lib.activityFormat.row.projectDeleted",
  "goal.created": "app.lib.activityFormat.row.goalCreated",
  "goal.updated": "app.lib.activityFormat.row.goalUpdated",
  "goal.deleted": "app.lib.activityFormat.row.goalDeleted",
  "cost.reported": "app.lib.activityFormat.row.costReported",
  "cost.recorded": "app.lib.activityFormat.row.costRecorded",
  "company.created": "app.lib.activityFormat.row.companyCreated",
  "company.updated": "app.lib.activityFormat.row.companyUpdated",
  "company.archived": "app.lib.activityFormat.row.companyArchived",
  "company.reactivated": "app.lib.activityFormat.row.companyReactivated",
  "company.budget_updated": "app.lib.activityFormat.row.companyBudgetUpdated",
  "audit.exported": "app.lib.activityFormat.row.auditExported",
  "tool_app.connected": "app.lib.activityFormat.row.toolAppConnected",
  "tool_app.oauth_connected": "app.lib.activityFormat.row.toolAppOauthConnected",
  "tool_app.oauth_failed": "app.lib.activityFormat.row.toolAppOauthFailed",
  "tool_app.oauth_access_finalized": "app.lib.activityFormat.row.toolAppOauthAccessFinalized",
  "tool_app.finished": "app.lib.activityFormat.row.toolAppFinished",
  "tool_app.reconnected": "app.lib.activityFormat.row.toolAppReconnected",
  "tool_connection.created": "app.lib.activityFormat.row.toolConnectionCreated",
  "tool_connection.updated": "app.lib.activityFormat.row.toolConnectionUpdated",
  "tool_connection.archived": "app.lib.activityFormat.row.toolConnectionArchived",
  "tool_connection.catalog_refresh": "app.lib.activityFormat.row.toolConnectionCatalogRefresh",
  "tool_connection.installs_synced": "app.lib.activityFormat.row.toolConnectionInstallsSynced",
  "tool_connection.install_access_extended": "app.lib.activityFormat.row.toolConnectionInstallAccessExtended",
  "tool_connection.grant_audience_replaced": "app.lib.activityFormat.row.toolConnectionGrantAudienceReplaced",
  "tool_connection.grant_added": "app.lib.activityFormat.row.toolConnectionGrantAdded",
  "tool_connection.grant_revoked": "app.lib.activityFormat.row.toolConnectionGrantRevoked",
  "tool_connection.grant_delegated": "app.lib.activityFormat.row.toolConnectionGrantDelegated",
  "tool_connection.grant_delegation_revoked": "app.lib.activityFormat.row.toolConnectionGrantDelegationRevoked",
};

/** Action → i18n key of the standalone phrase on the issue activity timeline. */
const ISSUE_ACTIVITY_LABELS: Record<string, string> = {
  "issue.created": "app.lib.activityFormat.detail.issueCreated",
  "issue.updated": "app.lib.activityFormat.detail.issueUpdated",
  "issue.checked_out": "app.lib.activityFormat.detail.issueCheckedOut",
  "issue.released": "app.lib.activityFormat.detail.issueReleased",
  "issue.comment_added": "app.lib.activityFormat.detail.issueCommentAdded",
  "issue.comment_cancelled": "app.lib.activityFormat.detail.issueCommentCancelled",
  "issue.queued_comment_edited": "app.lib.activityFormat.detail.issueQueuedCommentEdited",
  "issue.queued_comments_reordered": "app.lib.activityFormat.detail.issueQueuedCommentsReordered",
  "issue.queued_comment_discarded": "app.lib.activityFormat.detail.issueQueuedCommentDiscarded",
  "issue.comment_deleted": "app.lib.activityFormat.detail.issueCommentDeleted",
  "issue.feedback_vote_saved": "app.lib.activityFormat.detail.issueFeedbackVoteSaved",
  "issue.attachment_added": "app.lib.activityFormat.detail.issueAttachmentAdded",
  "issue.attachment_removed": "app.lib.activityFormat.detail.issueAttachmentRemoved",
  "issue.document_created": "app.lib.activityFormat.detail.issueDocumentCreated",
  "issue.document_updated": "app.lib.activityFormat.detail.issueDocumentUpdated",
  "issue.document_locked": "app.lib.activityFormat.detail.issueDocumentLocked",
  "issue.document_unlocked": "app.lib.activityFormat.detail.issueDocumentUnlocked",
  "issue.document_deleted": "app.lib.activityFormat.detail.issueDocumentDeleted",
  "issue.monitor_scheduled": "app.lib.activityFormat.detail.issueMonitorScheduled",
  "issue.monitor_triggered": "app.lib.activityFormat.detail.issueMonitorTriggered",
  "issue.monitor_cleared": "app.lib.activityFormat.detail.issueMonitorCleared",
  "issue.monitor_skipped": "app.lib.activityFormat.detail.issueMonitorSkipped",
  "issue.monitor_exhausted": "app.lib.activityFormat.detail.issueMonitorExhausted",
  "issue.monitor_recovery_wake_queued": "app.lib.activityFormat.detail.issueMonitorRecoveryWakeQueued",
  "issue.monitor_recovery_issue_created": "app.lib.activityFormat.detail.issueMonitorRecoveryIssueCreated",
  "issue.monitor_escalated_to_board": "app.lib.activityFormat.detail.issueMonitorEscalatedToBoard",
  "issue.deleted": "app.lib.activityFormat.detail.issueDeleted",
  "issue.successful_run_handoff_required": "app.lib.activityFormat.detail.issueSuccessfulRunHandoffRequired",
  "issue.successful_run_handoff_resolved": "app.lib.activityFormat.detail.issueSuccessfulRunHandoffResolved",
  "issue.successful_run_handoff_escalated": "app.lib.activityFormat.detail.issueSuccessfulRunHandoffEscalated",
  "issue.cross_issue_influence_cap_rejected": "app.lib.activityFormat.detail.issueCrossIssueInfluenceCapRejected",
  "issue.cross_issue_influence_observed": "app.lib.activityFormat.detail.issueCrossIssueInfluenceObserved",
  "issue.attribution_spoof_rejected": "app.lib.activityFormat.detail.issueAttributionSpoofRejected",
  "issue.recovery_action_opened": "app.lib.activityFormat.detail.issueRecoveryActionOpened",
  "issue.recovery_action_resolved": "app.lib.activityFormat.detail.issueRecoveryActionResolved",
  "issue.recovery_action_escalated": "app.lib.activityFormat.detail.issueRecoveryActionEscalated",
  "issue.accepted_plan_decomposition_updated": "app.lib.activityFormat.detail.issueAcceptedPlanDecompositionUpdated",
  "agent.created": "app.lib.activityFormat.detail.agentCreated",
  "agent.updated": "app.lib.activityFormat.detail.agentUpdated",
  "agent.paused": "app.lib.activityFormat.detail.agentPaused",
  "agent.resumed": "app.lib.activityFormat.detail.agentResumed",
  "agent.error_cleared": "app.lib.activityFormat.detail.agentErrorCleared",
  "agent.terminated": "app.lib.activityFormat.detail.agentTerminated",
  "heartbeat.invoked": "app.lib.activityFormat.detail.heartbeatInvoked",
  "heartbeat.cancelled": "app.lib.activityFormat.detail.heartbeatCancelled",
  "heartbeat.output_stale_source_resolved": "app.lib.activityFormat.detail.heartbeatOutputStaleSourceResolved",
  "heartbeat.output_stale_recovery_recursion_refused": "app.lib.activityFormat.detail.heartbeatOutputStaleRecoveryRecursionRefused",
  "approval.created": "app.lib.activityFormat.detail.approvalCreated",
  "approval.approved": "app.lib.activityFormat.detail.approvalApproved",
  "approval.rejected": "app.lib.activityFormat.detail.approvalRejected",
  "issue.thread_interaction_created": "app.lib.activityFormat.detail.issueThreadInteractionCreated",
  "issue.thread_interaction_accepted": "app.lib.activityFormat.detail.issueThreadInteractionAccepted",
  "issue.thread_interaction_rejected": "app.lib.activityFormat.detail.issueThreadInteractionRejected",
  "issue.thread_interaction_answered": "app.lib.activityFormat.detail.issueThreadInteractionAnswered",
  "issue.thread_interaction_withdrawn": "app.lib.activityFormat.detail.issueThreadInteractionWithdrawn",
  "issue.thread_interaction_cancelled": "app.lib.activityFormat.detail.issueThreadInteractionCancelled",
  "issue.thread_interaction_skipped": "app.lib.activityFormat.detail.issueThreadInteractionSkipped",
  "issue.thread_interaction_expired": "app.lib.activityFormat.detail.issueThreadInteractionExpired",
  "issue.thread_interaction_item_verdicts_submitted": "app.lib.activityFormat.detail.issueThreadInteractionItemVerdictsSubmitted",
  "issue.stalled_review_decided": "app.lib.activityFormat.detail.issueStalledReviewDecided",
};

/**
 * `issue.stalled_review_decided` carries the verb the actor chose, so the line
 * names the verdict ("approved the review") rather than the generic action.
 * Mirrors `StalledReviewDecisionAction` in shared.
 */
const STALLED_REVIEW_DECISION_LABELS: Record<string, string> = {
  approve: "app.lib.activityFormat.stalledReview.approve",
  request_changes: "app.lib.activityFormat.stalledReview.requestChanges",
  send_back: "app.lib.activityFormat.stalledReview.sendBack",
};

/**
 * `issue.thread_interaction_accepted` / `_rejected` fire for *every* interaction
 * kind, not only for a review. A task suggestion or a question is accepted, not
 * approved, so the kind on the event picks the verb. Kinds absent from a map
 * keep the neutral "accepted the request" wording from the tables above, which
 * is also the fallback for an event that carries no kind.
 */
const INTERACTION_ACCEPTED_LABELS: Record<string, string> = {
  request_confirmation: "app.lib.activityFormat.interactionAccepted.requestConfirmation",
  request_checkbox_confirmation: "app.lib.activityFormat.interactionAccepted.requestCheckboxConfirmation",
  suggest_tasks: "app.lib.activityFormat.interactionAccepted.suggestTasks",
  ask_user_questions: "app.lib.activityFormat.interactionAccepted.askUserQuestions",
};

const INTERACTION_REJECTED_LABELS: Record<string, string> = {
  request_confirmation: "app.lib.activityFormat.interactionRejected.requestConfirmation",
  request_checkbox_confirmation: "app.lib.activityFormat.interactionRejected.requestCheckboxConfirmation",
  suggest_tasks: "app.lib.activityFormat.interactionRejected.suggestTasks",
  ask_user_questions: "app.lib.activityFormat.interactionRejected.askUserQuestions",
};

/**
 * i18n key of the kind-aware wording for an interaction outcome (append `Row`
 * for the activity-row form), or `null` when the tables above already say it
 * well enough.
 */
function formatInteractionOutcomeLabel(action: string, details: ActivityDetails): string | null {
  const table = action === "issue.thread_interaction_accepted"
    ? INTERACTION_ACCEPTED_LABELS
    : action === "issue.thread_interaction_rejected"
      ? INTERACTION_REJECTED_LABELS
      : null;
  if (!table) return null;
  const kind = typeof details?.interactionKind === "string" ? details.interactionKind : null;
  return kind ? table[kind] ?? null : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

/** Status/priority values read in the current UI language; English stays the humanized code. */
function humanizeFieldValue(field: "status" | "priority", value: unknown): string {
  const humanized = humanizeValue(value);
  if (typeof value !== "string") return humanized;
  return field === "status"
    ? t(`app.common.status.${value}`, { defaultValue: humanized })
    : t(`app.lib.activityFormat.priorityValue.${value}`, { defaultValue: humanized });
}

function isActivityParticipant(value: unknown): value is ActivityParticipant {
  const record = asRecord(value);
  if (!record) return false;
  return record.type === "agent" || record.type === "user";
}

function isActivityIssueReference(value: unknown): value is ActivityIssueReference {
  return asRecord(value) !== null;
}

function readParticipants(details: ActivityDetails, key: string): ActivityParticipant[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityParticipant);
}

function readIssueReferences(details: ActivityDetails, key: string): ActivityIssueReference[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityIssueReference);
}

function formatUserLabel(userId: string | null | undefined, options: ActivityFormatOptions = {}): string {
  if (!userId || userId === "local-board") return t("app.common.nouns.board");
  if (options.currentUserId && userId === options.currentUserId) return t("app.common.labels.you");
  const profile = options.userProfileMap?.get(userId);
  if (profile) return profile.label;
  return t("app.lib.activityFormat.userShort", { id: userId.slice(0, 5) });
}

function formatParticipantLabel(participant: ActivityParticipant, options: ActivityFormatOptions): string {
  if (participant.type === "agent") {
    const agentId = participant.agentId ?? "";
    return options.agentMap?.get(agentId)?.name ?? t("app.lib.activityFormat.agentFallback");
  }
  return formatUserLabel(participant.userId, options);
}

function formatIssueReferenceLabel(reference: ActivityIssueReference): string {
  if (reference.identifier) return reference.identifier;
  if (reference.title) return reference.title;
  if (reference.id) return reference.id.slice(0, 8);
  return t("app.lib.activityFormat.taskFallback");
}


function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function readStringArrayLength(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((entry) => typeof entry === "string" && entry.length > 0).length;
}

function formatAcceptedPlanDecompositionDetail(details: ActivityDetails): string | null {
  if (!details) return null;
  const status = typeof details.status === "string" ? details.status : null;
  const requested = readNumber(details.requestedChildCount);
  const totalChildren = readStringArrayLength(details.childIssueIds);
  const newlyCreated = readStringArrayLength(details.newlyCreatedChildIssueIds);
  const reused = Math.max(0, totalChildren - newlyCreated);
  const parts: string[] = [];
  if (newlyCreated > 0) parts.push(t("app.lib.activityFormat.decompositionCreated", { count: newlyCreated }));
  if (reused > 0) parts.push(t("app.lib.activityFormat.decompositionReused", { count: reused }));
  if (parts.length === 0 && requested !== null) parts.push(t("app.lib.activityFormat.decompositionRequested", { count: requested }));
  const summary = parts.length > 0 ? parts.join(t("app.lib.activityFormat.listSeparator")) : null;
  if (status === "completed" && summary) return t("app.lib.activityFormat.decompositionCompletedWith", { summary });
  if (status === "completed") return t("app.lib.activityFormat.decompositionCompleted");
  if (status === "in_flight" && summary) return t("app.lib.activityFormat.decompositionInFlight", { summary });
  return summary;
}

function formatIssueUpdatedVerb(details: ActivityDetails): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  if (details.status !== undefined) {
    const from = previous.status;
    const to = humanizeFieldValue("status", details.status === "in_review" && details.externalConversationState === "waiting" ? "idle" : details.status);
    return from
      ? t("app.lib.activityFormat.rowStatusFromTo", { from: humanizeFieldValue("status", from), to })
      : t("app.lib.activityFormat.rowStatusTo", { to });
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    return from
      ? t("app.lib.activityFormat.rowPriorityFromTo", { from: humanizeFieldValue("priority", from), to: humanizeFieldValue("priority", details.priority) })
      : t("app.lib.activityFormat.rowPriorityTo", { to: humanizeFieldValue("priority", details.priority) });
  }
  return null;
}

function formatAssigneeName(details: ActivityDetails, options: ActivityFormatOptions): string | null {
  if (!details) return null;
  const agentId = details.assigneeAgentId;
  const userId = details.assigneeUserId;
  if (typeof agentId === "string" && agentId) {
    return options.agentMap?.get(agentId)?.name ?? t("app.lib.activityFormat.agentFallback");
  }
  if (typeof userId === "string" && userId) {
    return formatUserLabel(userId, options);
  }
  return null;
}

function formatIssueUpdatedAction(details: ActivityDetails, options: ActivityFormatOptions = {}): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  const parts: string[] = [];

  if (details.status !== undefined) {
    const from = previous.status;
    const to = humanizeFieldValue("status", details.status === "in_review" && details.externalConversationState === "waiting" ? "idle" : details.status);
    parts.push(
      from
        ? t("app.lib.activityFormat.statusFromTo", { from: humanizeFieldValue("status", from), to })
        : t("app.lib.activityFormat.statusTo", { to }),
    );
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    parts.push(
      from
        ? t("app.lib.activityFormat.priorityFromTo", { from: humanizeFieldValue("priority", from), to: humanizeFieldValue("priority", details.priority) })
        : t("app.lib.activityFormat.priorityTo", { to: humanizeFieldValue("priority", details.priority) }),
    );
  }
  if (details.assigneeAgentId !== undefined || details.assigneeUserId !== undefined) {
    const assigneeName = formatAssigneeName(details, options);
    parts.push(assigneeName ? t("app.lib.activityFormat.madeResponsible", { name: assigneeName }) : t("app.lib.activityFormat.clearedResponsible"));
  }
  if (details.reviewPolicy !== undefined) {
    // `null` is the default ("anyone can approve"), so it must not read as
    // "changed the review policy to none" (PAP-16506).
    parts.push(t("app.lib.activityFormat.changedApprover", { value: formatReviewPolicyValue(details.reviewPolicy) }));
  }
  if (details.title !== undefined) parts.push(t("app.lib.activityFormat.updatedTitle"));
  if (details.description !== undefined) parts.push(t("app.lib.activityFormat.updatedDescription"));

  return parts.length > 0 ? parts.join(t("app.lib.activityFormat.listSeparator")) : null;
}

type ChangedEntity = "blocker" | "reviewer" | "approver";

/** Structured add/remove/update copy for blockers, reviewers and approvers. */
function formatChangedEntity(
  entity: ChangedEntity,
  change: "added" | "removed" | "updated",
  labels: string[],
  forIssueDetail: boolean,
): string {
  const row = !forIssueDetail;
  if (change === "updated") {
    if (entity === "blocker") return row ? t("app.lib.activityFormat.change.blocker.updatedRow") : t("app.lib.activityFormat.change.blocker.updated");
    if (entity === "reviewer") return row ? t("app.lib.activityFormat.change.reviewer.updatedRow") : t("app.lib.activityFormat.change.reviewer.updated");
    return row ? t("app.lib.activityFormat.change.approver.updatedRow") : t("app.lib.activityFormat.change.approver.updated");
  }
  const one = labels.length === 1;
  const values = { label: labels[0], count: labels.length };
  if (entity === "blocker") {
    if (change === "added") {
      return one
        ? t(row ? "app.lib.activityFormat.change.blocker.addedOneRow" : "app.lib.activityFormat.change.blocker.addedOne", values)
        : t(row ? "app.lib.activityFormat.change.blocker.addedManyRow" : "app.lib.activityFormat.change.blocker.addedMany", values);
    }
    return one
      ? t(row ? "app.lib.activityFormat.change.blocker.removedOneRow" : "app.lib.activityFormat.change.blocker.removedOne", values)
      : t(row ? "app.lib.activityFormat.change.blocker.removedManyRow" : "app.lib.activityFormat.change.blocker.removedMany", values);
  }
  if (entity === "reviewer") {
    if (change === "added") {
      return one
        ? t(row ? "app.lib.activityFormat.change.reviewer.addedOneRow" : "app.lib.activityFormat.change.reviewer.addedOne", values)
        : t(row ? "app.lib.activityFormat.change.reviewer.addedManyRow" : "app.lib.activityFormat.change.reviewer.addedMany", values);
    }
    return one
      ? t(row ? "app.lib.activityFormat.change.reviewer.removedOneRow" : "app.lib.activityFormat.change.reviewer.removedOne", values)
      : t(row ? "app.lib.activityFormat.change.reviewer.removedManyRow" : "app.lib.activityFormat.change.reviewer.removedMany", values);
  }
  if (change === "added") {
    return one
      ? t(row ? "app.lib.activityFormat.change.approver.addedOneRow" : "app.lib.activityFormat.change.approver.addedOne", values)
      : t(row ? "app.lib.activityFormat.change.approver.addedManyRow" : "app.lib.activityFormat.change.approver.addedMany", values);
  }
  return one
    ? t(row ? "app.lib.activityFormat.change.approver.removedOneRow" : "app.lib.activityFormat.change.approver.removedOne", values)
    : t(row ? "app.lib.activityFormat.change.approver.removedManyRow" : "app.lib.activityFormat.change.approver.removedMany", values);
}

function formatStructuredIssueChange(input: {
  action: string;
  details: ActivityDetails;
  options: ActivityFormatOptions;
  forIssueDetail: boolean;
}): string | null {
  const details = input.details;
  if (!details) return null;

  if (input.action === "issue.blockers_updated") {
    const added = readIssueReferences(details, "addedBlockedByIssues").map(formatIssueReferenceLabel);
    const removed = readIssueReferences(details, "removedBlockedByIssues").map(formatIssueReferenceLabel);
    if (added.length > 0 && removed.length === 0) {
      return formatChangedEntity("blocker", "added", added, input.forIssueDetail);
    }
    if (removed.length > 0 && added.length === 0) {
      return formatChangedEntity("blocker", "removed", removed, input.forIssueDetail);
    }
    return formatChangedEntity("blocker", "updated", [], input.forIssueDetail);
  }

  if (input.action === "issue.reviewers_updated" || input.action === "issue.approvers_updated") {
    const added = readParticipants(details, "addedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const removed = readParticipants(details, "removedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const entity: ChangedEntity = input.action === "issue.reviewers_updated" ? "reviewer" : "approver";
    if (added.length > 0 && removed.length === 0) {
      return formatChangedEntity(entity, "added", added, input.forIssueDetail);
    }
    if (removed.length > 0 && added.length === 0) {
      return formatChangedEntity(entity, "removed", removed, input.forIssueDetail);
    }
    return formatChangedEntity(entity, "updated", [], input.forIssueDetail);
  }

  return null;
}

export function formatActivityVerb(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action.startsWith("tool_gateway.")) {
    const rawTool = typeof details?.tool === "string"
      ? details.tool
      : typeof details?.upstreamToolName === "string"
        ? details.upstreamToolName
        : t("app.lib.activityFormat.gateway.anAppAction");
    const tool = rawTool.replace(/[._-]+/g, " ");
    const isTest = details?.source === "test";
    if (action === "tool_gateway.call_completed") {
      return isTest ? t("app.lib.activityFormat.gateway.tested", { tool }) : t("app.lib.activityFormat.gateway.used", { tool });
    }
    if (action === "tool_gateway.call_allowed") {
      return isTest ? t("app.lib.activityFormat.gateway.startedTest", { tool }) : t("app.lib.activityFormat.gateway.allowed", { tool });
    }
    if (action === "tool_gateway.call_denied") return t("app.lib.activityFormat.gateway.denied", { tool });
    if (action === "tool_gateway.approval_requested") return t("app.lib.activityFormat.gateway.askedToUse", { tool });
    if (action === "tool_gateway.session_created") return t("app.lib.activityFormat.gateway.sessionCreated");
    if (action === "tool_gateway.session_rejected") return t("app.lib.activityFormat.gateway.sessionRejected");
    if (action === "tool_gateway.discovery") return t("app.lib.activityFormat.gateway.discovery");
  }

  if (action === "issue.updated") {
    const issueUpdatedVerb = formatIssueUpdatedVerb(details);
    if (issueUpdatedVerb) return issueUpdatedVerb;
  }

  if (action === "issue.stalled_review_decided") {
    const decision = typeof details?.action === "string" ? details.action : null;
    const labelKey = decision ? STALLED_REVIEW_DECISION_LABELS[decision] : null;
    if (labelKey) return t(`${labelKey}Row`);
  }

  const outcomeLabelKey = formatInteractionOutcomeLabel(action, details);
  if (outcomeLabelKey) return t(`${outcomeLabelKey}Row`);

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: false,
  });
  if (structuredChange) return structuredChange;

  const verbKey = ACTIVITY_ROW_VERBS[action];
  return verbKey ? t(verbKey) : action.replace(/[._]/g, " ");
}

export function formatIssueActivityAction(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action === "issue.updated") {
    const issueUpdatedAction = formatIssueUpdatedAction(details, options);
    if (issueUpdatedAction) return issueUpdatedAction;
  }

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: true,
  });
  if (structuredChange) return structuredChange;

  if (action === "issue.accepted_plan_decomposition_updated") {
    const detail = formatAcceptedPlanDecompositionDetail(details);
    if (detail) return detail;
  }

  if (action === "issue.stalled_review_decided") {
    const decision = typeof details?.action === "string" ? details.action : null;
    const labelKey = decision ? STALLED_REVIEW_DECISION_LABELS[decision] : null;
    if (labelKey) return t(labelKey);
  }

  const outcomeLabelKey = formatInteractionOutcomeLabel(action, details);
  if (outcomeLabelKey) return t(outcomeLabelKey);

  const labelKey = ISSUE_ACTIVITY_LABELS[action];

  if (action.startsWith("issue.monitor_") && details) {
    const serviceName = typeof details.serviceName === "string" && details.serviceName.trim()
      ? details.serviceName.trim()
      : null;
    const base = labelKey ? t(labelKey) : action.replace(/[._]/g, " ");
    return serviceName ? t("app.lib.activityFormat.monitorForService", { base, service: serviceName }) : base;
  }

  if (
    (
      action === "issue.document_created" ||
      action === "issue.document_updated" ||
      action === "issue.document_locked" ||
      action === "issue.document_unlocked" ||
      action === "issue.document_deleted"
    ) &&
    details
  ) {
    const key = typeof details.key === "string" ? details.key : t("app.lib.activityFormat.documentFallback");
    const label = labelKey ? t(labelKey) : action;
    return typeof details.title === "string" && details.title
      ? t("app.lib.activityFormat.documentWithTitle", { label, key, title: details.title })
      : t("app.lib.activityFormat.documentWithKey", { label, key });
  }

  return labelKey ? t(labelKey) : action.replace(/[._]/g, " ");
}
