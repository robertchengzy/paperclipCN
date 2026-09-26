import type { IssueChangeReceiptEntry } from "@paperclipai/shared";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "@paperclipai/shared";
import { formatReviewPolicyValue } from "./review-policy";
import { formatDateTime } from "./utils";
import { t } from "@/i18n";

/**
 * Read + format the field-level change receipts carried on an `issue.updated`
 * activity event (the open cross-task write design (audit), built on the field-change receipts the API already records).
 *
 * Every issue PATCH — agent and board alike — must leave an auditable record of
 * who changed what, when, and under which authorization. The server writes that
 * receipt; this module turns it into something a human can scan in the activity
 * stream without opening the audit log.
 *
 * The server already drops `updatedAt` and truncates long text (flagging it with
 * `updated: true`), so this module renders what it is given rather than
 * re-deciding what is interesting.
 */

/** Field names whose raw ids carry no meaning in a scannable summary. */
const FIELD_LABELS: Record<string, string> = {
  get status() { return t("app.lib.issueChangeReceipt.field.status"); },
  get priority() { return t("app.lib.issueChangeReceipt.field.priority"); },
  get title() { return t("app.lib.issueChangeReceipt.field.title"); },
  get description() { return t("app.lib.issueChangeReceipt.field.description"); },
  get assigneeAgentId() { return t("app.lib.issueChangeReceipt.field.assigneeAgentId"); },
  get assigneeUserId() { return t("app.lib.issueChangeReceipt.field.assigneeUserId"); },
  get responsibleUserId() { return t("app.lib.issueChangeReceipt.field.responsibleUserId"); },
  get blockedByIssueIds() { return t("app.lib.issueChangeReceipt.field.blockedByIssueIds"); },
  get labelIds() { return t("app.lib.issueChangeReceipt.field.labelIds"); },
  get parentId() { return t("app.lib.issueChangeReceipt.field.parentId"); },
  get projectId() { return t("app.lib.issueChangeReceipt.field.projectId"); },
  get goalId() { return t("app.lib.issueChangeReceipt.field.goalId"); },
  get workMode() { return t("app.lib.issueChangeReceipt.field.workMode"); },
  get reviewPolicy() { return t("app.lib.issueChangeReceipt.field.reviewPolicy"); },
  get billingCode() { return t("app.lib.issueChangeReceipt.field.billingCode"); },
  get checkoutRunId() { return t("app.lib.issueChangeReceipt.field.checkoutRunId"); },
  get executionRunId() { return t("app.lib.issueChangeReceipt.field.executionRunId"); },
  get hiddenAt() { return t("app.lib.issueChangeReceipt.field.hiddenAt"); },
  get startedAt() { return t("app.lib.issueChangeReceipt.field.startedAt"); },
  get completedAt() { return t("app.lib.issueChangeReceipt.field.completedAt"); },
  get cancelledAt() { return t("app.lib.issueChangeReceipt.field.cancelledAt"); },
  get requestDepth() { return t("app.lib.issueChangeReceipt.field.requestDepth"); },
  get sourceTrust() { return t("app.lib.issueChangeReceipt.field.sourceTrust"); },
  get executionPolicy() { return t("app.lib.issueChangeReceipt.field.executionPolicy"); },
  get executionWorkspaceId() { return t("app.lib.issueChangeReceipt.field.executionWorkspaceId"); },
  get projectWorkspaceId() { return t("app.lib.issueChangeReceipt.field.projectWorkspaceId"); },
};

/** Human label for a changed field, e.g. `assigneeAgentId` → "Assignee". */
export function issueChangeFieldLabel(field: string): string {
  const known = FIELD_LABELS[field];
  if (known) return known;
  // camelCase / snake_case → "Sentence case".
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const VALUE_PREVIEW_BUDGET = 72;

/** Translate only known protocol values; unknown values remain diagnostic text. */
export function formatIssueStatusValue(value: string): string {
  return (ISSUE_STATUSES as readonly string[]).includes(value)
    ? t(`app.common.status.${value}`)
    : value;
}

export function formatIssuePriorityValue(value: string): string {
  return (ISSUE_PRIORITIES as readonly string[]).includes(value)
    ? t(`app.lib.liveUpdatesProvider.priorityValue.${value}`)
    : value;
}

/**
 * Render one side of a change for display. Never returns an empty string, so a
 * receipt row always reads as "from → to" rather than trailing into nothing.
 */
export function formatIssueChangeValue(
  value: unknown,
  options: { resolveAgentLabel?: (id: string) => string | null | undefined;
    resolveUserLabel?: (id: string) => string | null | undefined;
    field?: string } = {},
): string {
  // `reviewPolicy` is nullable-by-default: a cleared column means "anyone can
  // approve", not "no value" (PAP-16506), so it resolves before the null branch.
  if (options.field === "reviewPolicy") return formatReviewPolicyValue(value);
  if (value === null || value === undefined || value === "") return t("app.lib.issueChangeReceipt.valueNone");
  if (typeof value === "boolean") return value ? t("app.lib.issueChangeReceipt.valueYes") : t("app.lib.issueChangeReceipt.valueNo");
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return t("app.lib.issueChangeReceipt.valueNone");
    const strings = value.filter((entry): entry is string => typeof entry === "string");
    if (strings.length !== value.length) return t("app.lib.issueChangeReceipt.valueItems", { count: value.length });
    return strings.length <= 3
      ? strings.map((id) => shortenId(id)).join(", ")
      : t("app.lib.issueChangeReceipt.valueItems", { count: strings.length });
  }

  if (value instanceof Date) return formatDateTime(value, { includeSeconds: true });

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return t("app.lib.issueChangeReceipt.valueNone");
    if (options.field === "status") return formatIssueStatusValue(value);
    if (options.field === "priority") return formatIssuePriorityValue(value);
    if (options.field === "title" || options.field === "description") return truncate(value);
    // Ids resolve to names when the directory is loaded; otherwise they shorten.
    const resolved = options.field?.toLowerCase().includes("agent")
      ? options.resolveAgentLabel?.(trimmed)
      : options.field?.toLowerCase().includes("user")
        ? options.resolveUserLabel?.(trimmed)
        : null;
    if (resolved) return resolved;
    if (isIsoTimestamp(trimmed)) return formatDateTime(trimmed, { includeSeconds: true });
    if (looksLikeId(trimmed)) return shortenId(trimmed);
    return truncate(value);
  }

  // Objects (execution policy, workspace settings) are structural — the receipt
  // records that they moved, and the audit log holds the full value.
  return t("app.lib.issueChangeReceipt.valueUpdated");
}

function truncate(value: string): string {
  const chars = Array.from(value);
  if (chars.length <= VALUE_PREVIEW_BUDGET) return value;
  return `${chars.slice(0, VALUE_PREVIEW_BUDGET).join("")}…`;
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

function looksLikeId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function shortenId(value: string): string {
  return looksLikeId(value) ? value.slice(0, 8) : truncate(value);
}

export interface IssueChangeReceiptRow {
  field: string;
  label: string;
  from: string;
  to: string;
  /** Server flagged the values as truncated previews of long text. */
  truncated: boolean;
}

function isChangeEntry(value: unknown): value is IssueChangeReceiptEntry {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && "from" in (value as object) && "to" in (value as object);
}

/**
 * Parse `details.changes` off an activity event into display rows. Returns an
 * empty array for events with no receipt (older rows, non-PATCH actions), so
 * callers can render nothing without special-casing.
 */
export function readIssueChangeReceipt(
  details: Record<string, unknown> | null | undefined,
  options: Parameters<typeof formatIssueChangeValue>[1] = {},
): IssueChangeReceiptRow[] {
  const changes = details?.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];

  const rows: IssueChangeReceiptRow[] = [];
  for (const [field, entry] of Object.entries(changes as Record<string, unknown>)) {
    if (!isChangeEntry(entry)) continue;
    rows.push({
      field,
      label: issueChangeFieldLabel(field),
      from: formatIssueChangeValue(entry.from, { ...options, field }),
      to: formatIssueChangeValue(entry.to, { ...options, field }),
      truncated: entry.updated === true,
    });
  }
  // Stable, scannable order regardless of JSON key order (jsonb reorders keys).
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

/** Authorization reasons, as recorded by the server's write-policy decision. */
const AUTHORIZATION_REASON_LABELS: Record<string, string> = {
  get allow_visible_issue_write() { return t("app.lib.issueChangeReceipt.reason.allow_visible_issue_write"); },
  get allow_scoped_agent_write() { return t("app.lib.issueChangeReceipt.reason.allow_scoped_agent_write"); },
  get allow_board_actor() { return t("app.lib.issueChangeReceipt.reason.allow_board_actor"); },
  get allow_self() { return t("app.lib.issueChangeReceipt.reason.allow_self"); },
  get allow_issue_mention_grant() { return t("app.lib.issueChangeReceipt.reason.allow_issue_mention_grant"); },
  get allow_direct_parent_report() { return t("app.lib.issueChangeReceipt.reason.allow_direct_parent_report"); },
  get allow_low_trust_boundary() { return t("app.lib.issueChangeReceipt.reason.allow_low_trust_boundary"); },
  get allow_explicit_grant() { return t("app.lib.issueChangeReceipt.reason.allow_explicit_grant"); },
  get allow_instance_admin() { return t("app.lib.issueChangeReceipt.reason.allow_instance_admin"); },
  get allow_local_board() { return t("app.lib.issueChangeReceipt.reason.allow_local_board"); },
  get internal_agent_write() { return t("app.lib.issueChangeReceipt.reason.internal_agent_write"); },
};

/**
 * Human phrasing for the authorization reason on a write receipt. Unknown
 * reasons retain their original code rather than disappearing — an
 * unexplained write is worse than an ugly one.
 */
export function issueAuthorizationReasonLabel(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim();
  if (!trimmed) return null;
  return AUTHORIZATION_REASON_LABELS[trimmed] ?? trimmed;
}
