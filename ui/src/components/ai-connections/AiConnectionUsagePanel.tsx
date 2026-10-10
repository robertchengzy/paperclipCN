import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useMutation } from "@tanstack/react-query";
import type { AiConnectionUsage, AiConnectionUsageLimit, AiManagedConnectionSummary } from "@paperclipai/shared";
import { supportsAiConnectionUsage } from "@paperclipai/shared";
import { aiConnectionsApi } from "@/api/ai-connections";
import { Button } from "@/components/ui/button";
import { QuotaBar } from "@/components/QuotaBar";
import { formatDateTime, formatNumber } from "@/lib/utils";

const usageNumber = (value: number) => formatNumber(value, { maximumFractionDigits: 20 });
const amount = (value: number, unit: string | null) => unit === "USD"
  ? formatNumber(value, { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 20 })
  : `${usageNumber(value)}${unit ? ` ${unit}` : ""}`;

function limitLabel(window: AiConnectionUsageLimit) {
  const label = window.label.replace(/\b(\d+(?:\.\d+)?) hour limit\b/i, "$1h").replace(/\bweekly limit\b/i, "Weekly");
  if (window.windowDurationSeconds == null) return label;
  const hours = window.windowDurationSeconds / 3600;
  const period = hours === 168 ? translateUiCopy("app.shell.scheduleEditor.weekly") : `${usageNumber(hours)}h`;
  if (/\b(?:Primary|Secondary)$/.test(label)) return `${label} · ${period}`;
  if ((hours === 168 && /weekly/i.test(label)) || label.split(/[\s·()]+/).includes(period)) return label;
  return `${label} · ${period}`;
}

function limitValue(window: AiConnectionUsageLimit) {
  if (window.used === 0 && window.limit === 0) return `${amount(window.limit, window.unit)} cap`;
  if (window.used != null && window.limit != null) return `${amount(window.used, window.unit)} / ${amount(window.limit, window.unit)} used`;
  if (window.usedPercent != null) return `${usageNumber(window.usedPercent)}% used`;
  if (window.used != null) return `${amount(window.used, window.unit)} used`;
  if (window.remainingPercent != null) return `${usageNumber(window.remainingPercent)}% left`;
  return translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.notReported");
}

function limitDetails(window: AiConnectionUsageLimit) {
  const details: string[] = [];
  if (window.allowed === false) details.push("Blocked");
  else if (window.limitReached === true) details.push("Limit reached");
  if (window.allowed === true && (window.limitReached === true || window.usedPercent == null)) details.push("Usage allowed");
  if (window.used == null || window.limit == null) {
    if (window.remaining != null) details.push(`${amount(window.remaining, window.unit)} left`);
    if (window.limit != null) details.push(`${amount(window.limit, window.unit)} cap`);
  }
  if (window.resetsAt) details.push(`Resets ${formatDateTime(window.resetsAt, { includeYear: false })}`);
  else if (window.resetInterval) details.push(`Resets ${window.resetInterval}`);
  return details.join(" · ");
}

function overageSummary(usage: AiConnectionUsage) {
  const overage = usage.overage!;
  const details = [overage.available === true ? "Available"
    : overage.enabled === false ? "Off"
    : overage.available === false ? (overage.enabled === true ? "On · Unavailable" : "Unavailable")
    : overage.enabled === true ? "On · Availability unknown" : "Not reported"];
  if (overage.unlimited === true) details.push("Unlimited");
  else if (overage.balance != null && (overage.balance !== 0 || overage.enabled !== false)) details.push(amount(overage.balance, overage.unit));
  if (overage.remaining != null && (overage.remaining !== 0 || overage.enabled !== false)
    && !usage.limits.some((window) => window.scope === "overage" && window.remaining === overage.remaining && window.unit === overage.unit)) {
    details.push(`${amount(overage.remaining, overage.unit)} left`);
  }
  return details.join(" · ");
}

function usageError(usage: AiConnectionUsage) {
  switch (usage.errorCode) {
    case "authentication_required": return translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.signInAgainToCheckUsage");
    case "permission_denied": return translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.usageAccessDenied");
    case "rate_limited": return translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.tooManyChecksTryAgainLater");
    case "provider_unavailable": return translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.providerUnavailableTryAgain");
    case "invalid_response": return translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.couldnTReadUsageTryAgain");
    case "connection_unavailable": return translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.reconnectToCheckUsage");
    case "unsupported": return translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.usageUnavailable");
    default: return usage.message ?? translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.usageUnavailable");
  }
}

export function AiConnectionUsagePanel({ account, observation, cachedOnly = false }: { account: AiManagedConnectionSummary; observation?: AiConnectionUsage; cachedOnly?: boolean }) {
  useUiCopyTranslation();
  const probe = useMutation({
    mutationFn: () => aiConnectionsApi.probeUsage(account.companyId, account.id, account.grantId),
  });
  const supported = supportsAiConnectionUsage(account.provider, account.method);
  const usage = cachedOnly ? observation : probe.isSuccess ? probe.data : undefined;
  return (
    <section aria-label={translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.accountUsageLimits")} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{translateUiCopy("app.secrets.secrets.tabUsage")}</h3>
        {supported && !cachedOnly && <Button variant="outline" size="sm" disabled={probe.isPending || account.status !== "connected"} onClick={() => probe.mutate()}>
          {probe.isPending ? translateUiCopy("app.common.progress.checking") : usage?.status === "ok" ? translateUiCopy("app.common.actions.refresh") : translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.checkUsage")}
        </Button>}
      </div>
      {cachedOnly && !usage && <p className="text-xs text-muted-foreground">{translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.usageNotObserved")}</p>}
      {!supported && <p className="text-xs text-muted-foreground">{translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.unavailableForThisSignInMethod")}</p>}
      {probe.error && <p role="alert" className="text-sm text-destructive">{probe.error.message}</p>}
      {usage && usage.status !== "ok" && <p role={usage.status === "unsupported" ? "status" : "alert"} className="text-sm text-muted-foreground">{usageError(usage)}</p>}
      {usage?.status === "ok" && (
        <div className="space-y-3" aria-live="polite">
          {usage.limits.length === 0 && <p className="text-xs text-muted-foreground">{translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.usageNotReported")}</p>}
          {usage.limits.map((window) => {
            const details = limitDetails(window);
            return <div key={window.id} className="space-y-1.5">
              {window.usedPercent != null ? <QuotaBar label={limitLabel(window)} percentUsed={window.usedPercent} leftLabel={limitValue(window)} />
                : <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{limitLabel(window)}</span>
                  <span className="font-mono">{limitValue(window)}</span>
                </div>}
              {details && <p className="text-xs text-muted-foreground">{details}</p>}
            </div>;
          })}
          {usage.overage && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionUsagePanel.overage")}</span>
            <span className="font-mono">{overageSummary(usage)}</span>
          </div>}
          <p className="text-xs text-muted-foreground">{translateUiCopy("app.common.labels.updated")} <time className="font-mono" dateTime={usage.checkedAt} title={formatDateTime(usage.checkedAt)}>{formatDateTime(usage.checkedAt, { includeYear: false })}</time>{usage.planType ? ` · ${usage.planType}` : ""}</p>
        </div>
      )}
    </section>
  );
}
