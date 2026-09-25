import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PatchInstanceGeneralSettings, BackupRetentionPolicy } from "@paperclipai/shared";
import {
  DAILY_RETENTION_PRESETS,
  WEEKLY_RETENTION_PRESETS,
  MONTHLY_RETENTION_PRESETS,
  DEFAULT_BACKUP_RETENTION,
} from "@paperclipai/shared";
import { LogOut, SlidersHorizontal } from "lucide-react";
import { healthApi } from "@/api/health";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { ModeBadge } from "@/components/access/ModeBadge";
import { Button } from "../components/ui/button";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "../lib/utils";
import { useSignOut } from "@/hooks/useSignOut";
import { useTranslation } from "@/i18n";
import { Trans } from "react-i18next";

const FEEDBACK_TERMS_URL = import.meta.env.VITE_FEEDBACK_TERMS_URL?.trim() || "https://paperclip.ing/tos";

export function InstanceGeneralSettings({ embedded = false }: { embedded?: boolean }) {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const signOutMutation = useSignOut();

  useEffect(() => {
    if (embedded) return;
    setBreadcrumbs([
      { label: t("app.common.nouns.settings"), href: "/company/settings" },
      { label: t("app.common.labels.general") },
    ]);
  }, [embedded, setBreadcrumbs, t]);

  const generalQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  });
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  const updateGeneralMutation = useMutation({
    mutationFn: instanceSettingsApi.updateGeneral,
    onMutate: () => {
      setActionError(null);
      signOutMutation.reset();
    },
    onSuccess: async () => {
      setActionError(null);
      signOutMutation.reset();
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("app.settings.instanceGeneralSettings.failedToUpdate"));
    },
  });

  if (generalQuery.isLoading || healthQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("app.settings.instanceGeneralSettings.loading")}</div>;
  }

  if (generalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {generalQuery.error instanceof Error
          ? generalQuery.error.message
          : t("app.settings.instanceGeneralSettings.failedToLoad")}
      </div>
    );
  }

  const censorUsernameInLogs = generalQuery.data?.censorUsernameInLogs === true;
  const keyboardShortcuts = generalQuery.data?.keyboardShortcuts === true;
  const feedbackDataSharingPreference = generalQuery.data?.feedbackDataSharingPreference ?? "prompt";
  const backupRetention: BackupRetentionPolicy = generalQuery.data?.backupRetention ?? DEFAULT_BACKUP_RETENTION;
  const hiddenSettings = new Set(healthQuery.data?.hiddenSettings ?? []);
  const showDeploymentStatus = !hiddenSettings.has("instance.general.deploymentStatus");
  const showCensorUsernameInLogs = !hiddenSettings.has("instance.general.censorUsernameInLogs");
  const showKeyboardShortcuts = !hiddenSettings.has("instance.general.keyboardShortcuts");
  const showBackupRetention = !hiddenSettings.has("instance.general.backupRetention");
  const showFeedbackDataSharing = !hiddenSettings.has("instance.general.feedbackDataSharingPreference");
  const showSignOut = !hiddenSettings.has("instance.general.signOut");
  const visibleTopics = [
    ...(showCensorUsernameInLogs ? [t("app.settings.instanceGeneralSettings.topicLogDisplay")] : []),
    ...(showKeyboardShortcuts ? [t("app.settings.instanceGeneralSettings.topicKeyboardShortcuts")] : []),
    ...(showBackupRetention ? [t("app.settings.instanceGeneralSettings.topicBackupRetention")] : []),
    ...(showFeedbackDataSharing ? [t("app.settings.instanceGeneralSettings.topicDataSharing")] : []),
  ];
  const topicSummary = new Intl.ListFormat(i18n.language, { style: "long", type: "conjunction" }).format(visibleTopics);
  const visibleActionError = signOutMutation.error instanceof Error
    ? signOutMutation.error.message
    : signOutMutation.error
      ? t("app.settings.instanceGeneralSettings.failedToSignOut")
      : actionError;

  return (
    <div className={embedded ? "space-y-8" : "max-w-4xl space-y-8"}>
      {!embedded ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{t("app.common.labels.general")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {visibleTopics.length > 0
              ? t("app.settings.instanceGeneralSettings.descriptionWithTopics", { topics: topicSummary })
              : t("app.settings.instanceGeneralSettings.description")}
          </p>
        </div>
      ) : null}

      {visibleActionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {visibleActionError}
        </div>
      )}

      {showDeploymentStatus && (
      <section>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{t("app.settings.instanceGeneralSettings.deploymentAndAuth")}</h2>
            <ModeBadge
              deploymentMode={healthQuery.data?.deploymentMode}
              deploymentExposure={healthQuery.data?.deploymentExposure}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {healthQuery.data?.deploymentMode === "local_trusted"
              ? t("app.settings.instanceGeneralSettings.localTrustedDescription")
              : healthQuery.data?.deploymentExposure === "public"
                ? t("app.settings.instanceGeneralSettings.authenticatedPublicDescription")
                : t("app.settings.instanceGeneralSettings.authenticatedPrivateDescription")}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatusBox
              label={t("app.settings.instanceGeneralSettings.authReadiness")}
              value={healthQuery.data?.authReady ? t("app.common.states.ready") : t("app.settings.instanceGeneralSettings.notReady")}
            />
            <StatusBox
              label={t("app.settings.instanceGeneralSettings.bootstrapStatus")}
              value={healthQuery.data?.bootstrapStatus === "bootstrap_pending" ? t("app.settings.instanceGeneralSettings.setupRequired") : t("app.common.states.ready")}
            />
            <StatusBox
              label={t("app.settings.instanceGeneralSettings.bootstrapInvite")}
              value={healthQuery.data?.bootstrapInviteActive ? t("app.common.states.active") : t("app.common.none")}
            />
          </div>
        </div>
      </section>
      )}

      {showCensorUsernameInLogs && (
      <section>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("app.settings.instanceGeneralSettings.censorUsername")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("app.settings.instanceGeneralSettings.censorUsernameDescription")}
            </p>
          </div>
          <ToggleSwitch
            checked={censorUsernameInLogs}
            onCheckedChange={() => updateGeneralMutation.mutate({ censorUsernameInLogs: !censorUsernameInLogs })}
            disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
            aria-label={t("app.settings.instanceGeneralSettings.toggleCensorUsername")}
          />
        </div>
      </section>
      )}

      {showKeyboardShortcuts && (
      <section>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("app.settings.instanceGeneralSettings.keyboardShortcuts")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("app.settings.instanceGeneralSettings.keyboardShortcutsDescription")}
            </p>
          </div>
          <ToggleSwitch
            checked={keyboardShortcuts}
            onCheckedChange={() => updateGeneralMutation.mutate({ keyboardShortcuts: !keyboardShortcuts })}
            disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
            aria-label={t("app.settings.instanceGeneralSettings.toggleKeyboardShortcuts")}
          />
        </div>
      </section>
      )}

      {showBackupRetention && (
      <section>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("app.settings.instanceGeneralSettings.backupRetention")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("app.settings.instanceGeneralSettings.backupRetentionDescription")}
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("app.settings.instanceGeneralSettings.daily")}</h3>
            <div className="flex flex-wrap gap-2">
              {DAILY_RETENTION_PRESETS.map((days) => {
                const active = backupRetention.dailyDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateGeneralMutation.mutate({
                        backupRetention: { ...backupRetention, dailyDays: days },
                      })
                    }
                  >
                    <div className="text-sm font-medium">{t("app.settings.instanceGeneralSettings.days", { count: days })}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("app.settings.instanceGeneralSettings.weekly")}</h3>
            <div className="flex flex-wrap gap-2">
              {WEEKLY_RETENTION_PRESETS.map((weeks) => {
                const active = backupRetention.weeklyWeeks === weeks;
                const label = weeks === 1 ? t("app.settings.instanceGeneralSettings.oneWeek") : t("app.settings.instanceGeneralSettings.manyWeeks", { count: weeks });
                return (
                  <button
                    key={weeks}
                    type="button"
                    disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateGeneralMutation.mutate({
                        backupRetention: { ...backupRetention, weeklyWeeks: weeks },
                      })
                    }
                  >
                    <div className="text-sm font-medium">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("app.settings.instanceGeneralSettings.monthly")}</h3>
            <div className="flex flex-wrap gap-2">
              {MONTHLY_RETENTION_PRESETS.map((months) => {
                const active = backupRetention.monthlyMonths === months;
                const label = months === 1 ? t("app.settings.instanceGeneralSettings.oneMonth") : t("app.settings.instanceGeneralSettings.manyMonths", { count: months });
                return (
                  <button
                    key={months}
                    type="button"
                    disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                    onClick={() =>
                      updateGeneralMutation.mutate({
                        backupRetention: { ...backupRetention, monthlyMonths: months },
                      })
                    }
                  >
                    <div className="text-sm font-medium">{label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      )}

      {showFeedbackDataSharing && (
      <section>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("app.settings.instanceGeneralSettings.feedbackSharing")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("app.settings.instanceGeneralSettings.feedbackSharingDescription")}
            </p>
            {FEEDBACK_TERMS_URL ? (
              <a
                href={FEEDBACK_TERMS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {t("app.settings.instanceGeneralSettings.readTerms")}
              </a>
            ) : null}
          </div>
          {feedbackDataSharingPreference === "prompt" ? (
            <div className="rounded-lg bg-accent/20 px-3 py-2 text-sm text-muted-foreground">
              {t("app.settings.instanceGeneralSettings.noDefaultSaved")}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {[
              {
                value: "allowed",
                label: t("app.settings.instanceGeneralSettings.alwaysAllow"),
                description: t("app.settings.instanceGeneralSettings.alwaysAllowDescription"),
              },
              {
                value: "not_allowed",
                label: t("app.settings.instanceGeneralSettings.dontAllow"),
                description: t("app.settings.instanceGeneralSettings.dontAllowDescription"),
              },
            ].map((option) => {
              const active = feedbackDataSharingPreference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={updateGeneralMutation.isPending || signOutMutation.isPending}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    active
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border bg-background hover:bg-accent/50",
                  )}
                  onClick={() =>
                    updateGeneralMutation.mutate({
                      feedbackDataSharingPreference: option.value as
                        | "allowed"
                        | "not_allowed",
                    })
                  }
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            <Trans i18nKey="app.settings.instanceGeneralSettings.retestHint" components={{ code: <code /> }} />
          </p>
        </div>
      </section>

      )}

      {showSignOut && (
      <section>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("app.common.actions.signOut")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("app.settings.instanceGeneralSettings.signOutDescription")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={signOutMutation.isPending || updateGeneralMutation.isPending}
            onClick={() => {
              setActionError(null);
              signOutMutation.mutate();
            }}
          >
            <LogOut className="size-4" />
            {signOutMutation.isPending ? t("app.settings.instanceGeneralSettings.signingOut") : t("app.common.actions.signOut")}
          </Button>
        </div>
      </section>
      )}
    </div>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
