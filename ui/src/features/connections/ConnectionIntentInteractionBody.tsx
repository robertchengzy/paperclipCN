import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Plug,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { AiAuthMethod, ConnectionIntentInteraction } from "@paperclipai/shared";
import { connectionIntentsApi } from "@/api/connection-intents";
import { aiConnectionsApi } from "@/api/ai-connections";
import { agentsApi } from "@/api/agents";
import { AiConnectionCredentialStep } from "@/components/ai-connections/AiConnectionCredentialStep";
import { defaultAiConnectionName } from "@/components/ai-connections/model";
import { AppLogo } from "@/pages/apps/AppLogo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ConnectionSetupFlow,
  type ConnectionSetupCompletion,
  type ConnectionSetupFlowProps,
} from "./ConnectionSetupFlow";

export interface ConnectionIntentInteractionBodyProps {
  interaction: ConnectionIntentInteraction;
  currentUserId?: string | null;
  addresseeLabel: string;
  addresseeName?: string;
  renderSetup?: (props: ConnectionSetupFlowProps) => ReactNode;
}

export function ConnectionIntentInteractionBody({
  interaction,
  currentUserId,
  addresseeLabel,
  addresseeName,
  renderSetup,
}: ConnectionIntentInteractionBodyProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [adoptionConnectionId, setAdoptionConnectionId] = useState<string | null>(null);
  const focusTargetRef = useRef<HTMLDivElement>(null);
  const setupGeneration = useRef(0);
  const generation = setupGeneration.current;
  const closeSetup = () => {
    setupGeneration.current += 1;
    selectAiAccountMutation.reset();
    setOpen(false);
  };
  const queryClient = useQueryClient();
  const isAddressee = Boolean(
    currentUserId && interaction.addresseeUserId === currentUserId,
  );
  const isPending = interaction.status === "pending";
  const isAi = interaction.payload.purpose === "ai";
  const focusTargetId = `connection-intent-focus-target-${interaction.id}`;

  const invalidateTask = async (
    updatedInteraction?: ConnectionIntentInteraction,
  ) => {
    if (updatedInteraction) {
      queryClient.setQueriesData<ConnectionIntentInteraction[]>(
        { queryKey: ["issues", "interactions"] },
        (current) =>
          current?.map((candidate) =>
            candidate.id === updatedInteraction.id
              ? updatedInteraction
              : candidate,
          ),
      );
    }
    await Promise.all([
      // Task routes may key these caches by either UUID or human identifier.
      // Prefix invalidation reaches the mounted task without requiring that
      // routing identity to leak into the reusable interaction card.
      queryClient.invalidateQueries({ queryKey: ["issues", "interactions"] }),
      queryClient.invalidateQueries({ queryKey: ["issues", "detail"] }),
    ]);
  };
  const returnFocusToCard = () => {
    // Completing an intent can move it from the composer takeover to the
    // durable timeline. That replaces this component instance, so its ref can
    // be cleared before focus restoration runs. Retry for a few paint frames
    // and resolve the stable interaction-specific target from the new host.
    const focusCurrentTarget = (remainingAttempts: number) => {
      window.requestAnimationFrame(() => {
        const target =
          document.getElementById(focusTargetId) ?? focusTargetRef.current;
        target?.focus();
        if (remainingAttempts > 1) {
          focusCurrentTarget(remainingAttempts - 1);
        }
      });
    };
    focusCurrentTarget(3);
  };

  const setupQuery = useQuery({
    queryKey: ["connection-intent", interaction.id, "setup-options"],
    queryFn: () => connectionIntentsApi.setupOptions(interaction.id),
    enabled: isAddressee && isPending,
    refetchInterval: isPending && (open || interaction.payload.phase === "authorizing") ? 2_000 : false,
  });

  useEffect(() => {
    const current = setupQuery.data?.interaction;
    if (current && current.status !== "pending" && isPending) {
      void invalidateTask(current);
      setOpen(false);
      returnFocusToCard();
    }
  }, [setupQuery.data?.interaction, isPending]);

  const completeMutation = useMutation({
    mutationFn: (connectionId: string) =>
      connectionIntentsApi.complete(interaction.id, connectionId),
    onSuccess: async (updatedInteraction) => {
      await invalidateTask(updatedInteraction);
      setOpen(false);
      returnFocusToCard();
    },
  });
  const adoptMutation = useMutation({
    mutationFn: (connectionId: string) => agentsApi.adoptAiConnection(
      interaction.payload.requestingAgentId, interaction.id, connectionId, interaction.companyId,
    ),
    onSuccess: async (updatedInteraction) => {
      await invalidateTask(updatedInteraction);
      setAdoptionConnectionId(null);
      setOpen(false);
      returnFocusToCard();
    },
  });
  const declineMutation = useMutation({
    mutationFn: () => connectionIntentsApi.decline(interaction.id),
    onSuccess: async (updatedInteraction) => {
      await invalidateTask(updatedInteraction);
      setOpen(false);
      returnFocusToCard();
    },
  });
  const phaseMutation = useMutation({
    mutationFn: (phase: ConnectionIntentInteraction["payload"]["phase"]) =>
      connectionIntentsApi.setPhase(interaction.id, phase),
    onSuccess: invalidateTask,
  });
  const mutatePhase = phaseMutation.mutate;
  const handlePhaseChange = useCallback(
    (phase: ConnectionIntentInteraction["payload"]["phase"]) =>
      mutatePhase(phase),
    [mutatePhase],
  );

  const finishNewConnection = async (completion: ConnectionSetupCompletion) => {
    // A completed credential save survives cancellation, but an abandoned form
    // must not accept the task request (even if a new form has since opened).
    if (isAi && generation !== setupGeneration.current) {
      await setupQuery.refetch();
      return;
    }
    if (completion.resolvedByCallback) {
      // A browser message cannot establish authorization. Read the durable result.
      const verified = await setupQuery.refetch();
      if (verified.data?.interaction.status !== "accepted") return;
      await invalidateTask(verified.data.interaction);
      setOpen(false);
      returnFocusToCard();
      return;
    }
    if (setupQuery.data?.aiConnectionRequiresAdoption) {
      setAdoptionConnectionId(completion.connectionId);
    } else {
      completeMutation.mutate(completion.connectionId);
    }
  };

  const selectAiAccountMutation = useMutation({
    mutationFn: async (result: { connectionId: string; grantId: string; method: AiAuthMethod; generation: number }) => {
      if (result.generation !== setupGeneration.current) {
        await setupQuery.refetch();
        return;
      }
      const binding = setupQuery.data?.aiConnection;
      const previous = setupQuery.data?.aiRepair?.connection;
      if (binding && previous && result.connectionId !== previous.id) {
        if (binding.mode === "responsible_user") {
          await aiConnectionsApi.setDefault(interaction.companyId, result.grantId);
        } else {
          const agent = await agentsApi.get(interaction.payload.requestingAgentId, interaction.companyId);
          const current = agent.runtimeConfig.aiConnection;
          if (!current || current.mode === "responsible_user" || current.connectionId !== previous.id || current.grantId !== previous.grantId) {
            throw new Error("The agent’s AI connection changed. Reload the task and try again.");
          }
          if (result.generation !== setupGeneration.current) return;
          await agentsApi.update(agent.id, {
            runtimeConfig: { ...agent.runtimeConfig, aiConnection: { ...binding, method: result.method, connectionId: result.connectionId, grantId: result.grantId } },
          }, interaction.companyId);
        }
        await queryClient.invalidateQueries({ queryKey: ["ai-connections", interaction.companyId] });
      }
      if (result.generation === setupGeneration.current) await finishNewConnection(result);
    },
  });

  const setupProps: ConnectionSetupFlowProps | null = setupQuery.data ? {
    host: "dialog",
    upstreamServiceName: interaction.payload.upstreamService?.name,
    serviceSlug: interaction.payload.serviceSlug.startsWith("connection:") ? undefined : interaction.payload.serviceSlug,
    configuredConnection: interaction.payload.serviceSlug.startsWith("connection:") ? setupQuery.data.existingConnections[0] : undefined,
    requestedAgentId: setupQuery.data.requestedAgentId,
    aiConnection: setupQuery.data.aiConnection,
    interactionId: interaction.id,
    existingConnections: setupQuery.data.existingConnections,
    onUseExisting: async (connectionId) => { await completeMutation.mutateAsync(connectionId); },
    onComplete: (completion) => { void finishNewConnection(completion); },
    onOAuthDeclined: () => declineMutation.mutate(),
    onPhaseChange: handlePhaseChange,
    onCancel: () => { closeSetup(); returnFocusToCard(); },
  } : null;

  const resultOutcome = interaction.result?.outcome;
  const status =
    interaction.status === "accepted"
      ? {
          icon: CheckCircle2,
          title: interaction.payload.upstreamService ? t("app.connections.connectionIntentInteractionBody.externalProviderConnected") : t("app.connections.connectionIntentInteractionBody.serviceConnected", { service: interaction.payload.serviceName }),
          body: interaction.payload.upstreamService ? t("app.connections.connectionIntentInteractionBody.upstreamServiceAuthorize", { agent: interaction.payload.requestingAgentName, service: interaction.payload.upstreamService.name }) : isAi ? t("app.connections.connectionIntentInteractionBody.agentCanUse") : t("app.connections.connectionIntentInteractionBody.agentCanUseOnContinuation", { agent: interaction.payload.requestingAgentName }),
        }
      : interaction.status === "rejected"
        ? {
            icon: XCircle,
            title: t("app.connections.connectionIntentInteractionBody.declined"),
            body: isAi ? t("app.connections.connectionIntentInteractionBody.stillNeedsAi") : t("app.connections.connectionIntentInteractionBody.agentNotified", { agent: interaction.payload.requestingAgentName }),
          }
        : interaction.status === "expired"
          ? {
              icon: Clock,
              title:
                resultOutcome === "superseded"
                  ? t("app.connections.connectionIntentInteractionBody.superseded")
                  : t("app.connections.connectionIntentInteractionBody.expired"),
              body:
                resultOutcome === "superseded"
                  ? t("app.connections.connectionIntentInteractionBody.supersededBody")
                  : t("app.connections.connectionIntentInteractionBody.expiredBody"),
            }
          : null;
  const StatusIcon = status?.icon;

  if (status && StatusIcon) {
    return (
      <div
        id={focusTargetId}
        ref={focusTargetRef}
        tabIndex={-1}
        data-testid="connection-intent-focus-target"
      >
        <div
          className="flex items-start gap-3"
          data-testid="connection-intent-terminal"
        >
          <StatusIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">{status.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{status.body}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAddressee) {
    return (
      <div
        id={focusTargetId}
        ref={focusTargetRef}
        tabIndex={-1}
        data-testid="connection-intent-focus-target"
      >
        <div
          className="flex items-start gap-3"
          data-testid="connection-intent-waiting"
        >
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">
              {t("app.connections.connectionIntentInteractionBody.waitingFor", { name: addresseeLabel })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("app.connections.connectionIntentInteractionBody.onlyAddressee")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const needsRetry = interaction.payload.phase === "needs_retry";
  const authorizing = interaction.payload.phase === "authorizing";

  const repair = setupQuery.data?.aiRepair;
  const selectedReady = repair && setupQuery.data?.existingConnections.some((connection) => connection.id === repair.connection.id);
  const readyForAdoption = setupQuery.data?.aiConnectionRequiresAdoption
    ? adoptionConnectionId ?? (selectedReady ? repair.connection.id : null)
    : null;
  const setupContent = setupQuery.isLoading ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("app.connections.connectionIntentInteractionBody.loadingOptions")}
                </div>
              ) : setupQuery.isError ? (
                <div className="py-8 text-center">
                  <p className="font-medium text-foreground">
                    {t("app.connections.connectionIntentInteractionBody.loadFailed")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {setupQuery.error instanceof Error
                      ? setupQuery.error.message
                      : t("app.common.messages.tryAgain")}
                  </p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => setupQuery.refetch()}
                  >
                    {t("app.common.actions.tryAgain")}
                  </Button>
                </div>
              ) : setupProps ? (
                renderSetup ? renderSetup(setupProps) : <ConnectionSetupFlow {...setupProps} />
              ) : null;
  const aiConnection = setupQuery.data?.aiConnection;
  const inlineContent = setupQuery.isLoading || setupQuery.isError ? setupContent
    : readyForAdoption ? <div className="space-y-3">
        <p className="text-sm">
          Use Connections for {interaction.payload.requestingAgentName}? This replaces the agent’s existing authentication
          with the responsible person’s {interaction.payload.serviceName} connection. The model stays the same.
        </p>
        <Button disabled={adoptMutation.isPending} onClick={() => adoptMutation.mutate(readyForAdoption)}>
          {adoptMutation.isPending ? "Checking connection…" : "Use connection and continue"}
        </Button>
      </div>
    : selectedReady ? <div className="space-y-3">
        <p className="text-sm">{t("app.connections.connectionIntentInteractionBody.isReady", { name: repair.connection.name })}</p>
        <Button disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(repair.connection.id)}>
          {completeMutation.isPending ? t("app.connections.connectionIntentInteractionBody.continuing") : t("app.connections.connectionIntentInteractionBody.continueTask")}
        </Button>
      </div>
    : repair ? repair.canReconnect ? <AiConnectionCredentialStep
        companyId={interaction.companyId}
        provider={repair.connection.provider}
        initialMethod={repair.connection.method}
        fixedMethod={false}
        connectionId={repair.connection.id}
        name={repair.connection.name}
        nameForMethod={(method) => defaultAiConnectionName(addresseeName ?? addresseeLabel, repair.connection.provider, method)}
        hideName
        ownership={repair.connection.ownership}
        agentIds={[interaction.payload.requestingAgentId]}
        allAgents={false}
        onComplete={(result) => selectAiAccountMutation.mutate({ ...result, generation })}
        onCancel={() => { closeSetup(); returnFocusToCard(); }}
      /> : <p role="status" className="text-sm text-muted-foreground">
        {t("app.connections.connectionIntentInteractionBody.ownerMustReconnect", {
          owner: repair.connection.ownership === "personal" ? repair.connection.ownerName ?? t("app.connections.connectionIntentInteractionBody.theAccountOwner") : t("app.connections.connectionIntentInteractionBody.theAccountOwner"),
          name: repair.connection.name,
        })}
      </p>
    : aiConnection && aiConnection.mode !== "responsible_user"
      ? <p role="status" className="text-sm text-muted-foreground">{t("app.connections.connectionIntentInteractionBody.selectedUnavailable")}</p>
      : aiConnection ? <AiConnectionCredentialStep
          companyId={interaction.companyId}
          provider={aiConnection.provider}
          name={defaultAiConnectionName(addresseeName ?? addresseeLabel, aiConnection.provider, "subscription")}
          hideName
          nameForMethod={(method) => defaultAiConnectionName(addresseeName ?? addresseeLabel, aiConnection.provider, method)}
          ownership="personal"
          agentIds={[interaction.payload.requestingAgentId]}
          allAgents={false}
          onComplete={(result) => selectAiAccountMutation.mutate({ ...result, generation })}
          onCancel={() => { closeSetup(); returnFocusToCard(); }}
        /> : setupContent;

  return (
    <div
      id={focusTargetId}
      ref={focusTargetRef}
      tabIndex={-1}
      data-testid="connection-intent-focus-target"
    >
      <div data-testid="connection-intent-actions">
        <div className="flex items-start gap-3">
          <AppLogo
            name={interaction.payload.serviceName}
            logoUrl={interaction.payload.serviceLogoUrl}
            darkLogoUrl={interaction.payload.serviceDarkLogoUrl}
            size={40}
          />
          <div>
            <p className="font-medium text-foreground">
              {isAi ? t("app.connections.connectionIntentInteractionBody.authenticationRequired", { service: interaction.payload.serviceName }) : t("app.connections.connectionIntentInteractionBody.agentNeedsService", { agent: interaction.payload.requestingAgentName, service: interaction.payload.serviceName })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {interaction.payload.purpose === "ai"
                ? t("app.connections.connectionIntentInteractionBody.aiDescription")
                : t("app.connections.connectionIntentInteractionBody.connectDescription")}
            </p>
          </div>
        </div>

        {needsRetry ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <RotateCcw className="h-4 w-4" />
            {t("app.connections.connectionIntentInteractionBody.authorizationUnfinished")}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {!isAi && <Button
            type="button"
            variant="ghost"
            disabled={declineMutation.isPending || completeMutation.isPending || authorizing}
            onClick={() => declineMutation.mutate()}
          >
            {t("app.connections.connectionIntentInteractionBody.notNow")}
          </Button>}
          {isAi ? <Button type="button" disabled={completeMutation.isPending || adoptMutation.isPending || selectAiAccountMutation.isPending} onClick={() => open ? closeSetup() : setOpen(true)}>
            <Plug className="h-4 w-4" />{open ? t("app.connections.connectionIntentInteractionBody.closeSetup") : t("app.connections.connectionIntentInteractionBody.fixConnection")}
          </Button> : <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                {authorizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}
                {authorizing
                  ? t("app.connections.connectionIntentInteractionBody.continueSetup")
                  : needsRetry
                    ? t("app.common.actions.tryAgain")
                    : setupQuery.data?.existingConnections.length ? t("app.connections.connectionIntentInteractionBody.connectOrUseExisting") : t("app.common.actions.connect")}
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-h-(--sz-85vh) overflow-y-auto sm:max-w-3xl"
              showCloseButton={false}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                focusTargetRef.current?.focus();
              }}
            >
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {t("app.connections.aiConnectionAuth.connectProvider", { provider: interaction.payload.serviceName })}
                </DialogTitle>
                <DialogDescription>
                  {t("app.connections.connectionIntentInteractionBody.dialogDescription")}
                </DialogDescription>
              </DialogHeader>
              {setupContent}
            </DialogContent>
          </Dialog>}
        </div>
        {isAi && open ? <div className="mt-4 border-t border-border pt-4" data-testid="ai-connection-inline-repair">{inlineContent}</div> : null}

        {completeMutation.isError ||
        (selectAiAccountMutation.isError && selectAiAccountMutation.variables?.generation === generation) ||
        adoptMutation.isError ||
        declineMutation.isError ||
        phaseMutation.isError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {(completeMutation.error ??
              selectAiAccountMutation.error ??
              adoptMutation.error ??
              declineMutation.error ??
              phaseMutation.error) instanceof Error
              ? (
                  completeMutation.error ??
                  selectAiAccountMutation.error ??
                  adoptMutation.error ??
                  declineMutation.error ??
                  phaseMutation.error
                )?.message
              : t("app.connections.connectionIntentInteractionBody.updateFailed")}
          </p>
        ) : null}
        {selectAiAccountMutation.isError && selectAiAccountMutation.variables?.generation === generation && (
          <Button className="mt-3" onClick={() => selectAiAccountMutation.mutate(selectAiAccountMutation.variables!)}>
            Retry using this connection
          </Button>
        )}
      </div>
    </div>
  );
}
