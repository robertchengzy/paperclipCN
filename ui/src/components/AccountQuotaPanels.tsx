import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import type { ProviderQuotaResult } from "@paperclipai/shared";
import { formatDateTime } from "../lib/utils";
import { QuotaBar } from "./QuotaBar";
import { quotaUnavailableMessage } from "../lib/quota-refresh";

export function AccountQuotaPanels({
  accounts,
  failed,
}: {
  accounts: ProviderQuotaResult[];
  failed?: boolean;
}) {
  useUiCopyTranslation();
  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <section
          className="space-y-2"
          key={account.accountKey ?? account.provider}
        >
          <p className="text-sm font-medium">
            {account.accountLabel ?? translateUiCopy("app.uiCopy.componentsAccountQuotaPanels.subscriptionAccount")}
          </p>
          {(failed || !account.ok) && (
            <p className="text-sm text-muted-foreground">
              {account.errorFamily === "credentials_unavailable"
                ? translateUiCopy("app.uiCopy.componentsAccountQuotaPanels.connectOrReconnectASubscriptionInAIConnectionsTo")
                : quotaUnavailableMessage(account.windows.length > 0)}
            </p>
          )}
          {account.windows.map((window, index) => window.usedPercent == null ? (
            <div key={`${window.label}:${index}`} className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <span>{window.label}</span>
                <span className="font-mono text-muted-foreground">{window.valueLabel ?? translateUiCopy("app.uiCopy.componentsAccountQuotaPanels.usageNotReported")}</span>
              </div>
              {window.resetsAt && <p className="text-xs font-mono text-muted-foreground"><Trans i18nKey="app.uiCopy.componentsAccountQuotaPanels.message0" components={{ part0: <>{""}{formatDateTime(window.resetsAt)}</> }} /></p>}
            </div>
          ) : (
            <QuotaBar
              key={`${window.label}:${index}`}
              className="font-mono"
              label={window.label}
              percentUsed={window.usedPercent}
              leftLabel={
                window.valueLabel ??
                (window.usedPercent === null
                  ? translateUiCopy("app.uiCopy.componentsAccountQuotaPanels.usageNotReported")
                  : translateUiCopy("app.uiCopy.componentsAccountQuotaPanels.value0Used", { value0: String(window.usedPercent) }))
              }
              rightLabel={
                window.resetsAt
                  ? translateUiCopy("app.uiCopy.componentsAccountQuotaPanels.resetsValue0", { value0: String(formatDateTime(window.resetsAt)) })
                  : undefined
              }
            />
          ))}
          {account.capturedAt && (
            <p className="text-xs font-mono text-muted-foreground"><Trans i18nKey="app.uiCopy.componentsAccountQuotaPanels.message1" components={{ part0: <>{""}{formatDateTime(account.capturedAt)}</> }} /></p>
          )}
        </section>
      ))}
    </div>
  );
}
