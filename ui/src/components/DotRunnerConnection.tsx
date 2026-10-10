import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "./ui/button";
import { buildDotSetupPrompt } from "../lib/dot-setup-prompt";
import { AgentSetupPrompt } from "./AgentSetupPrompt";

interface Connection {
  enabled: boolean;
  resourceUrl: string | null;
  binding: { id: string; status: string; connected: boolean; subscriptionVerified: boolean; hasPendingChallenge: boolean;
    assignment?: { status: string; attentionRequired: boolean } | null } | null;
}

/** Pairing codes stay in component memory and expire; never save them in config. */
export function DotRunnerConnection({ companyId, agentId, bindingId, onBinding }: {
  companyId?: string; agentId?: string; bindingId?: string; onBinding: (id: string) => void;
}) {
  useUiCopyTranslation();
  const client = useQueryClient();
  const [pairing, setPairing] = useState<{ pairingCode: string; expiresAt: string } | null>(null);
  const path = `/companies/${companyId}/agents/${agentId}/dot-binding`;
  const key = ["dot-binding", companyId, agentId];
  const state = useQuery({ queryKey: key, enabled: !!companyId && !!agentId,
    queryFn: () => api.get<Connection>(path),
    refetchInterval: query => query.state.data?.binding?.status === "pairing" ||
      (query.state.data?.binding?.connected && !query.state.data.binding.subscriptionVerified) ||
      query.state.data?.binding?.hasPendingChallenge || query.state.data?.binding?.assignment ? 5000 : false });
  const pair = useMutation({ mutationFn: () => api.post<{ bindingId: string; pairingCode: string; expiresAt: string }>(path, {}),
    onSuccess: result => { setPairing(result); onBinding(result.bindingId); void client.invalidateQueries({ queryKey: key }); } });
  const test = useMutation({ mutationFn: () => api.post(path + "/event-test", {}),
    onSuccess: () => { void client.invalidateQueries({ queryKey: key }); } });
  const revoke = useMutation({ mutationFn: () => api.delete(path),
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<Connection>(key, previous => previous ? { ...previous, binding: null } : previous);
      setPairing(null); onBinding("");
      await client.invalidateQueries({ queryKey: key });
    } });
  useEffect(() => {
    if (!pairing) return;
    const timer = window.setTimeout(() => setPairing(null), Math.max(0, Date.parse(pairing.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [pairing]);
  const existingBindingId = state.data?.binding?.id;
  useEffect(() => {
    if (existingBindingId && existingBindingId !== bindingId && !revoke.isPending) onBinding(existingBindingId);
  }, [existingBindingId, bindingId, onBinding, revoke.isPending]);
  if (!agentId) return <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDotRunnerConnection.saveTheAgentThenReturnHereToPairYour")}</p>;
  const error = state.error ?? pair.error ?? test.error ?? revoke.error;
  const b = state.data?.binding;
  const setupPrompt = pairing && state.data?.resourceUrl && companyId && agentId
    ? buildDotSetupPrompt({ companyId, agentId, resourceUrl: state.data.resourceUrl, ...pairing })
    : "";
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDotRunnerConnection.dotManagesItsModelAndExternalToolsPaperclipSupplies")}</p>
    {state.data && !state.data.enabled && <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDotRunnerConnection.enableOpenAIDotAndAssistantConnectionsMCPInExperimental")}</p>}
    {state.data?.resourceUrl && <p className="text-sm break-all"><Trans i18nKey="app.uiCopy.componentsDotRunnerConnection.message7" components={{ part0: <code>{state.data.resourceUrl}</code> }} /></p>}
    {b && <p className="text-sm"><Trans i18nKey="app.uiCopy.componentsDotRunnerConnection.message8" components={{ part0: <>{""}{translateUiCopy(`app.uiCopy.componentsDotRunnerConnection.bindingStatus.${b.status}`, { defaultValue: b.status })}</>, part1: <>{""}{b.subscriptionVerified ? translateUiCopy("app.uiCopy.componentsDotRunnerConnection.verified") : translateUiCopy("app.pipelines.pipelines.add.required")}</> }} /></p>}
    {b?.assignment && <p className="text-sm"><Trans i18nKey="app.uiCopy.componentsDotRunnerConnection.message9" components={{ part0: <>{""}{b.assignment.status === "offered" ? translateUiCopy("app.uiCopy.componentsDotRunnerConnection.waitingForDotToAccept") : translateUiCopy("app.uiCopy.componentsDotRunnerConnection.acceptedByDot")}</> }} /></p>}
    {b?.assignment?.attentionRequired && <p className="text-sm text-destructive" role="alert">{translateUiCopy("app.uiCopy.componentsDotRunnerConnection.dotHasNotReportedUsefulActivityFor15Minutes")}</p>}
    {pairing && setupPrompt && b?.status === "pairing" && <div className="space-y-2">
      <AgentSetupPrompt
        prompt={setupPrompt}
        label={translateUiCopy("app.uiCopy.componentsDotRunnerConnection.setUpWithDot")}
        agent={{ name: "Dot", src: "/brands/adapters/openai-dot.svg" }}
        title={translateUiCopy("app.uiCopy.componentsDotRunnerConnection.connectYourDot")}
        description={translateUiCopy("app.uiCopy.componentsDotRunnerConnection.pasteIntoYourDotToConnectThisAgent")}
        side="bottom"
      />
      <p className="text-xs text-muted-foreground"><Trans i18nKey="app.uiCopy.componentsDotRunnerConnection.message10" components={{ part0: <>{""}{new Date(pairing.expiresAt).toLocaleTimeString()}</> }} /></p>
    </div>}
    {!pairing && b?.status === "pairing" && <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDotRunnerConnection.revokeThePendingConnectionAndPairAgainToGenerate")}</p>}
    <div className="flex flex-wrap items-center gap-2">
      {!b && <Button type="button" variant="outline" disabled={!state.data?.enabled || !state.data?.resourceUrl || pair.isPending} onClick={() => pair.mutate()}>{translateUiCopy("app.upstreamOct08.pairDot")}</Button>}
      {b?.subscriptionVerified && <Button type="button" variant="outline" disabled={test.isPending || b.hasPendingChallenge} onClick={() => test.mutate()}>{translateUiCopy("app.uiCopy.componentsDotRunnerConnection.testEventDelivery")}</Button>}
      <Button type="button" variant="outline" onClick={() => { void state.refetch(); }}>{translateUiCopy("app.uiCopy.componentsDotRunnerConnection.refreshConnection")}</Button>
      {b && <Button type="button" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate()}>{translateUiCopy("app.uiCopy.componentsDotRunnerConnection.revokeConnection")}</Button>}
    </div>
    {b?.hasPendingChallenge && <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDotRunnerConnection.waitingForDotToReadAndConfirmTheHarmless")}</p>}
    {error && <p className="text-sm text-destructive" role="alert">{error instanceof Error ? error.message : translateUiCopy("app.apps.chatEndpointSetup.connectionFailed")}</p>}
  </div>;
}
