import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DECISION_MODELS, type DecisionConnectionChoice, type DecisionModelSettings, type DecisionProvider, type DecisionResult, type UpdateDecisionModel } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { decisionModelsApi } from "@/api/decision-models";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ToggleField } from "@/components/agent-config-primitives";
import { ConnectionChoiceList } from "@/features/connections/ConnectionChoiceList";
import { ConnectionSetupFlow } from "@/features/connections/ConnectionSetupFlow";
import { AppLogo } from "@/pages/apps/AppLogo";

const failureMessages: Record<string, string> = {
  get not_configured() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.chooseAndSaveAConnectionFirst"); }, get disabled() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.enableAndSaveDecisionsBeforeRunningATest"); },
  get connection_unavailable() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.theConnectionIsUnavailableReconnectItAndTryAgain"); },
  get access_denied() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.thisConnectionIsNotSharedWithYouReviewIts"); },
  get incompatible_connection() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.chooseASupportedOpenAIOrOpenRouterAPIConnection"); },
  get budget_blocked() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.theCompanyOrTaskBudgetPreventsThisRequestReview"); },
  get provider_auth_failed() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.theProviderRejectedTheConnectionReconnectItAndTry"); },
  get provider_rate_limited() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.theProviderIsRateLimitedTryAgainLater"); },
  get timeout() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.theProviderDidNotRespondInTimeBillingIs"); },
  get refused() { return translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.theModelDeclinedTheTestReviewTheConnectionAnd"); },
};
export function DecisionModelSettingsView({ settings, choices, saving, testing, error, result, newlyConnectedId, onSave, onTest, onAdd }: {
  settings: DecisionModelSettings; choices: DecisionConnectionChoice[]; saving?: boolean; testing?: boolean;
  error?: string | null; result?: DecisionResult | null; newlyConnectedId?: string | null;
  onSave: (value: UpdateDecisionModel) => void; onTest: () => void; onAdd: () => void;
}) {
  useUiCopyTranslation();
  const [draft, setDraft] = useState<Required<UpdateDecisionModel>>(settings);
  const appliedConnection = useRef<string | null>(null);
  useEffect(() => { setDraft(settings); }, [settings.companyId, settings.connectionId, settings.grantId, settings.enabled, settings.allowBackground]);
  useEffect(() => {
    if (!newlyConnectedId) { appliedConnection.current = null; return; }
    if (appliedConnection.current === newlyConnectedId) return;
    const connection = choices.find(row => row.id === newlyConnectedId);
    if (connection) {
      appliedConnection.current = newlyConnectedId;
      setDraft(value => ({ ...value, connectionId: connection.id, grantId: connection.grantId, enabled: value.connectionId ? value.enabled : true }));
    }
  }, [newlyConnectedId, choices]);
  const selected = choices.find(row => row.grantId === draft.grantId);
  const dirty = draft.enabled !== settings.enabled || draft.allowBackground !== settings.allowBackground || draft.grantId !== settings.grantId;
  const unavailable = result && result.status !== "succeeded" ? failureMessages[result.status === "unavailable" ? result.reason : result.errorCode] ?? translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.theDecisionCouldNotBeCompletedReviewItsEntry") : null;
  return <section aria-labelledby="decision-model-heading" className="max-w-2xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="decision-model-heading" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.decisionModel")}</h2>
      <Link to="/activity/costs?tab=decisions" className="text-sm underline underline-offset-4">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.viewUsage")}</Link>
    </div>
    <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.chooseTheSharedConnectionPaperclipUsesForOptionalDecision")}</p>
    <ConnectionChoiceList selectedId={draft.grantId ?? undefined} disabled={saving || testing}
      choices={choices.map(row => ({ id: row.grantId, name: row.name,
        description: `${row.decisionModel} · ${row.status === "connected" ? translateUiCopy("app.common.states.connected") : translateUiCopy("app.common.states.needsAttention")}`,
        icon: <AppLogo name={row.provider === "openai" ? "OpenAI" : "OpenRouter"} brandKey={row.provider} size={24} />,
      }))}
      onSelect={grantId => { const row = choices.find(choice => choice.grantId === grantId)!; setDraft(value => ({ ...value, connectionId: row.id, grantId, enabled: value.connectionId ? value.enabled : true })); }} />
    {choices.length === 0 && <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.addASharedOpenAIOrOpenRouterAPIConnectionTo")}</p>}
    {draft.connectionId && !selected && <p role="status" className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.theSavedConnectionIsUnavailableToYouDisableDecisions")}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" onClick={onAdd} disabled={saving || testing}>{translateUiCopy("app.apps.browse.addConnection")}</Button>
      {selected && <Link to={`/apps/${selected.id}/permissions`} className="text-sm underline underline-offset-4">{selected.status === "connected" ? translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.manageConnection") : translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.reconnectConnection")}</Link>}
    </div>
    {draft.connectionId && <fieldset disabled={saving || testing} className="space-y-4">
      <ToggleField label={translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.enableDecisions")} checked={draft.enabled} onChange={enabled => setDraft(value => ({ ...value, enabled }))} />
      <div className="space-y-2">
        <ToggleField label={translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.allowCompanySponsoredBackgroundDecisions")} checked={draft.allowBackground} onChange={allowBackground => setDraft(value => ({ ...value, allowBackground }))} />
        <p className="text-xs text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.backgroundFeaturesCanChargeThisConnectionWithoutAResponsible")}</p>
      </div>
    </fieldset>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!dirty && unavailable && <p role="alert" className="text-sm text-destructive">{unavailable}</p>}
    {!dirty && result?.status === "succeeded" && <div role="status" className="space-y-2 text-sm">
      <p className="font-medium">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.decisionModelIsWorking")}</p>
      <dl className="grid grid-cols-2 gap-2">{Object.entries(result.answers).map(([name, answer]) => <div key={name}>
        <dt className="text-muted-foreground">{name === "billing" ? translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.billingProblem") : name === "team" ? translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.assignedTeam") : translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.disruptionScore")}</dt>
        <dd className="font-mono">{answer.type === "boolean" ? `${Math.round(answer.probability * 100)}%` : answer.type === "choice" ? answer.choice : `${answer.score.toFixed(2)} / 2`}</dd>
      </div>)}</dl>
      <p className="text-xs text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.usageWasRecordedTestAnswersAreNotSaved")}</p>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <Button variant="outline" size="sm" disabled={!settings.enabled || dirty || saving || testing || selected?.status !== "connected"} onClick={onTest}>{testing ? translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.runningTest") : translateUiCopy("app.shell.runtimeTestCard.runTest")}</Button>
        <p className="text-xs text-muted-foreground">{dirty ? translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.saveChangesBeforeTesting") : translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.runsASmallSampleWithAnAPICharge")}</p>
      </div>
      {dirty && <Button onClick={() => onSave(draft)} disabled={saving || testing || (draft.enabled && selected?.status !== "connected")}>{saving ? translateUiCopy("app.common.actions.saving") : translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.saveDecisionModel")}</Button>}
    </div>
  </section>;
}

export function DecisionModelSettingsSection({ companyId }: { companyId: string }) {
  useUiCopyTranslation();
  const client = useQueryClient();
  const key = ["decision-model", companyId];
  const query = useQuery({ queryKey: key, queryFn: () => decisionModelsApi.settings(companyId) });
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState<DecisionProvider | null>(null);
  const [newlyConnectedId, setNewlyConnectedId] = useState<string | null>(null);
  const settingsRevision = JSON.stringify(query.data?.settings ?? { companyId });
  const test = useMutation({ mutationFn: (_revision: string) => decisionModelsApi.test(companyId), onSettled: () => { void client.invalidateQueries({ queryKey: ["decision-history", companyId] }); void client.invalidateQueries({ predicate: q => String(q.queryKey[0]).includes("cost") }); } });
  const resetTest = test.reset;
  useEffect(() => { resetTest(); }, [settingsRevision, resetTest]);
  const save = useMutation({ mutationFn: (settings: UpdateDecisionModel) => decisionModelsApi.update(companyId, settings), onSuccess: settings => {
    setNewlyConnectedId(null); test.reset(); client.setQueryData(key, { ...query.data, settings });
  } });
  if (query.isPending) return <p className="text-sm text-muted-foreground">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.loadingDecisionModel")}</p>;
  if (query.error) return <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.couldNotLoadDecisionSettings")}</p><Button variant="outline" onClick={() => void query.refetch()}>{translateUiCopy("app.common.actions.tryAgain")}</Button></div>;
  if (!query.data?.canManage || !query.data.settings) return null;
  return <>
    <DecisionModelSettingsView settings={query.data.settings} choices={query.data.choices} saving={save.isPending} testing={test.isPending}
      error={save.error?.message ?? (test.variables === settingsRevision ? test.error?.message : undefined)}
      result={test.variables === settingsRevision ? test.data : null} newlyConnectedId={newlyConnectedId}
      onSave={value => save.mutate(value)} onTest={() => test.mutate(settingsRevision)} onAdd={() => { setProvider(null); setAdding(true); }} />
    <Dialog open={adding} onOpenChange={setAdding}>
      <DialogContent className="sm:max-w-2xl max-h-(--sz-85vh) overflow-y-auto">
        <DialogHeader><DialogTitle>{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.addADecisionConnection")}</DialogTitle><DialogDescription>{translateUiCopy("app.uiCopy.componentsDecisionModelsDecisionModelSettings.useASharedAPIConnectionForCompanyDecisions")}</DialogDescription></DialogHeader>
        {provider ? <ConnectionSetupFlow host="dialog" serviceSlug={provider} forceNewConnection
          aiConnection={{ provider, method: "api_key", mode: "shared" }} requiredAiOwnership="shared"
          onCancel={() => setAdding(false)} onComplete={async result => {
            const refreshed = await query.refetch();
            if ("connectionId" in result && result.connectionId && refreshed.data?.choices.some(row => row.id === result.connectionId)) setNewlyConnectedId(result.connectionId);
            setAdding(false);
          }} /> : <ConnectionChoiceList choices={(Object.keys(DECISION_MODELS) as DecisionProvider[]).map(id => ({ id,
            name: id === "openai" ? "OpenAI" : "OpenRouter", description: DECISION_MODELS[id].name,
            icon: <AppLogo name={id === "openai" ? "OpenAI" : "OpenRouter"} brandKey={id} size={24} />,
          }))} onSelect={id => setProvider(id as DecisionProvider)} />}
      </DialogContent>
    </Dialog>
  </>;
}
