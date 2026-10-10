import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toolsApi } from "@/api/tools";
import { useAccountIdentity } from "@/api/companies-query";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ToolConnection } from "@paperclipai/shared";

export function ArcadeDiscoverySetup({ connection, onClose }: { connection: ToolConnection; onClose: () => void }) {
  useUiCopyTranslation();
  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState("");
  const queries = useQueryClient();
  const { userId: viewingUserId, settled } = useAccountIdentity();
  const save = useMutation({ mutationFn: async () => {
      const result = await toolsApi.configureArcadeDiscovery(connection.id, { apiKey: apiKey.trim(), userId: userId.trim() });
      queries.setQueryData(queryKeys.tools.aggregatorApps(connection.id, viewingUserId), result);
    },
    onSuccess: onClose,
  });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>{translateUiCopy("app.uiCopy.pagesAppsArcadeDiscoverySetup.syncArcadeAccounts")}</DialogTitle>
      <DialogDescription><Trans i18nKey="app.uiCopy.pagesAppsArcadeDiscoverySetup.message49" components={{ part0: <>{""}{connection.name}</> }} /></DialogDescription>
    </DialogHeader>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
      <div className="space-y-2"><Label htmlFor="arcade-discovery-key">{translateUiCopy("app.uiCopy.pagesAppsArcadeDiscoverySetup.projectAPIKey")}</Label>
        <p className="text-xs text-muted-foreground"><Trans i18nKey="app.uiCopy.pagesAppsArcadeDiscoverySetup.message50" components={{ part0: <a className="underline" href="https://app.arcade.dev" target="_blank" rel="noopener noreferrer">Arcade</a> }} /></p>
        <Input id="arcade-discovery-key" type="password" autoComplete="off" required value={apiKey} onChange={event => setApiKey(event.target.value)} />
      </div>
      <div className="space-y-2"><Label htmlFor="arcade-discovery-user">{translateUiCopy("app.uiCopy.pagesAppsArcadeDiscoverySetup.arcadeUserID")}</Label>
        <p className="text-xs text-muted-foreground">{translateUiCopy("app.uiCopy.pagesAppsArcadeDiscoverySetup.useTheEndUserIDConfiguredForThisGateway")}</p>
        <Input id="arcade-discovery-user" autoComplete="off" required value={userId} onChange={event => setUserId(event.target.value)} />
      </div>
      {save.isError ? <p role="alert" className="text-sm text-destructive">{save.error instanceof Error ? save.error.message : translateUiCopy("app.uiCopy.pagesAppsArcadeDiscoverySetup.couldnTSaveAccountSyncTryAgain")}</p> : null}
      <DialogFooter className="sm:justify-between"><Button type="button" variant="ghost" disabled={save.isPending} onClick={onClose}>{translateUiCopy("app.common.actions.cancel")}</Button>
        <Button type="submit" disabled={!settled || save.isPending || !apiKey.trim() || !userId.trim()}>{save.isPending ? translateUiCopy("app.common.actions.saving") : translateUiCopy("app.uiCopy.pagesAppsArcadeDiscoverySetup.saveAndSync")}</Button>
      </DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
