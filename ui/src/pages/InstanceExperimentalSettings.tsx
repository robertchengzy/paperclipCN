import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FlaskConical, Lock, Play } from "lucide-react";
import type {
  InstanceExperimentalSettings,
  InstanceExperimentalSettingsWithManaged,
  InstanceFeatureKey,
  ManagedSettingMetadata,
  PatchInstanceExperimentalSettings,
} from "@paperclipai/shared";
import { experimentalSettingKey } from "@paperclipai/shared";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useHiddenSettings } from "@/hooks/useHiddenSettings";
import { getWorktreeInstanceId, isWorktreeRuntime } from "../lib/worktree-branding";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { Trans } from "react-i18next";

type WorktreeRunExecutionDisplayState =
  | { kind: "off" }
  | { kind: "armed"; activatedAt: string }
  | { kind: "fail_closed"; reason: "missing_cutoff" | "missing_instance_id" | "instance_mismatch" };

/**
 * Mirror of the server's `resolveWorktreeRunExecutionActivation` fail-closed
 * ladder (server/src/services/instance-settings.ts) so the card never claims a
 * copied/legacy row is arming execution. The derived fields are display-only —
 * the PATCH the toggle sends still writes just the boolean.
 */
function resolveWorktreeRunExecutionDisplayState(
  settings:
    | Pick<
        InstanceExperimentalSettings,
        | "enableWorktreeRunExecution"
        | "worktreeRunExecutionActivatedAt"
        | "worktreeRunExecutionActivationInstanceId"
      >
    | undefined,
  currentInstanceId: string | null,
): WorktreeRunExecutionDisplayState {
  if (settings?.enableWorktreeRunExecution !== true) return { kind: "off" };
  if (!settings.worktreeRunExecutionActivatedAt) return { kind: "fail_closed", reason: "missing_cutoff" };
  if (!currentInstanceId) return { kind: "fail_closed", reason: "missing_instance_id" };
  if (settings.worktreeRunExecutionActivationInstanceId !== currentInstanceId) {
    return { kind: "fail_closed", reason: "instance_mismatch" };
  }
  return { kind: "armed", activatedAt: settings.worktreeRunExecutionActivatedAt };
}

function formatActivationTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// PAP-11233: keep Conference Room code intact, but hide the user-facing opt-in for now.
const SHOW_CONFERENCE_ROOM_EXPERIMENTAL_SETTING = false;

function ManagedByCloudBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Lock aria-hidden="true" />
      {t("app.settings.instanceExperimentalSettings.managedByCloud")}
    </Badge>
  );
}

function ExperimentalToggleCard({
  title,
  description,
  footnote,
  checked,
  onCheckedChange,
  disabled,
  settingKey,
  managed,
  ariaLabel,
}: {
  title: string;
  description: string;
  footnote?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  /** Flag key backing this card; operator-hidden keys render nothing. */
  settingKey: InstanceFeatureKey;
  managed?: ManagedSettingMetadata;
  ariaLabel: string;
}) {
  const { hidden: hiddenSettings } = useHiddenSettings();
  const isManaged = managed?.managed === true;
  if (hiddenSettings.has(experimentalSettingKey(settingKey))) return null;
  return (
    <Card className="block bg-transparent p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {isManaged ? <ManagedByCloudBadge /> : null}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          {footnote ? <p className="max-w-2xl text-xs text-muted-foreground">{footnote}</p> : null}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={(next) => {
            if (isManaged) return;
            onCheckedChange(next);
          }}
          disabled={disabled || isManaged}
          aria-label={ariaLabel}
        />
      </div>
    </Card>
  );
}

export function InstanceExperimentalSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { hidden: hiddenSettings } = useHiddenSettings();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("app.common.nouns.settings"), href: "/company/settings" },
      { label: t("app.common.labels.experimental") },
    ]);
  }, [setBreadcrumbs, t]);

  const experimentalQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });

  const toggleMutation = useMutation<
    InstanceExperimentalSettingsWithManaged,
    Error,
    PatchInstanceExperimentalSettings,
    { previousSettings?: InstanceExperimentalSettingsWithManaged }
  >({
    mutationFn: async (patch: PatchInstanceExperimentalSettings) =>
      instanceSettingsApi.updateExperimental(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.instance.experimentalSettings });
      const previousSettings = queryClient.getQueryData<InstanceExperimentalSettingsWithManaged>(
        queryKeys.instance.experimentalSettings,
      );
      if (previousSettings) {
        queryClient.setQueryData<InstanceExperimentalSettingsWithManaged>(
          queryKeys.instance.experimentalSettings,
          { ...previousSettings, ...patch },
        );
      }
      return { previousSettings };
    },
    onSuccess: async (updatedSettings) => {
      setActionError(null);
      queryClient.setQueryData(queryKeys.instance.experimentalSettings, updatedSettings);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adapters.all }),
        queryClient.invalidateQueries({ queryKey: ["built-in-agents"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.health }),
        queryClient.invalidateQueries({ queryKey: ["apps"] }),
      ]);
    },
    onError: (error, _patch, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKeys.instance.experimentalSettings, context.previousSettings);
      }
      setActionError(error instanceof Error ? error.message : t("app.settings.instanceExperimentalSettings.failedToUpdate"));
    },
  });

  if (experimentalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("app.settings.instanceExperimentalSettings.loading")}</div>;
  }

  if (experimentalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {experimentalQuery.error instanceof Error
          ? experimentalQuery.error.message
          : t("app.settings.instanceExperimentalSettings.failedToLoad")}
      </div>
    );
  }

  const inWorktree = isWorktreeRuntime();
  // Present only on cloud-managed instances: keys the managed overlay controls
  // render locked with the "Managed by Paperclip Cloud" badge. Self-hosted
  // responses carry no `managedKeys`, so every card stays editable.
  const managedKeys = experimentalQuery.data?.managedKeys ?? {};
  const enableWorktreeRunExecution = experimentalQuery.data?.enableWorktreeRunExecution === true;
  const worktreeRunExecutionManaged = managedKeys.enableWorktreeRunExecution?.managed === true;
  const worktreeRunExecutionState = resolveWorktreeRunExecutionDisplayState(
    experimentalQuery.data,
    getWorktreeInstanceId(),
  );
  const enableEnvironments = experimentalQuery.data?.enableEnvironments === true;
  const enableNativeRunner = experimentalQuery.data?.enableNativeRunner === true;
  const enableChatConnectors = experimentalQuery.data?.enableChatConnectors === true;
  const enableManagedSandboxOnly = experimentalQuery.data?.enableManagedSandboxOnly === true;
  const enableIsolatedWorkspaces = experimentalQuery.data?.enableIsolatedWorkspaces === true;
  const enableIsolatedWorkspacesByDefault =
    experimentalQuery.data?.enableIsolatedWorkspacesByDefault === true;
  // Streamlined left navigation is now the standard sidebar (PAP-12472); the
  // experimental opt-out was retired, so it no longer surfaces a toggle here.
  const enableStreamlinedUi = experimentalQuery.data?.enableStreamlinedUi !== false;
  const enableConferenceRoomChat = experimentalQuery.data?.enableConferenceRoomChat === true;
  const enableClassicTaskInterface = experimentalQuery.data?.enableClassicTaskInterface === true;
  const enableIssuePlanDecompositions =
    experimentalQuery.data?.enableIssuePlanDecompositions === true;
  const enableExperimentalFileViewer =
    experimentalQuery.data?.enableExperimentalFileViewer === true;
  const enableExternalObjects = experimentalQuery.data?.enableExternalObjects === true;
  const enableBuiltInAgents = experimentalQuery.data?.enableBuiltInAgents === true;
  const enableBetaSkills = experimentalQuery.data?.enableBetaSkills === true;
  const enableSummaries = experimentalQuery.data?.enableSummaries === true;
  const enableStatusCards = experimentalQuery.data?.enableStatusCards === true;
  const summariesManaged = managedKeys.enableSummaries?.managed === true;
  const statusCardsManaged = managedKeys.enableStatusCards?.managed === true;
  const statusCardsBlockedByManagedSummaries = summariesManaged && !enableSummaries;
  const summariesRequiredByManagedStatusCards = statusCardsManaged && enableStatusCards;
  const enableDecisions = experimentalQuery.data?.enableDecisions === true;
  const enableGoalsSidebarLink = experimentalQuery.data?.enableGoalsSidebarLink === true;
  const enableCases = experimentalQuery.data?.enableCases === true;
  const enableServerInfoDebugView = experimentalQuery.data?.enableServerInfoDebugView === true;
  const enablePaperclipDeveloperMode =
    experimentalQuery.data?.enablePaperclipDeveloperMode === true;
  const enableSimplifiedEnglishInteractions =
    experimentalQuery.data?.enableSimplifiedEnglishInteractions === true;
  const enableFirstTaskPlanProposal =
    experimentalQuery.data?.enableFirstTaskPlanProposal === true;
  const enableSmokeLab = experimentalQuery.data?.enableSmokeLab === true;
  const autoRestartDevServerWhenIdle = experimentalQuery.data?.autoRestartDevServerWhenIdle === true;
  const isVisible = (key: InstanceFeatureKey) => !hiddenSettings.has(experimentalSettingKey(key));
  const showWorktreeRunExecution = inWorktree && isVisible("enableWorktreeRunExecution");
  const showDeveloperSection = showWorktreeRunExecution || ([
    "autoRestartDevServerWhenIdle",
    "enableManagedSandboxOnly",
    "enablePaperclipDeveloperMode",
    "enableServerInfoDebugView",
    "enableSmokeLab",
    "enableIssuePlanDecompositions",
  ] satisfies InstanceFeatureKey[]).some(isVisible);
  const showLegacySection = isVisible("enableClassicTaskInterface") || isVisible("enableGoalsSidebarLink");
  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("app.common.labels.experimental")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("app.settings.instanceExperimentalSettings.description")}
        </p>
      </div>

      <div
        role="alert"
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{t("app.settings.instanceExperimentalSettings.warningTitle")}</p>
            <p className="text-muted-foreground">
              {t("app.settings.instanceExperimentalSettings.warningDescription")}
            </p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="space-y-3" aria-labelledby="experimental-features-heading">
        <div className="space-y-1">
          <h2 id="experimental-features-heading" className="text-sm font-semibold">
            {t("app.settings.instanceExperimentalSettings.featuresHeading")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("app.settings.instanceExperimentalSettings.featuresDescription")}
          </p>
        </div>

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableAgentChat.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableAgentChat.description")}
          footnote={t("app.settings.instanceExperimentalSettings.cards.enableAgentChat.footnote")}
          checked={experimentalQuery.data?.enableAgentChat ?? false}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableAgentChat: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableAgentChat"
          managed={managedKeys.enableAgentChat}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableAgentChat.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableBetaSkills.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableBetaSkills.description")}
          checked={enableBetaSkills}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableBetaSkills: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableBetaSkills"
          managed={managedKeys.enableBetaSkills}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableBetaSkills.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableBuiltInAgents.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableBuiltInAgents.description")}
          checked={enableBuiltInAgents}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableBuiltInAgents: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableBuiltInAgents"
          managed={managedKeys.enableBuiltInAgents}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableBuiltInAgents.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableCases.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableCases.description")}
          footnote={t("app.settings.instanceExperimentalSettings.cards.enableCases.footnote")}
          checked={enableCases}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableCases: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableCases"
          managed={managedKeys.enableCases}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableCases.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableChatConnectors.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableChatConnectors.description")}
          footnote={t("app.settings.instanceExperimentalSettings.cards.enableChatConnectors.footnote")}
          checked={enableChatConnectors}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableChatConnectors: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableChatConnectors"
          managed={managedKeys.enableChatConnectors}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableChatConnectors.ariaLabel")}
        />

        {SHOW_CONFERENCE_ROOM_EXPERIMENTAL_SETTING ? (
          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.enableConferenceRoomChat.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.enableConferenceRoomChat.description")}
            checked={enableConferenceRoomChat}
            onCheckedChange={(checked) => toggleMutation.mutate({ enableConferenceRoomChat: checked })}
            disabled={toggleMutation.isPending}
            settingKey="enableConferenceRoomChat"
            managed={managedKeys.enableConferenceRoomChat}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableConferenceRoomChat.ariaLabel")}
          />
        ) : null}

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableDecisions.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableDecisions.description")}
          checked={enableDecisions}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableDecisions: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableDecisions"
          managed={managedKeys.enableDecisions}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableDecisions.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableEnvironments.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableEnvironments.description")}
          checked={enableEnvironments}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableEnvironments: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableEnvironments"
          managed={managedKeys.enableEnvironments}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableEnvironments.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableExternalObjects.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableExternalObjects.description")}
          checked={enableExternalObjects}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableExternalObjects: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableExternalObjects"
          managed={managedKeys.enableExternalObjects}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableExternalObjects.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableIsolatedWorkspaces.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableIsolatedWorkspaces.description")}
          checked={enableIsolatedWorkspaces}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableIsolatedWorkspaces: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableIsolatedWorkspaces"
          managed={managedKeys.enableIsolatedWorkspaces}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableIsolatedWorkspaces.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableExperimentalFileViewer.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableExperimentalFileViewer.description")}
          checked={enableExperimentalFileViewer}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableExperimentalFileViewer: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableExperimentalFileViewer"
          managed={managedKeys.enableExperimentalFileViewer}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableExperimentalFileViewer.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableFirstTaskPlanProposal.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableFirstTaskPlanProposal.description")}
          checked={enableFirstTaskPlanProposal}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ enableFirstTaskPlanProposal: checked })
          }
          disabled={toggleMutation.isPending}
          settingKey="enableFirstTaskPlanProposal"
          managed={managedKeys.enableFirstTaskPlanProposal}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableFirstTaskPlanProposal.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableMcpAggregators.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableMcpAggregators.description")}
          footnote={t("app.settings.instanceExperimentalSettings.cards.enableMcpAggregators.footnote")}
          checked={experimentalQuery.data?.enableMcpAggregators === true}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableMcpAggregators: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableMcpAggregators"
          managed={managedKeys.enableMcpAggregators}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableMcpAggregators.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableNativeRunner.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableNativeRunner.description")}
          checked={enableNativeRunner}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ enableNativeRunner: checked })
          }
          disabled={toggleMutation.isPending}
          settingKey="enableNativeRunner"
          managed={managedKeys.enableNativeRunner}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableNativeRunner.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableSimplifiedEnglishInteractions.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableSimplifiedEnglishInteractions.description")}
          checked={enableSimplifiedEnglishInteractions}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ enableSimplifiedEnglishInteractions: checked })
          }
          disabled={toggleMutation.isPending}
          settingKey="enableSimplifiedEnglishInteractions"
          managed={managedKeys.enableSimplifiedEnglishInteractions}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableSimplifiedEnglishInteractions.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableStatusCards.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableStatusCards.description")}
          footnote={t("app.settings.instanceExperimentalSettings.cards.enableStatusCards.footnote")}
          checked={enableStatusCards}
          onCheckedChange={(checked) =>
            toggleMutation.mutate(
              checked
                ? { enableSummaries: true, enableStatusCards: true }
                : { enableStatusCards: false },
            )
          }
          disabled={toggleMutation.isPending || statusCardsBlockedByManagedSummaries}
          settingKey="enableStatusCards"
          managed={managedKeys.enableStatusCards}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableStatusCards.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableStreamlinedUi.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableStreamlinedUi.description")}
          footnote={t("app.settings.instanceExperimentalSettings.cards.enableStreamlinedUi.footnote")}
          checked={enableStreamlinedUi}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableStreamlinedUi: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableStreamlinedUi"
          managed={managedKeys.enableStreamlinedUi}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableStreamlinedUi.ariaLabel")}
        />

        <ExperimentalToggleCard
          title={t("app.settings.instanceExperimentalSettings.cards.enableSummaries.title")}
          description={t("app.settings.instanceExperimentalSettings.cards.enableSummaries.description")}
          footnote={t("app.settings.instanceExperimentalSettings.cards.enableSummaries.footnote")}
          checked={enableSummaries}
          onCheckedChange={(checked) =>
            toggleMutation.mutate(
              checked || !enableStatusCards
                ? { enableSummaries: checked }
                : { enableSummaries: false, enableStatusCards: false },
            )
          }
          disabled={toggleMutation.isPending || summariesRequiredByManagedStatusCards}
          settingKey="enableSummaries"
          managed={managedKeys.enableSummaries}
          ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableSummaries.ariaLabel")}
        />

        {enableIsolatedWorkspaces && (
          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.enableIsolatedWorkspacesByDefault.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.enableIsolatedWorkspacesByDefault.description")}
            checked={enableIsolatedWorkspacesByDefault}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableIsolatedWorkspacesByDefault: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableIsolatedWorkspacesByDefault"
            managed={managedKeys.enableIsolatedWorkspacesByDefault}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableIsolatedWorkspacesByDefault.ariaLabel")}
          />
        )}
      </section>

      {showDeveloperSection ? (
        <section className="space-y-3" aria-labelledby="developer-mode-heading">
          <div className="space-y-1">
            <h2 id="developer-mode-heading" className="text-sm font-semibold">
              {t("app.settings.instanceExperimentalSettings.developerHeading")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("app.settings.instanceExperimentalSettings.developerDescription")}
            </p>
          </div>

          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.autoRestartDevServerWhenIdle.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.autoRestartDevServerWhenIdle.description")}
            checked={autoRestartDevServerWhenIdle}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ autoRestartDevServerWhenIdle: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="autoRestartDevServerWhenIdle"
            managed={managedKeys.autoRestartDevServerWhenIdle}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.autoRestartDevServerWhenIdle.ariaLabel")}
          />

          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.enableManagedSandboxOnly.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.enableManagedSandboxOnly.description")}
            checked={enableManagedSandboxOnly}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableManagedSandboxOnly: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableManagedSandboxOnly"
            managed={managedKeys.enableManagedSandboxOnly}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableManagedSandboxOnly.ariaLabel")}
          />

          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.enablePaperclipDeveloperMode.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.enablePaperclipDeveloperMode.description")}
            checked={enablePaperclipDeveloperMode}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enablePaperclipDeveloperMode: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enablePaperclipDeveloperMode"
            managed={managedKeys.enablePaperclipDeveloperMode}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enablePaperclipDeveloperMode.ariaLabel")}
          />

          {showWorktreeRunExecution ? (
            <Card className="block bg-transparent p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{t("app.settings.instanceExperimentalSettings.worktreeTitle")}</h3>
                      {worktreeRunExecutionManaged ? <ManagedByCloudBadge /> : null}
                    </div>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {t("app.settings.instanceExperimentalSettings.worktreeDescription")}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={enableWorktreeRunExecution}
                    onCheckedChange={(checked) => {
                      if (worktreeRunExecutionManaged) return;
                      toggleMutation.mutate({ enableWorktreeRunExecution: checked });
                    }}
                    disabled={toggleMutation.isPending || worktreeRunExecutionManaged}
                    aria-label={t("app.settings.instanceExperimentalSettings.worktreeAriaLabel")}
                  />
                </div>

                {worktreeRunExecutionState.kind === "armed" ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-foreground">
                    <Play className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      <Trans
                        i18nKey="app.settings.instanceExperimentalSettings.worktreeArmed"
                        values={{ time: formatActivationTimestamp(worktreeRunExecutionState.activatedAt) }}
                        components={{ bold: <span className="font-medium" /> }}
                      />
                    </span>
                  </div>
                ) : null}

                {worktreeRunExecutionState.kind === "fail_closed" ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{t("app.settings.instanceExperimentalSettings.worktreeSuppressed")}</p>
                      <p className="text-muted-foreground">
                        {worktreeRunExecutionState.reason === "instance_mismatch"
                          ? t("app.settings.instanceExperimentalSettings.worktreeInstanceMismatch")
                          : t("app.settings.instanceExperimentalSettings.worktreeMissingCutoff")}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.enableServerInfoDebugView.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.enableServerInfoDebugView.description")}
            checked={enableServerInfoDebugView}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableServerInfoDebugView: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableServerInfoDebugView"
            managed={managedKeys.enableServerInfoDebugView}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableServerInfoDebugView.ariaLabel")}
          />

          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.enableSmokeLab.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.enableSmokeLab.description")}
            checked={enableSmokeLab}
            onCheckedChange={(checked) => toggleMutation.mutate({ enableSmokeLab: checked })}
            disabled={toggleMutation.isPending}
            settingKey="enableSmokeLab"
            managed={managedKeys.enableSmokeLab}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableSmokeLab.ariaLabel")}
          />

          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.enableIssuePlanDecompositions.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.enableIssuePlanDecompositions.description")}
            checked={enableIssuePlanDecompositions}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableIssuePlanDecompositions: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableIssuePlanDecompositions"
            managed={managedKeys.enableIssuePlanDecompositions}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableIssuePlanDecompositions.ariaLabel")}
          />
        </section>
      ) : null}

      {showLegacySection ? (
        <section className="space-y-3" aria-labelledby="legacy-heading">
          <div className="space-y-1">
            <h2 id="legacy-heading" className="text-sm font-semibold">
              {t("app.settings.instanceExperimentalSettings.legacyHeading")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("app.settings.instanceExperimentalSettings.legacyDescription")}</p>
          </div>

          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.enableClassicTaskInterface.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.enableClassicTaskInterface.description")}
            footnote={t("app.settings.instanceExperimentalSettings.cards.enableClassicTaskInterface.footnote")}
            checked={enableClassicTaskInterface}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableClassicTaskInterface: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableClassicTaskInterface"
            managed={managedKeys.enableClassicTaskInterface}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableClassicTaskInterface.ariaLabel")}
          />

          <ExperimentalToggleCard
            title={t("app.settings.instanceExperimentalSettings.cards.enableGoalsSidebarLink.title")}
            description={t("app.settings.instanceExperimentalSettings.cards.enableGoalsSidebarLink.description")}
            checked={enableGoalsSidebarLink}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableGoalsSidebarLink: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableGoalsSidebarLink"
            managed={managedKeys.enableGoalsSidebarLink}
            ariaLabel={t("app.settings.instanceExperimentalSettings.cards.enableGoalsSidebarLink.ariaLabel")}
          />
        </section>
      ) : null}
    </div>
  );
}
