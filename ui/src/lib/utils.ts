import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { deriveAgentUrlKey, deriveProjectUrlKey, normalizeProjectUrlKey, hasNonAsciiContent } from "@paperclipai/shared";
import type { BillingType, FinanceDirection, FinanceEventKind } from "@paperclipai/shared";
import { i18n, t } from "@/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Classes for a sidebar row label when the sidebar is collapsed to the icon rail
 * (PAP-10676). Unlike `sr-only` (which is `position: absolute` and therefore
 * removes the label from flow), this keeps the label in flow so it still
 * contributes its line-height to the row. That guarantees a row is the *exact*
 * same height collapsed as expanded, so the icons never shift vertically between
 * states. The label is clipped to zero visible width and rendered transparent,
 * but stays in the DOM and the a11y tree as the link's accessible name.
 */
export const SIDEBAR_RAIL_HIDDEN_LABEL =
  "block w-0 min-w-0 overflow-hidden whitespace-nowrap text-transparent select-none";

export function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function asFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(displayLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString(displayLocale());
}

/**
 * Format a project's budget for the projects list view (IA Phase 4 — PAP-60).
 * Monthly budgets render a `/mo` suffix; lifetime budgets show the bare amount.
 */
export function formatProjectBudget(budget: { amountCents: number; windowKind: string }): string {
  const amount = formatCents(budget.amountCents);
  return budget.windowKind === "calendar_month_utc" ? `${amount}/mo` : amount;
}

/** Locale for user-facing values, independent of the browser or host language. */
export function displayLocale(): string {
  return i18n.language === "zh-CN" ? "zh-CN" : "en-US";
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(displayLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(
  date: Date | string,
  options: { includeSeconds?: boolean } = {},
): string {
  return new Date(date).toLocaleString(displayLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(options.includeSeconds ? { second: "2-digit" as const } : {}),
  });
}

export function formatShortDate(date: Date | string): string {
  return new Date(date).toLocaleString(displayLocale(), {
    month: "short",
    day: "numeric",
  });
}

export function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return t("app.format.relative.justNow");
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return t("app.format.relative.minutesAgo", { count: diffMin });
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return t("app.format.relative.hoursAgo", { count: diffHr });
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return t("app.format.relative.daysAgo", { count: diffDay });
  return formatDate(date);
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Humanize a millisecond duration into a compact `1h 2m`, `45m 12s`, `12s` string. */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return t("app.format.duration.s", { s: 0 });
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return t("app.format.duration.s", { s: totalSeconds });
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0
      ? t("app.format.duration.ms", { m: minutes, s: seconds })
      : t("app.format.duration.m", { m: minutes });
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0
      ? t("app.format.duration.hm", { h: hours, m: remainingMinutes })
      : t("app.format.duration.h", { h: hours });
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0
    ? t("app.format.duration.dh", { d: days, h: remainingHours })
    : t("app.format.duration.d", { d: days });
}

/** Map a raw provider slug to a display-friendly name. */
export function providerDisplayName(provider: string): string {
  const map: Record<string, string> = {
    anthropic: "Anthropic",
    aws_bedrock: "AWS Bedrock",
    openai: "OpenAI",
    openrouter: "OpenRouter",
    chatgpt: "ChatGPT",
    google: "Google",
    cursor: "Cursor",
    jetbrains: "JetBrains AI",
  };
  return map[provider.toLowerCase()] ?? provider;
}

export function billingTypeDisplayName(billingType: BillingType): string {
  const map: Record<BillingType, string> = {
    metered_api: t("app.lib.utils.billingMeteredApi"),
    subscription_included: t("app.lib.utils.billingSubscription"),
    subscription_overage: t("app.lib.utils.billingSubscriptionOverage"),
    credits: t("app.lib.utils.billingCredits"),
    fixed: t("app.lib.utils.billingFixed"),
    unknown: t("app.common.labels.unknown"),
  };
  return map[billingType];
}

export function quotaSourceDisplayName(source: string): string {
  const map: Record<string, string> = {
    "anthropic-oauth": "Anthropic OAuth",
    "claude-cli": "Claude CLI",
    "bedrock": "AWS Bedrock",
    "codex-rpc": t("app.lib.utils.quotaCodexAppServer"),
    "codex-wham": "ChatGPT WHAM",
  };
  return map[source] ?? source;
}

function coerceBillingType(value: unknown): BillingType | null {
  if (
    value === "metered_api" ||
    value === "subscription_included" ||
    value === "subscription_overage" ||
    value === "credits" ||
    value === "fixed" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

function readRunCostUsd(payload: Record<string, unknown> | null): number {
  if (!payload) return 0;
  for (const key of ["costUsd", "cost_usd", "total_cost_usd"] as const) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

export function visibleRunCostUsd(
  usage: Record<string, unknown> | null,
  result: Record<string, unknown> | null = null,
): number {
  const billingType = coerceBillingType(usage?.billingType) ?? coerceBillingType(result?.billingType);
  if (billingType === "subscription_included") return 0;
  return readRunCostUsd(usage) || readRunCostUsd(result);
}

export function financeEventKindDisplayName(eventKind: FinanceEventKind): string {
  const map: Record<FinanceEventKind, string> = {
    inference_charge: t("app.lib.utils.financeInferenceCharge"),
    platform_fee: t("app.lib.utils.financePlatformFee"),
    credit_purchase: t("app.lib.utils.financeCreditPurchase"),
    credit_refund: t("app.lib.utils.financeCreditRefund"),
    credit_expiry: t("app.lib.utils.financeCreditExpiry"),
    byok_fee: t("app.lib.utils.financeByokFee"),
    gateway_overhead: t("app.lib.utils.financeGatewayOverhead"),
    log_storage_charge: t("app.lib.utils.financeLogStorage"),
    logpush_charge: "Logpush",
    provisioned_capacity_charge: t("app.lib.utils.financeProvisionedCapacity"),
    training_charge: t("app.lib.utils.financeTraining"),
    custom_model_import_charge: t("app.lib.utils.financeCustomModelImport"),
    custom_model_storage_charge: t("app.lib.utils.financeCustomModelStorage"),
    manual_adjustment: t("app.lib.utils.financeManualAdjustment"),
  };
  return map[eventKind];
}

export function financeDirectionDisplayName(direction: FinanceDirection): string {
  return direction === "credit" ? t("app.lib.utils.financeCredit") : t("app.lib.utils.financeDebit");
}

/** Build an issue URL using the human-readable identifier when available. */
export function issueUrl(issue: { id: string; identifier?: string | null }): string {
  return `/issues/${issue.identifier ?? issue.id}`;
}

/** Build an agent route URL using the short URL key when available. */
export function agentRouteRef(agent: { id: string; urlKey?: string | null; name?: string | null }): string {
  return agent.urlKey ?? deriveAgentUrlKey(agent.name, agent.id);
}

/** Build an agent URL using the short URL key when available. */
export function agentUrl(agent: { id: string; urlKey?: string | null; name?: string | null }): string {
  return `/agents/${agentRouteRef(agent)}`;
}

/** Build a project route reference, falling back to UUID when the derived key is ambiguous. */
export function projectRouteRef(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  const key = project.urlKey ?? deriveProjectUrlKey(project.name, project.id);
  // Guard for rolling deploys or legacy data where the server returned a bare slug without UUID suffix.
  if (key === normalizeProjectUrlKey(project.name) && hasNonAsciiContent(project.name)) return project.id;
  return key;
}

/** Build a project URL using the short URL key when available. */
export function projectUrl(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  return `/projects/${projectRouteRef(project)}`;
}

/** Build a project workspace URL scoped under its project. */
export function projectWorkspaceUrl(
  project: { id: string; urlKey?: string | null; name?: string | null },
  workspaceId: string,
): string {
  return `${projectUrl(project)}/workspaces/${workspaceId}`;
}
