import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { ToolConnection } from "@paperclipai/shared";
import { AGGREGATOR_NAMES, aggregatorManagementUrl, isAppAggregator } from "@paperclipai/shared/aggregator-apps";
import type { AggregatorAppCatalogEntry } from "@paperclipai/shared/aggregator-app-catalog";
import { toolsApi } from "@/api/tools";
import { useAccountIdentity } from "@/api/companies-query";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AggregatorAppManager({ app, connections, initialConnectionId, onClose }: {
  app: AggregatorAppCatalogEntry; connections: ToolConnection[]; initialConnectionId?: string; onClose: () => void;
}) {
  useUiCopyTranslation();
  const [connectionId, setConnectionId] = useState(initialConnectionId ?? connections[0]?.id ?? "");
  const connection = connections.find(candidate => candidate.id === connectionId);
  const provider = connection?.config?.sourceTemplateKey;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle><Trans i18nKey="app.uiCopy.pagesAppsAggregatorAppManager.message45" components={{ part0: <>{""}{app.name}</> }} /></DialogTitle>
      <DialogDescription><Trans i18nKey="app.uiCopy.pagesAppsAggregatorAppManager.message46" components={{ part0: <>{""}{isAppAggregator(provider) ? AGGREGATOR_NAMES[provider] : translateUiCopy("app.uiCopy.pagesAppsAggregatorAppManager.theProvider")}</> }} /></DialogDescription>
    </DialogHeader>
    {connections.length > 1 ? <div className="space-y-2"><Label htmlFor="manage-aggregator-gateway">{translateUiCopy("app.common.nouns.connection")}</Label>
      <select id="manage-aggregator-gateway" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={connectionId} onChange={event => setConnectionId(event.target.value)}>
        {connections.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
      </select></div> : null}
    {connection ? <AccountObservations key={connection.id} app={app} connection={connection} onClose={onClose} /> : <p role="alert">{translateUiCopy("app.uiCopy.pagesAppsAggregatorAppManager.thisConnectionIsNoLongerAvailable")}</p>}
  </DialogContent></Dialog>;
}

function AccountObservations({ app, connection, onClose }: { app: AggregatorAppCatalogEntry; connection: ToolConnection; onClose: () => void }) {
  useUiCopyTranslation();
  const queries = useQueryClient();
  const { userId, settled } = useAccountIdentity();
  const key = queryKeys.tools.aggregatorApps(connection.id, userId);
  const query = useQuery({ queryKey: key, enabled: settled, queryFn: () => toolsApi.listAggregatorApps(connection.id), refetchInterval: query => query.state.data?.sync.status === "syncing" ? 1500 : false });
  const snapshots = (settled ? query.data?.apps : undefined)?.filter(snapshot => snapshot.appSlug === app.slug) ?? [];
  const accounts = snapshots.flatMap(snapshot => snapshot.accounts.map(account => ({ account, snapshot })));
  const refresh = useMutation({ mutationFn: async () => { const result = await toolsApi.refreshAggregatorApps(connection.id, snapshots.map(snapshot => snapshot.toolkit)); queries.setQueryData(key, result); } });
  const provider = query.data?.provider;
  const name = provider ? AGGREGATOR_NAMES[provider] : "provider";
  const managementUrl = provider ? aggregatorManagementUrl(provider, accounts[0]?.account.managementUrl ?? (typeof connection.config?.managementUrl === "string" ? connection.config?.managementUrl : null)) : null;
  return <>
    {query.isError || refresh.isError || query.data?.sync.status === "error" ? <p role="alert" className="text-sm text-destructive"><Trans i18nKey="app.uiCopy.pagesAppsAggregatorAppManager.message47" components={{ part0: <>{""}{name}</> }} /></p> : null}
    {query.isLoading ? <p role="status" className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.pagesAppsAggregatorAppManager.loadingAccounts")}</p> : accounts.length ? <div className="divide-y divide-border">
      {accounts.map(({ account, snapshot }) => <div key={`${snapshot.toolkit}:${account.id}`} className="py-3">
        <p className="text-sm font-medium">{account.alias || translateUiCopy("app.uiCopy.pagesAppsAggregatorAppManager.value0Account", { value0: String(app.name) })}</p>
        <p className="text-xs text-muted-foreground">{snapshot.freshness === "stale" || snapshot.errorAt || Date.now() - new Date(snapshot.checkedAt).getTime() > 5 * 60_000 || account.status === "UNVERIFIED" ? translateUiCopy("app.apps.slackToolSettings.notVerified") : account.status === "ACTIVE" ? translateUiCopy("app.common.states.connected") : account.status === "INITIATED" ? translateUiCopy("app.connections.remoteMcpConnectionSetup.waitingForSignIn") : translateUiCopy("app.uiCopy.pagesAppsAggregatorAppManager.needsSignIn")}</p>
      </div>)}
    </div> : <p className="text-sm text-muted-foreground">{query.data?.discovery.message ?? translateUiCopy("app.uiCopy.pagesAppsAggregatorAppManager.noConnectedValue0Accounts", { value0: String(app.name) })}</p>}
    <p className="text-xs text-muted-foreground"><Trans i18nKey="app.uiCopy.pagesAppsAggregatorAppManager.message48" components={{ part0: <Link to={`/apps/${connection.id}/permissions`} onClick={onClose} className="underline underline-offset-2">“{connection.name}”</Link> }} /></p>
    <DialogFooter className="sm:justify-between"><Button variant="ghost" onClick={onClose}>{translateUiCopy("app.common.actions.close")}</Button><div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" disabled={!settled || refresh.isPending || query.data?.discovery.availability !== "available"} onClick={() => refresh.mutate()}>{translateUiCopy("app.common.actions.refresh")}</Button>
      {managementUrl ? <Button asChild><a href={managementUrl} target="_blank" rel="noopener noreferrer">{translateUiCopy("app.uiCopy.pagesAppsAggregatorAppManager.openIn")} {name}<ExternalLink className="size-4" /></a></Button> : null}
    </div></DialogFooter>
  </>;
}
