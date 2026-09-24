import { useEffect, useState } from "react";
import { i18n, t } from "@/i18n";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DUE_NOW_GRACE_MS = MINUTE_MS;

type MonitorDate = Date | string;

type MonitorDetails = {
  nextCheckAt?: MonitorDate | null;
  attemptCount?: number | null;
  serviceName?: string | null;
  status?: "scheduled" | "triggered" | "cleared" | null;
};

type MonitorPolicy = {
  nextCheckAt?: MonitorDate | null;
  serviceName?: string | null;
};

type ScheduledRetry = {
  status?: "scheduled_retry" | "queued" | "running" | "cancelled" | null;
  scheduledRetryAt?: MonitorDate | null;
  scheduledRetryAttempt?: number | null;
};

export interface MonitorIssueLike {
  status?: string;
  executionState?: { monitor?: MonitorDetails | null } | null;
  executionPolicy?: { monitor?: MonitorPolicy | null } | null;
  monitorNextCheckAt?: MonitorDate | null;
  monitorAttemptCount?: number | null;
  scheduledRetry?: ScheduledRetry | null;
}

export type MonitorDisplayState =
  | "scheduled"
  | "retrying"
  | "due-now"
  | "overdue"
  | "cleared"
  | "none";

export interface DerivedMonitorState {
  state: MonitorDisplayState;
  source: "monitor" | "scheduled-retry" | "none";
  nextCheckAt: MonitorDate | null;
  attemptCount: number;
  serviceName: string | null;
}

export interface MonitorDateTimeFormatOptions {
  locale?: Intl.LocalesArgument;
  timeZone?: string;
}

function toTimestamp(value: MonitorDate): number {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) throw new RangeError("Invalid monitor date");
  return timestamp;
}

function formatDuration(durationMs: number): string {
  if (durationMs < MINUTE_MS) {
    return t("app.format.duration.s", { s: Math.max(1, Math.ceil(durationMs / SECOND_MS)) });
  }
  if (durationMs < HOUR_MS) {
    return t("app.format.duration.m", { m: Math.floor(durationMs / MINUTE_MS) });
  }
  if (durationMs < DAY_MS) {
    const hours = Math.floor(durationMs / HOUR_MS);
    const minutes = Math.floor((durationMs % HOUR_MS) / MINUTE_MS);
    return minutes > 0
      ? t("app.format.duration.hm", { h: hours, m: minutes })
      : t("app.format.duration.h", { h: hours });
  }

  const days = Math.floor(durationMs / DAY_MS);
  const hours = Math.floor((durationMs % DAY_MS) / HOUR_MS);
  return hours > 0
    ? t("app.format.duration.dh", { d: days, h: hours })
    : t("app.format.duration.d", { d: days });
}

type MonitorEta =
  | { kind: "in"; durationMs: number }
  | { kind: "due-now" }
  | { kind: "overdue"; durationMs: number };

function monitorEta(nextCheckAt: MonitorDate, now: MonitorDate): MonitorEta {
  const deltaMs = toTimestamp(nextCheckAt) - toTimestamp(now);
  if (deltaMs > 0) return { kind: "in", durationMs: deltaMs };
  if (deltaMs > -DUE_NOW_GRACE_MS) return { kind: "due-now" };
  return { kind: "overdue", durationMs: Math.abs(deltaMs) };
}

export function formatMonitorEta(nextCheckAt: MonitorDate, now: MonitorDate = new Date()): string {
  const eta = monitorEta(nextCheckAt, now);
  if (eta.kind === "in") return t("app.format.monitor.in", { duration: formatDuration(eta.durationMs) });
  if (eta.kind === "due-now") return t("app.format.monitor.dueNow");
  return t("app.format.monitor.overdueBy", { duration: formatDuration(eta.durationMs) });
}

export function formatMonitorEtaLabel(nextCheckAt: MonitorDate, now: MonitorDate = new Date()): string {
  const eta = monitorEta(nextCheckAt, now);
  if (eta.kind === "in") return t("app.format.monitor.inLabel", { duration: formatDuration(eta.durationMs) });
  if (eta.kind === "due-now") return t("app.format.monitor.dueNowLabel");
  return t("app.format.monitor.overdueByLabel", { duration: formatDuration(eta.durationMs) });
}

function monitorDisplayLocale(locale: Intl.LocalesArgument): Intl.LocalesArgument {
  if (locale !== undefined) return locale;
  return i18n.language === "zh-CN" ? "zh-CN" : undefined;
}

function zonedYmd(
  date: Date,
  locale: Intl.LocalesArgument,
  timeZone: string | undefined,
): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone,
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/**
 * Compact absolute time for the monitor surfaces (wireframe 04). Renders
 * `Today, 8:16 PM` when the check lands on the reference day, otherwise prefixes
 * the weekday (`Mon Jul 20, 9:00 AM`) and only adds the year when it differs from
 * the reference year (`Mon Jul 20, 2027, 9:00 AM`). Day/year comparisons are made
 * in the display time zone so "Today" matches what the user sees.
 */
export function formatMonitorAbsolute(
  nextCheckAt: MonitorDate,
  options: MonitorDateTimeFormatOptions = {},
  now: MonitorDate = new Date(),
): string {
  const locale = monitorDisplayLocale(options.locale);
  const target = new Date(toTimestamp(nextCheckAt));
  const reference = new Date(toTimestamp(now));
  const targetYmd = zonedYmd(target, locale, options.timeZone);
  const referenceYmd = zonedYmd(reference, locale, options.timeZone);

  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: options.timeZone,
  }).format(target);

  const isToday =
    targetYmd.year === referenceYmd.year &&
    targetYmd.month === referenceYmd.month &&
    targetYmd.day === referenceYmd.day;
  if (isToday) return t("app.format.monitor.todayAt", { time });

  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: options.timeZone,
  }).format(target);
  const date = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: targetYmd.year === referenceYmd.year ? undefined : "numeric",
    timeZone: options.timeZone,
  }).format(target);

  return t("app.format.monitor.weekdayDateTime", { weekday, date, time });
}

export function formatMonitorAbsoluteFull(
  nextCheckAt: MonitorDate,
  options: MonitorDateTimeFormatOptions = {},
): string {
  const locale = monitorDisplayLocale(options.locale);
  const date = new Date(toTimestamp(nextCheckAt));
  const datePart = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: options.timeZone,
  }).format(date);
  const timePart = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
    timeZone: options.timeZone,
  }).format(date);
  return t("app.format.monitor.fullDateTime", { date: datePart, time: timePart });
}

export function deriveMonitorState(issue: MonitorIssueLike, now: MonitorDate = new Date()): DerivedMonitorState {
  if (issue.status === "done" || issue.status === "cancelled") {
    return { state: "none", source: "none", nextCheckAt: null, attemptCount: 0, serviceName: null };
  }

  const runtimeMonitor = issue.executionState?.monitor ?? null;
  const policyMonitor = issue.executionPolicy?.monitor ?? null;
  const scheduledRetry = issue.scheduledRetry ?? null;
  // Promotion preserves scheduledRetryAt as history. Once queued or running,
  // the retry is no longer waiting for that timestamp and cannot be overdue.
  const retryIsScheduled = scheduledRetry?.status === "scheduled_retry";
  const nextCheckAt =
    runtimeMonitor?.nextCheckAt ??
    issue.monitorNextCheckAt ??
    policyMonitor?.nextCheckAt ??
    (retryIsScheduled ? scheduledRetry?.scheduledRetryAt : null) ??
    null;
  const hasMonitor = runtimeMonitor !== null || policyMonitor !== null || issue.monitorNextCheckAt != null;
  const source = hasMonitor ? "monitor" : retryIsScheduled ? "scheduled-retry" : "none";
  const attemptCount =
    runtimeMonitor?.attemptCount ??
    (hasMonitor ? issue.monitorAttemptCount : null) ??
    (retryIsScheduled ? scheduledRetry?.scheduledRetryAttempt : null) ??
    0;
  const serviceName = runtimeMonitor?.serviceName ?? policyMonitor?.serviceName ?? null;

  if (runtimeMonitor?.status === "cleared") {
    return { state: "cleared", source, nextCheckAt, attemptCount, serviceName };
  }

  if (!hasMonitor && !retryIsScheduled) {
    return { state: "none", source, nextCheckAt: null, attemptCount: 0, serviceName: null };
  }
  if (!nextCheckAt) {
    return { state: retryIsScheduled || attemptCount > 1 ? "retrying" : "scheduled", source, nextCheckAt, attemptCount, serviceName };
  }

  const deltaMs = toTimestamp(nextCheckAt) - toTimestamp(now);
  if (deltaMs <= -DUE_NOW_GRACE_MS) {
    return { state: "overdue", source, nextCheckAt, attemptCount, serviceName };
  }
  if (deltaMs <= 0) {
    return { state: "due-now", source, nextCheckAt, attemptCount, serviceName };
  }
  return {
    state: retryIsScheduled || attemptCount > 1 ? "retrying" : "scheduled",
    source,
    nextCheckAt,
    attemptCount,
    serviceName,
  };
}

function countdownCadence(nextCheckAt: MonitorDate): number {
  const deltaMs = toTimestamp(nextCheckAt) - Date.now();
  return deltaMs > -DUE_NOW_GRACE_MS && deltaMs < DUE_NOW_GRACE_MS ? SECOND_MS : 30 * SECOND_MS;
}

export function useMonitorCountdown(nextCheckAt: MonitorDate | null | undefined): Date {
  const [now, setNow] = useState(() => new Date(Date.now()));
  const nextCheckTimestamp = nextCheckAt == null ? null : toTimestamp(nextCheckAt);

  useEffect(() => {
    setNow(new Date(Date.now()));
    if (nextCheckTimestamp === null) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const scheduleNextTick = () => {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setNow(new Date(Date.now()));
        scheduleNextTick();
      }, countdownCadence(new Date(nextCheckTimestamp)));
    };

    scheduleNextTick();
    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [nextCheckTimestamp]);

  return now;
}

export function formatMonitorOffset(nextCheckAt: MonitorDate): string {
  const now = new Date(Date.now());
  const deltaMs = toTimestamp(nextCheckAt) - now.getTime();
  if (Math.round(Math.abs(deltaMs) / MINUTE_MS) === 0) return t("app.format.monitor.offsetNow");
  const eta = monitorEta(nextCheckAt, now);
  if (eta.kind === "due-now") return t("app.format.monitor.offsetNow");
  if (eta.kind === "overdue") return t("app.format.monitor.offsetAgo", { duration: formatDuration(eta.durationMs) });
  return t("app.format.monitor.in", { duration: formatDuration(eta.durationMs) });
}
