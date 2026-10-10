import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import type { AiConnectionRouterSelection } from "@paperclipai/shared";

export function AiConnectionPoolRunDetails({ context }: { context: Record<string, unknown> | null }) {
  useUiCopyTranslation();
  const selection = context?.aiRouterSelection as AiConnectionRouterSelection | undefined;
  if (!selection) return null;
  const account = context?.aiConnection as { accountName?: string; connectionId?: string } | undefined;
  const config = selection.runtimeConfig;
  const effort = config.modelReasoningEffort ?? config.reasoningEffort ?? config.effort ?? config.variant;
  return <div className="rounded-lg border p-4 text-sm space-y-1">
    <p className="font-medium"><Trans i18nKey="app.uiCopy.componentsAiConnectionsAiConnectionPoolRunDetails.message16" components={{ part0: <>{""}{account?.accountName ?? account?.connectionId ?? translateUiCopy("app.uiCopy.componentsAiConnectionsAiConnectionPoolRunDetails.selectedAccount")}</> }} /></p>
    <p>{[selection.binding.provider, config.provider, config.acpxAgent, config.model, effort].filter(Boolean).map(String).join(" · ")}</p>
    {selection.notes.length > 0 && <p className="text-muted-foreground">{selection.notes.join(" ")}</p>}
  </div>;
}
