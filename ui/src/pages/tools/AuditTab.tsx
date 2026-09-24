import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { Link } from "@/lib/router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import {
  toolsApi,
  type ToolAuditOutcome,
  type ToolAuditWindow,
  type ToolGatewayActivityEvent,
} from "@/api/tools";
import { agentsApi } from "@/api/agents";
import { AgentSelect } from "@/components/AgentMultiSelect";
import { ToolsPageHeader, LoadingState, ErrorState, RelativeTime } from "./shared";
import { Trans } from "react-i18next";
import { t as translate, useTranslation } from "@/i18n";

const PAGE_SIZE = 50;
const ALL = "__all";

/** Outcome chip vocabulary (spec §4C / §5): Allowed · Blocked · Asked first · Failed · Waiting. */
const OUTCOME_META: Record<ToolAuditOutcome, { labelKey: string; status: string }> = {
  allowed: { labelKey: "app.tools.auditTab.outcomes.allowed", status: "allowed" },
  blocked: { labelKey: "app.tools.auditTab.outcomes.blocked", status: "denied" },
  asked_first: { labelKey: "app.tools.auditTab.outcomes.askedFirst", status: "require-approval" },
  waiting: { labelKey: "app.tools.auditTab.outcomes.waiting", status: "deferred" },
  failed: { labelKey: "app.tools.auditTab.outcomes.failed", status: "failed" },
  unknown: { labelKey: "app.tools.auditTab.outcomes.recorded", status: "unchecked" },
};

function getOutcomeFilters(): { value: string; label: string }[] {
  return [
    { value: ALL, label: translate("app.tools.auditTab.filters.allOutcomes") },
    { value: "allowed", label: translate("app.tools.auditTab.outcomes.allowed") },
    { value: "blocked", label: translate("app.tools.auditTab.outcomes.blocked") },
    { value: "asked_first", label: translate("app.tools.auditTab.outcomes.askedFirst") },
    { value: "waiting", label: translate("app.tools.auditTab.outcomes.waiting") },
    { value: "failed", label: translate("app.tools.auditTab.outcomes.failed") },
  ];
}

function getWindowFilters(): { value: ToolAuditWindow; label: string }[] {
  return [
    { value: "all", label: translate("app.tools.auditTab.filters.allTime") },
    { value: "1h", label: translate("app.tools.auditTab.filters.last1h") },
    { value: "24h", label: translate("app.tools.auditTab.filters.last24h") },
    { value: "7d", label: translate("app.tools.auditTab.filters.last7d") },
    { value: "30d", label: translate("app.tools.auditTab.filters.last30d") },
  ];
}

function detailString(details: Record<string, unknown> | null, key: string): string | undefined {
  const v = details?.[key];
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

function detailStringArray(details: Record<string, unknown> | null, key: string): string[] {
  const v = details?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function detailRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function detailNumber(details: Record<string, unknown> | null, key: string): number | undefined {
  const value = details?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formattedArguments(details: Record<string, unknown> | null): string | undefined {
  const summary = detailRecord(details?.argumentsSummary);
  const serialized = typeof summary?.summary === "string" ? summary.summary : undefined;
  if (!serialized) return undefined;
  try {
    return JSON.stringify(JSON.parse(serialized), null, 2);
  } catch {
    return serialized;
  }
}

function lifecycleSummary(event: ToolGatewayActivityEvent): string | null {
  if (!event.lifecycleType) return null;
  const who = event.actorDisplayName ?? event.agentDisplayName ?? translate("app.common.labels.someone");
  const app = event.appDisplayName ?? event.connectionDisplayName ?? translate("app.tools.auditTab.lifecycle.thisApp");
  const count = detailNumber(event.details, "count") ?? 0;
  const added = detailNumber(event.details, "added") ?? 0;
  const removed = detailNumber(event.details, "removed") ?? 0;
  switch (event.lifecycleType) {
    case "app_connected":
      return translate("app.tools.auditTab.lifecycle.connected", { who, app });
    case "app_paused":
      return translate("app.tools.auditTab.lifecycle.paused", { who, app });
    case "app_resumed":
      return translate("app.tools.auditTab.lifecycle.resumed", { who, app });
    case "reconnected":
      return translate("app.tools.auditTab.lifecycle.reconnected", { who, app });
    case "disconnected":
      return translate("app.tools.auditTab.lifecycle.disconnected", { who, app });
    case "allowlist_changed":
      if (added > 0 && removed === 0) {
        return added === 1
          ? translate("app.tools.auditTab.lifecycle.addedOne", { who, app })
          : translate("app.tools.auditTab.lifecycle.addedMany", { who, app, count: added });
      }
      if (removed > 0 && added === 0) {
        return removed === 1
          ? translate("app.tools.auditTab.lifecycle.removedOne", { who, app })
          : translate("app.tools.auditTab.lifecycle.removedMany", { who, app, count: removed });
      }
      return translate("app.tools.auditTab.lifecycle.allowlistUpdated", { who, app });
    case "actions_quarantined":
      return count === 1
        ? translate("app.tools.auditTab.lifecycle.quarantinedOne", { app })
        : translate("app.tools.auditTab.lifecycle.quarantinedMany", { app, count });
    default:
      return translate("app.tools.auditTab.lifecycle.updated", { who, app });
  }
}

/** Plain-words "why" for the row expander, keyed off the reason code. */
function plainReason(event: ToolGatewayActivityEvent): string {
  if (event.lifecycleType) return translate("app.tools.auditTab.reasons.lifecycle");
  const code = detailString(event.details, "reasonCode");
  if (code === "permitted_connections_not_installed") {
    return translate("app.tools.auditTab.reasons.notInstalled");
  }
  switch (event.normalizedOutcome) {
    case "allowed":
      return translate("app.tools.auditTab.reasons.allowed");
    case "blocked":
      if (code === "rate_limited") return translate("app.tools.auditTab.reasons.rateLimited");
      if (code?.includes("secret")) return translate("app.tools.auditTab.reasons.secret");
      return translate("app.tools.auditTab.reasons.blocked");
    case "asked_first":
      return translate("app.tools.auditTab.reasons.askedFirst");
    case "waiting":
      return translate("app.tools.auditTab.reasons.waiting");
    case "failed":
      return translate("app.tools.auditTab.reasons.failed");
    default:
      return translate("app.tools.auditTab.reasons.recorded");
  }
}

/** Compact monospace fact row inside the Details collapse. */
function DetailFact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-all text-foreground", mono && "font-mono text-(length:--text-micro)")}>{value}</span>
    </div>
  );
}

function OutcomeChip({ outcome }: { outcome: ToolAuditOutcome }) {
  const { t } = useTranslation();
  const meta = OUTCOME_META[outcome] ?? OUTCOME_META.unknown;
  return <StatusBadge status={meta.status} label={t(meta.labelKey)} />;
}

function ActivityRow({
  event,
  ruleNamesById,
}: {
  event: ToolGatewayActivityEvent;
  ruleNamesById: Map<string, string>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const who = event.agentDisplayName ?? t("app.tools.auditTab.anAgent");
  const action = event.toolDisplayName ?? t("app.tools.auditTab.anAction");
  const app = event.appDisplayName ?? event.connectionDisplayName ?? event.applicationDisplayName ?? null;
  const lifecycle = lifecycleSummary(event);
  const rawTool = detailString(event.details, "tool") ?? detailString(event.details, "toolName");

  const issueId = detailString(event.details, "issueId");
  const runId = event.runId ?? detailString(event.details, "runId");
  const agentId = event.agentId ?? detailString(event.details, "agentId");
  const reasonCode = detailString(event.details, "reasonCode") ?? event.action.replace("tool_gateway.", "");
  const matchedRuleId = detailStringArray(event.details, "matchedPolicyIds").find((id) => ruleNamesById.has(id));
  const matchedRuleName = matchedRuleId ? ruleNamesById.get(matchedRuleId) : undefined;
  const argumentsText = formattedArguments(event.details);
  const execution = detailRecord(event.details?.execution);
  const request = detailRecord(execution?.request);
  const response = detailRecord(execution?.response);
  const transport = detailString(execution, "transport");
  const requestMethod = detailString(request, "httpMethod");
  const endpoint = detailString(request, "endpoint");
  const mcpMethod = detailString(request, "mcpMethod");
  const requestId = detailString(request, "requestId");
  const httpStatus = detailNumber(response, "httpStatus");
  const contentType = detailString(response, "contentType");
  const responseBytes = detailNumber(response, "bodySizeBytes");
  const upstreamRequestId = detailString(response, "upstreamRequestId");
  const permittedNotInstalledCount = detailNumber(event.details, "permittedNotInstalledCount");
  const permittedNotInstalledConnections = Array.isArray(event.details?.permittedNotInstalledConnections)
    ? event.details.permittedNotInstalledConnections
      .map(detailRecord)
      .filter((connection): connection is Record<string, unknown> => connection !== null)
    : [];
  const isRuntimeMcpDeliveryDiagnostic = reasonCode === "permitted_connections_not_installed";

  return (
    <li className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-accent/50"
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          {lifecycle ? (
            <span className="block text-foreground">{lifecycle}</span>
          ) : isRuntimeMcpDeliveryDiagnostic ? (
            <span className="block text-foreground">
              <Trans
                i18nKey={
                  (permittedNotInstalledCount ?? permittedNotInstalledConnections.length) === 1
                    ? "app.tools.auditTab.deliveryOne"
                    : "app.tools.auditTab.deliveryMany"
                }
                values={{ who, count: permittedNotInstalledCount ?? permittedNotInstalledConnections.length }}
                components={{ b: <span className="font-medium" /> }}
              />
            </span>
          ) : (
            <span className="block text-foreground">
              <Trans
                i18nKey={app ? "app.tools.auditTab.usedIn" : "app.tools.auditTab.used"}
                values={{ who, action, app }}
                components={{ b: <span className="font-medium" /> }}
              />
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          {event.lifecycleType ? null : <OutcomeChip outcome={event.normalizedOutcome} />}
          <span className="text-xs text-muted-foreground">
            · <RelativeTime value={event.createdAt} />
          </span>
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border bg-muted/30 px-4 py-3 pl-10 text-sm">
          <p className="text-foreground">
            {plainReason(event)}
            {matchedRuleName ? (
              <>
                {" "}
                <span className="font-medium">{matchedRuleName}</span>
              </>
            ) : null}
          </p>

          <div className="flex flex-wrap gap-3 text-xs">
            {issueId ? (
              <Link to={`/issues/${issueId}`} className="text-primary hover:underline">
                {t("app.tools.auditTab.viewTask")}
              </Link>
            ) : null}
            {runId && agentId ? (
              <Link to={`/agents/${agentId}/runs/${runId}`} className="text-primary hover:underline">
                {t("app.tools.auditTab.viewRun")}
              </Link>
            ) : null}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {detailsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("app.common.labels.details")}
            </button>
            {detailsOpen ? (
              <div className="mt-2 space-y-1.5 text-xs">
                {rawTool ? <DetailFact label={t("app.tools.auditTab.facts.actionName")} value={rawTool} mono /> : null}
                <DetailFact label={t("app.tools.auditTab.facts.reasonCode")} value={reasonCode} mono />
                <DetailFact label={t("app.tools.auditTab.facts.actorType")} value={event.actorType ?? "—"} />
                {runId ? <DetailFact label={t("app.tools.auditTab.facts.runId")} value={runId} mono /> : null}
                {transport ? <DetailFact label={t("app.tools.auditTab.facts.transport")} value={transport} mono /> : null}
                {requestMethod && endpoint ? <DetailFact label={t("app.tools.auditTab.facts.httpRequest")} value={`${requestMethod} ${endpoint}`} mono /> : null}
                {mcpMethod ? <DetailFact label={t("app.tools.auditTab.facts.mcpMethod")} value={mcpMethod} mono /> : null}
                {requestId ? <DetailFact label={t("app.tools.auditTab.facts.requestId")} value={requestId} mono /> : null}
                {request ? <DetailFact label={t("app.tools.auditTab.facts.dispatched")} value={request.dispatched === true ? t("app.common.labels.yes") : t("app.common.labels.no")} /> : null}
                {httpStatus !== undefined ? <DetailFact label={t("app.tools.auditTab.facts.httpStatus")} value={String(httpStatus)} mono /> : null}
                {contentType ? <DetailFact label={t("app.tools.auditTab.facts.contentType")} value={contentType} mono /> : null}
                {responseBytes !== undefined ? <DetailFact label={t("app.tools.auditTab.facts.responseSize")} value={t("app.tools.auditTab.bytes", { count: responseBytes })} /> : null}
                {upstreamRequestId ? <DetailFact label={t("app.tools.auditTab.facts.upstreamId")} value={upstreamRequestId} mono /> : null}
                {isRuntimeMcpDeliveryDiagnostic ? (
                  <>
                    <DetailFact label={t("app.tools.auditTab.facts.deliveredServers")} value="0" mono />
                    {permittedNotInstalledConnections.map((connection) => {
                      const connectionId = detailString(connection, "id");
                      const connectionName = detailString(connection, "name") ?? t("app.tools.auditTab.unnamedConnection");
                      return connectionId ? (
                        <div key={connectionId} className="flex gap-2">
                          <span className="shrink-0 text-muted-foreground">{t("app.tools.auditTab.notInstalled")}</span>
                          <Link to={`/apps/${connectionId}/permissions`} className="font-medium text-primary hover:underline">
                            {connectionName}
                          </Link>
                        </div>
                      ) : null;
                    })}
                  </>
                ) : null}
                {argumentsText ? (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">{t("app.tools.auditTab.parameters")}</span>
                    <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground">
                      {argumentsText}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function AuditTab({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const [app, setApp] = useState<string>(ALL);
  const [agent, setAgent] = useState<string>(ALL);
  const [outcome, setOutcome] = useState<string>(ALL);
  const [windowKey, setWindowKey] = useState<ToolAuditWindow>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the search box so each keystroke doesn't fire a server request.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const apps = useQuery({
    queryKey: queryKeys.tools.applications(companyId),
    queryFn: () => toolsApi.listApplications(companyId),
  });
  const agents = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });
  // Map matched rule IDs to their humanized names for the row "why" link.
  const policies = useQuery({
    queryKey: queryKeys.tools.policies(companyId),
    queryFn: () => toolsApi.listPolicies(companyId),
  });
  const ruleNamesById = useMemo(
    () => new Map((policies.data?.policies ?? []).map((p) => [p.id, p.name])),
    [policies.data],
  );

  const filters = {
    app: app === ALL ? undefined : app,
    agent: agent === ALL ? undefined : agent,
    outcome: outcome === ALL ? undefined : outcome,
    window: windowKey,
    search: search || undefined,
  };
  const hasActiveFilters =
    app !== ALL || agent !== ALL || outcome !== ALL || windowKey !== "all" || search.length > 0;

  const activity = useInfiniteQuery({
    queryKey: queryKeys.tools.activity(companyId, {
      app: filters.app,
      agent: filters.agent,
      outcome: filters.outcome,
      window: filters.window,
      search: filters.search,
    }),
    queryFn: ({ pageParam }) =>
      toolsApi.listActivity(companyId, { ...filters, limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const events = useMemo(
    () => activity.data?.pages.flatMap((page) => page.events) ?? [],
    [activity.data],
  );

  const clearFilters = () => {
    setApp(ALL);
    setAgent(ALL);
    setOutcome(ALL);
    setWindowKey("all");
    setSearchInput("");
    setSearch("");
  };

  return (
    <div className="space-y-4">
      <ToolsPageHeader
        title={t("app.common.nouns.activity")}
        description={t("app.tools.auditTab.description")}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={app} onValueChange={setApp}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("app.common.nouns.app")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("app.tools.auditTab.filters.allApps")}</SelectItem>
            {(apps.data?.applications ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AgentSelect
          agents={[{ id: ALL, name: t("app.tools.auditTab.filters.allAgents") }, ...(agents.data ?? [])]}
          value={agent}
          onChange={setAgent}
          triggerClassName="w-40"
        />
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getOutcomeFilters().map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={windowKey} onValueChange={(v) => setWindowKey(v as ToolAuditWindow)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getWindowFilters().map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder={t("app.tools.auditTab.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("app.common.actions.clearFilters")}
          </Button>
        ) : null}
      </div>

      {activity.isLoading ? (
        <LoadingState />
      ) : activity.error ? (
        <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
      ) : events.length === 0 ? (
        hasActiveFilters ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("app.tools.auditTab.noMatchTitle")}</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {t("app.tools.auditTab.noMatchBody")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t("app.common.actions.clearFilters")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("app.tools.auditTab.emptyTitle")}</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {t("app.tools.auditTab.emptyBody")}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <ul className="divide-y divide-border">
              {events.map((event) => (
                <ActivityRow key={event.id} event={event} ruleNamesById={ruleNamesById} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {activity.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => activity.fetchNextPage()}
            disabled={activity.isFetchingNextPage}
          >
            {activity.isFetchingNextPage ? t("app.common.loading") : t("app.common.actions.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
