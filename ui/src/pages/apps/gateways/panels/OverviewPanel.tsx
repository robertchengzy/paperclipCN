import { useTranslation } from "@/i18n";
import { Copy } from "lucide-react";
import type { ToolMcpGatewayWithTokens, ToolProfileWithDetails } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  activeTokenCount,
  allowedToolsLabel,
  expiringTokenCount,
  formatScope,
  type GatewayAppRow,
  gatewayAppDisplayName,
  isGatewayOn,
} from "../gateway-helpers";

export function OverviewPanel({
  gateway,
  profile,
  apps,
  agentNames,
  projectNames,
  toggleDisabled,
  onToggle,
}: {
  gateway: ToolMcpGatewayWithTokens;
  profile: ToolProfileWithDetails | undefined;
  apps: GatewayAppRow[];
  agentNames: Map<string, string>;
  projectNames: Map<string, string>;
  toggleDisabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const endpoint = `${typeof window !== "undefined" ? window.location.origin : ""}${gateway.endpointPath}`;
  const active = activeTokenCount(gateway);
  const expiring = expiringTokenCount(gateway);
  const needsAttention = apps.filter((app) => app.needsAttention);
  const on = isGatewayOn(gateway);

  const snippet = [
    "{",
    '  "mcpServers": {',
    `    "paperclip-${gateway.displaySlug}": {`,
    `      "url": "${endpoint}",`,
    '      "headers": { "Authorization": "Bearer pcgw_•••_TOKEN" }',
    "    }",
    "  }",
    "}",
  ].join("\n");

  async function copy(value: string, label: string) {
    try {
      await copyTextToClipboard(value);
      pushToast({ title: t("app.common.states.copied"), body: label, tone: "success" });
    } catch {
      pushToast({ title: t("app.common.messages.copyFailed"), body: t("app.common.messages.clipboardUnavailable"), tone: "error" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border p-4">
          <div className="text-xs font-medium text-muted-foreground">{on ? t("app.common.labels.on") : t("app.common.labels.off")}</div>
          <div className="mt-2">
            <ToggleSwitch checked={on} disabled={toggleDisabled} onCheckedChange={onToggle} aria-label={t("app.apps.overviewPanel.toggleGateway")} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("app.apps.overviewPanel.toggleTheWholeGatewayOffHere")}</p>
        </div>
        <StatCard label={t("app.common.nouns.apps")}>
          {profile ? t("app.apps.gatewayHelpers.appsAndTools", { apps: apps.length === 1 ? t("app.apps.gatewayHelpers.appOne", { count: apps.length }) : t("app.apps.gatewayHelpers.appMany", { count: apps.length }), tools: allowedToolsLabel(profile) }) : apps.length === 1 ? t("app.apps.gatewayHelpers.appOne", { count: apps.length }) : t("app.apps.gatewayHelpers.appMany", { count: apps.length })}
        </StatCard>
        <StatCard label={t("app.common.labels.tokens")}>
          {expiring > 0 ? t("app.apps.gatewayHelpers.activeExpiringTokens", { active, expiring }) : t("app.apps.gatewayHelpers.activeTokens", { active })}
        </StatCard>
        <StatCard label={t("app.apps.overviewPanel.health")}>
          {needsAttention.length === 0 ? t("app.apps.overviewPanel.allGreen") : t("app.apps.overviewPanel.attentionCount", { count: needsAttention.length })}
        </StatCard>
      </div>

      <section className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("app.apps.overviewPanel.whoCanUseIt")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("app.apps.overviewPanel.anyoneHoldingAnActiveTokenBelowRestricted")}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip>{t("app.apps.overviewPanel.scopeLabel", { scope: formatScope(gateway, projectNames, agentNames) })}</Chip>
          <Chip>{t("app.apps.overviewPanel.profileLabel", { profile: profile?.name ?? t("app.common.states.unavailable") })}</Chip>
          <Chip>{active === 1 ? t("app.apps.overviewPanel.activeTokenOne", { active }) : t("app.apps.overviewPanel.activeTokenMany", { active })}</Chip>
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">{t("app.apps.overviewPanel.appsInThisGateway")}</h3>
        {apps.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("app.apps.overviewPanel.thisGatewaySProfileDoesnTInclude")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {apps.map((app) => (
              <AppRow key={app.application.id} app={app} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t("app.apps.overviewPanel.howClientsConnect")}</h3>
          <Button variant="outline" size="sm" onClick={() => void copy(snippet, t("app.apps.overviewPanel.clientConfig"))}>
            <Copy className="mr-1 h-3.5 w-3.5" />{t("app.common.actions.copy")}</Button>
        </div>
        <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-3 font-mono text-xs text-muted-foreground">
          {snippet}
        </pre>
      </section>
    </div>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-semibold text-foreground">{children}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

function AppRow({ app }: { app: GatewayAppRow }) {
  const { t } = useTranslation();
  const href = app.connection
    ? `/apps/${app.connection.id}/permissions`
    : `/apps/app/${app.application.id}/permissions`;
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <Link to={href} className="font-medium text-foreground hover:underline">
          {gatewayAppDisplayName(app)}
        </Link>
        <div className="text-xs text-muted-foreground">
          {app.toolCount === 1 ? t("app.apps.gatewayHelpers.toolCountOne", { count: app.toolCount }) : t("app.apps.gatewayHelpers.toolCountMany", { count: app.toolCount })}
          {app.needsAttention && app.attentionReason ? ` · ${app.attentionReason}` : ""}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
          app.needsAttention
            ? "border-foreground bg-foreground text-background"
            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        )}
      >
        {app.needsAttention ? t("app.common.states.needsAttention") : t("app.common.states.healthy")}
      </span>
    </li>
  );
}
