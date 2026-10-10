import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { connectionInstructionsConfig, type ToolConnection } from "@paperclipai/shared";
import { toolsApi } from "@/api/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineBanner } from "@/components/InlineBanner";

export function HonchoWorkspaceSettings({ connection, canConfigure }: { connection: ToolConnection; canConfigure: boolean }) {
  useUiCopyTranslation();
  const id = useId();
  const client = useQueryClient();
  const connectionConfig = connectionInstructionsConfig(connection);
  const config = (connectionConfig.methodConfig ?? {}) as Record<string, unknown>;
  const saved = typeof config.workspaceId === "string" ? config.workspaceId : "";
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved;
  const mutation = useMutation({
    mutationFn: () => toolsApi.updateConnection(connection.id, { config: { ...connectionConfig, methodConfig: { ...config, workspaceId: value.trim() } } }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["tools"] }); setDraft(null); },
  });
  return <section className="space-y-3" aria-label={translateUiCopy("app.uiCopy.featuresConnectionsHonchoWorkspaceSettings.honchoWorkspace")}>
    <label htmlFor={id} className="text-sm font-medium">{translateUiCopy("app.uiCopy.featuresConnectionsHonchoWorkspaceSettings.honchoWorkspace")}</label>
    <Input id={id} value={value} maxLength={512} disabled={!canConfigure || mutation.isPending} placeholder={translateUiCopy("app.workspaces.executionWorkspaceDetail.context.workspaceId")} onChange={(event) => setDraft(event.target.value)} />
    {!value.trim() && <InlineBanner tone="warning">{translateUiCopy("app.uiCopy.featuresConnectionsHonchoWorkspaceSettings.enterAWorkspaceToIncludeHonchoInstructionsExistingTools")}</InlineBanner>}
    {mutation.isError && <div role="alert"><InlineBanner tone="danger">{mutation.error.message}</InlineBanner></div>}
    {draft !== null && draft !== saved && <div className="flex items-center justify-between">
      <Button variant="ghost" disabled={mutation.isPending} onClick={() => { setDraft(null); mutation.reset(); }}>{translateUiCopy("app.common.actions.cancel")}</Button>
      <Button disabled={!canConfigure || mutation.isPending || !value.trim()} onClick={() => mutation.mutate()}>{mutation.isPending ? translateUiCopy("app.common.actions.saving") : translateUiCopy("app.uiCopy.featuresConnectionsHonchoWorkspaceSettings.saveWorkspace")}</Button>
    </div>}
  </section>;
}
