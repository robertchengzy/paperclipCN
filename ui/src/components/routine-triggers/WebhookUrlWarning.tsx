import { InlineBanner } from "@/components/InlineBanner";
import { webhookUrlWarningReason, type WebhookUrlWarningReason } from "@/lib/webhook-url-warning";
import { useTranslation } from "@/i18n";

function getWarnings(
  t: (key: string) => string,
): Record<WebhookUrlWarningReason, { title: string; message: string }> {
  return {
    loopback: {
      title: t("app.routines.webhookUrlWarning.loopbackTitle"),
      message: t("app.routines.webhookUrlWarning.loopbackMessage"),
    },
    private: {
      title: t("app.routines.webhookUrlWarning.privateTitle"),
      message: t("app.routines.webhookUrlWarning.privateMessage"),
    },
    tailscale: {
      title: t("app.routines.webhookUrlWarning.tailscaleTitle"),
      message: t("app.routines.webhookUrlWarning.tailscaleMessage"),
    },
    https: {
      title: t("app.routines.webhookUrlWarning.httpsTitle"),
      message: t("app.routines.webhookUrlWarning.httpsMessage"),
    },
    invalid: {
      title: t("app.routines.webhookUrlWarning.invalidTitle"),
      message: t("app.routines.webhookUrlWarning.invalidMessage"),
    },
  };
}

export function WebhookUrlWarning({ url }: { url: string }) {
  const { t } = useTranslation();
  const reason = webhookUrlWarningReason(url);
  if (!reason) return null;
  const warning = getWarnings(t)[reason];
  return <InlineBanner tone="warning" title={warning.title}>
    <div className="space-y-2">
      <p>{warning.message}</p>
      <p>{t("app.routines.webhookUrlWarning.continueHint")}</p>
      <a className="underline underline-offset-4" href="https://docs.paperclip.ing/reference/deploy/https/" target="_blank" rel="noopener noreferrer">{t("app.routines.webhookUrlWarning.learnHttps")}</a>
    </div>
  </InlineBanner>;
}
