import { t, useTranslation } from "@/i18n";
import type { ProviderTraceMetadata } from "@paperclipai/shared";
import { Bug, CircleOff } from "lucide-react";
import { displayLocale, cn } from "@/lib/utils";

export function runRequestedProviderTrace(
  contextSnapshot: Record<string, unknown> | null | undefined,
) {
  if (!contextSnapshot) return false;
  const debug = contextSnapshot.debug;
  return (
    typeof debug === "object" &&
    debug !== null &&
    !Array.isArray(debug) &&
    (debug as Record<string, unknown>).providerTrace === "raw"
  );
}

export function ProviderTraceStatusBadge({
  trace,
  requested = false,
  showOff = false,
  className,
}: {
  trace?: ProviderTraceMetadata | null;
  requested?: boolean;
  showOff?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const status = trace?.status;
  const expired = trace
    ? new Date(trace.expiresAt).getTime() <= Date.now()
    : false;
  const label = expired
    ? t("app.shell.providerTraceStatusBadge.traceExpired")
    : status === "capturing"
      ? t("app.shell.providerTraceStatusBadge.rawTracingEnabled")
      : status === "complete"
        ? t("app.shell.providerTraceStatusBadge.traceCaptured")
        : status === "incomplete"
          ? t("app.shell.providerTraceStatusBadge.traceIncomplete")
          : status === "truncated"
            ? t("app.shell.providerTraceStatusBadge.traceTruncated")
            : status === "expired"
              ? t("app.shell.providerTraceStatusBadge.traceExpired")
              : status === "deleted"
                ? t("app.shell.providerTraceStatusBadge.traceDeleted")
                : requested
                  ? t("app.shell.providerTraceStatusBadge.traceRequested")
                  : showOff
                    ? t("app.shell.providerTraceStatusBadge.traceOff")
                    : null;
  if (!label) return null;
  const warning =
    status === "incomplete" ||
    status === "truncated" ||
    status === "expired" ||
    status === "deleted" ||
    expired;
  const off = !expired && !status && !requested && showOff;
  const Icon = off ? CircleOff : Bug;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-(length:--text-micro) font-medium",
        off || status === "deleted" || status === "expired" || expired
          ? "border-border bg-background text-muted-foreground"
          : warning
            ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        className,
      )}
      title={
        trace
          ? t("app.shell.providerTraceStatusBadge.framesBytesExpires", { value1: trace.frameCount, value2: trace.byteCount, value3: new Date(trace.expiresAt).toLocaleString(displayLocale()) })
          : requested
            ? t("app.shell.providerTraceStatusBadge.thisRunRequestedSensitiveProviderFrameCapture")
            : t("app.shell.providerTraceStatusBadge.rawProviderFrameCaptureWasDisabledFor")
      }
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
