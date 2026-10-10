import { Trans } from "react-i18next";
import { t as translateUiCopy, i18n as uiCopyI18n } from "@/i18n";
import { t, useTranslation } from "@/i18n";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import type { GitHubAppWizardState } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { chatEndpointsApi } from "@/api/chatEndpoints";
import { githubChatApi } from "@/api/githubChat";
import { projectsApi } from "@/api/projects";
import { toolsApi } from "@/api/tools";
import { AgentSelect } from "@/components/AgentMultiSelect";
import { GitHubAgentTrustWarning } from "@/components/GitHubAgentTrustWarning";
import {
  SetupWizardNavigation,
  SetupWizardFooter,
} from "@/components/SetupWizard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useNavigate, useSearchParams, Link } from "@/lib/router";
import { buildPermissionsForTrustPreset } from "@/lib/trust-policy-ui";
import { queryKeys } from "@/lib/queryKeys";
import type { GitHubConnectionCompleteLocationState } from "./GitHubConnectionComplete";

/** Restrict native manifest submission to GitHub registration endpoints. */
export function gitHubAppManifestAction(
  registration: NonNullable<GitHubAppWizardState["registration"]>,
) {
  const url = new URL(registration.registrationUrl);
  if (
    url.origin !== "https://github.com" ||
    url.username || url.password || url.hash ||
    !/^\/(settings|organizations\/[A-Za-z0-9-]+\/settings)\/apps\/new$/.test(
      url.pathname,
    )
  )
    throw new Error(translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.gitHubReturnedAnInvalidRegistrationAddress"));
  return url.toString();
}
function GitHubAppManifestForm({
  registration, onSaveExit, disabled, autoSubmit, onSubmit,
}: {
  registration: NonNullable<GitHubAppWizardState["registration"]>;
  onSaveExit: () => void;
  disabled: boolean;
  autoSubmit: boolean;
  onSubmit: () => void;
}) {
  useTranslation();
  const form = useRef<HTMLFormElement>(null);
  const requested = useRef(false);
  useEffect(() => {
    if (!autoSubmit) requested.current = false;
    if (autoSubmit && !disabled && !requested.current && form.current) {
      requested.current = true;
      form.current.requestSubmit();
    }
  }, [autoSubmit, disabled]);
  return (
    <form
      ref={form}
      method="post"
      action={gitHubAppManifestAction(registration)}
      onSubmit={onSubmit}
    >
      <input type="hidden" name="manifest" value={JSON.stringify(registration.manifest)} />
      <SetupWizardFooter onSaveExit={onSaveExit} disabled={disabled}>
        <Button type="submit" disabled={disabled}>{translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.continueToGitHub")}</Button>
      </SetupWizardFooter>
    </form>
  );
}
export function GitHubChatSetup() {
  useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const resume = params.get("resume");
  const identityOnly = params.get("stage") === "identity";
  const reconnect = params.get("reconnect") === "1";
  const [agentId, setAgentId] = useState(params.get("agentId") ?? "");
  const [ownerType, setOwnerType] = useState<"personal" | "organization">(
    "personal",
  );
  const [ownerLogin, setOwnerLogin] = useState("");
  const [customOrganization, setCustomOrganization] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitManifest, setSubmitManifest] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState(params.get("reconnect") === "1");
  const [credentials, setCredentials] = useState({
    appId: "",
    privateKey: "",
    webhookSecret: "",
  });
  const [appNotCreated, setAppNotCreated] = useState(false);
  const [legacyAccount, setLegacyAccount] = useState("");
  const [identityLinked, setIdentityLinked] = useState(false);
  const [legacyIdentity, setLegacyIdentity] = useState<Awaited<
    ReturnType<typeof githubChatApi.identity>
  > | null>(null);
  const agents = useQuery({
    queryKey: ["github-setup-agents", selectedCompanyId],
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && !identityOnly,
  });
  const current = useQuery({
    queryKey: ["github-setup", resume],
    queryFn: () => chatEndpointsApi.get(resume!),
    enabled: !!resume,
    refetchInterval: 3000,
  });
  const bot = current.data;
  const progress = useQuery({
    queryKey: ["github-wizard", resume],
    queryFn: () => githubChatApi.advance(resume!),
    enabled: !!bot && !existing && !identityOnly,
    refetchInterval: (query) =>
      ["connected", "create", "identity", "enrollment", "recovery"].includes(
        query.state.data?.state ?? "",
      )
        ? false
        : 5000,
    retry: false,
  });
  const accounts = useQuery({
    queryKey: ["github-personal-connections", resume],
    queryFn: () => githubChatApi.personalConnections(resume!),
    enabled: !!bot && (identityOnly || progress.data?.state === "identity"),
  });
  const selectedAgent = agents.data?.find(
    (agent) => agent.id === (bot?.assignedAgentId ?? agentId),
  );
  const state = identityOnly ? undefined : progress.data;
  const choosingAccount = !!bot && !identityOnly && !existing && state?.state === "create";
  const repositories = useQuery({
    queryKey: ["project-repositories", selectedCompanyId],
    queryFn: () => projectsApi.repositoryOptions(selectedCompanyId!),
    enabled: !!selectedCompanyId && choosingAccount,
    staleTime: 30_000,
  });
  const connectedBots = useQuery({
    queryKey: queryKeys.chatEndpoints.list(selectedCompanyId!),
    queryFn: () => chatEndpointsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && choosingAccount,
    staleTime: 30_000,
  });
  const organizations = new Map<string, string>();
  for (const repository of repositories.data?.repositories ?? []) {
    if (repository.ownerType !== "organization") continue;
    const login = repository.fullName.split("/")[0];
    organizations.set(login.toLowerCase(), login);
  }
  for (const endpoint of connectedBots.data ?? []) {
    const github = endpoint.setup?.github;
    if (endpoint.provider === "github" && ["active", "paused"].includes(endpoint.status) &&
        github?.ownerType === "organization" && github.ownerLogin) {
      organizations.set(github.ownerLogin.toLowerCase(), github.ownerLogin);
    }
  }
  const knownOrganizations = [...organizations.values()].sort((a, b) => a.localeCompare(b));
  const knownOwner = organizations.get(ownerLogin.toLowerCase());
  const accountChoice = ownerType === "personal" ? "personal"
    : !customOrganization && knownOwner ? `organization:${knownOwner}` : "organization";
  const deliveryVerifiedWhileChecking =
    state?.state === "verify" &&
    !!bot?.setup?.webhookVerifiedAt &&
    state.verification?.checks.some(
      (check) => !check.ok && ["webhook", "delivery"].includes(check.key),
    );
  const existingIdentityMethod =
    identityOnly || state?.identityMethod === "existing_connection";
  const connected = state?.state === "connected" && !existing;
  useEffect(() => {
    if (!connected || !bot) return;
    queryClient.setQueryData(queryKeys.chatEndpoints.detail(bot.id), bot);
    if (selectedAgent) queryClient.setQueryData(queryKeys.agents.detail(selectedAgent.id), selectedAgent);
    navigate(`/apps/chat/${bot.id}/settings`, {
      replace: true,
      state: {
        githubConnectionComplete: { endpointId: bot.id, runtimeChecks: state.runtimeChecks },
      } satisfies GitHubConnectionCompleteLocationState,
    });
  }, [connected, bot, selectedAgent, state, queryClient, navigate]);
  useEffect(() => {
    setBreadcrumbs([
      { label: t("app.common.nouns.connectors"), href: "/apps" },
      { label: translateUiCopy("app.uiCopy.componentsChatAgentChannelsPanel.gitHubCodeReviewBot") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, uiCopyI18n.language]);
  useEffect(() => {
    if (bot) {
      setAgentId(bot.assignedAgentId);
      if (bot.setup?.github?.ownerType)
        setOwnerType(bot.setup.github.ownerType);
      setOwnerLogin(bot.setup?.github?.ownerLogin ?? "");
      setCustomOrganization(false);
      if (bot.setup?.github?.appName) setName(bot.setup.github.appName);
    }
  }, [
    bot?.id,
    bot?.setup?.github?.ownerType,
    bot?.setup?.github?.ownerLogin,
    bot?.setup?.github?.appName,
  ]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.couldNotConnectGitHubTryAgain"),
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    await current.refetch();
    if (!identityOnly) await progress.refetch();
  }
  const appInput = () => ({
    name: (
      name ||
      selectedAgent?.name ||
      bot?.assignedAgentName ||
      "GitHub Reviewer"
    ).slice(0, 34),
    ownerType,
    ...(ownerType === "organization" ? { ownerLogin: ownerLogin.trim() } : {}),
  });
  const exit = () =>
    void run(async () => {
      if (
        !identityOnly &&
        bot &&
        !bot.botExternalId &&
        !state?.registration &&
        state?.state !== "recovery"
      ) {
        await githubChatApi.saveDraft(bot.id, appInput());
        await current.refetch();
      }
      navigate("/apps");
    });
  const footer = (
    label?: string,
    action?: () => Promise<void>,
    disabled = false,
  ) => (
    <SetupWizardFooter onSaveExit={exit} disabled={busy}>
      {label && action && (
        <Button disabled={busy || disabled} onClick={() => void run(action)}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          {label}
        </Button>
      )}
    </SetupWizardFooter>
  );
  if (resume && !bot)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.resumeGitHubSetup")}</h1>
        {current.error ? (
          <p role="alert" className="text-sm text-destructive">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.couldNotLoadThisConnectionTryAgainToResume")}
          </p>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.loadingYourDraft")}
          </p>
        )}
        {footer(current.error ? t("app.issueUi.projectRepositoryInput.tryAgain") : undefined, async () => {
          await current.refetch();
        })}
      </div>
    );
  if (connected) return null;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      {!identityOnly && (
        <SetupWizardNavigation
          labels={[t("app.apps.gitHubChatSetup.chooseAgent"), t("app.apps.gitHubChatSetup.connectGithub")]}
          step={bot ? 1 : 0}
          availableStep={bot ? 1 : 0}
          onSelect={() => {}}
          disabled
          takeover
        />
      )}
      <h1 className="text-2xl font-semibold">
        {!bot
          ? t("app.apps.gitHubChatSetup.chooseAgent")
          : identityOnly || state?.state === "identity"
              ? t("app.apps.gitHubChatSetup.connectYourAccount")
              : t("app.apps.gitHubChatSetup.connectGithub")}
      </h1>
      {(error || (!identityOnly && progress.error) || accounts.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error ||
            (accounts.error instanceof Error
              ? accounts.error.message
              : undefined) ||
            (progress.error instanceof Error
              ? progress.error.message
              : translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.couldNotCheckGitHubSetupTryAgain"))}
        </p>
      )}
      {!bot ? (
        <>
          <AgentSelect
            agents={agents.data ?? []}
            value={agentId}
            onChange={setAgentId}
          />
          {selectedAgent && (
            <GitHubAgentTrustWarning
              agent={selectedAgent}
              disabled={busy}
              onChangeToLowTrust={() =>
                void run(async () => {
                  const permissions = buildPermissionsForTrustPreset(
                    selectedAgent.permissions,
                    "low_trust_review",
                  );
                  await agentsApi.updatePermissions(
                    selectedAgent.id,
                    {
                      ...permissions,
                      canCreateAgents: false,
                      canCreateSkills: false,
                      canAssignTasks:
                        typeof selectedAgent.permissions.canAssignTasks ===
                        "boolean"
                          ? selectedAgent.permissions.canAssignTasks
                          : true,
                    },
                    selectedCompanyId!,
                  );
                  await queryClient.invalidateQueries({
                    queryKey: ["github-setup-agents", selectedCompanyId],
                  });
                })
              }
            />
          )}
          {footer(
            t("app.common.actions.continue"),
            async () => {
              const created = await chatEndpointsApi.create(
                selectedCompanyId!,
                { provider: "github", assignedAgentId: agentId },
              );
              setName((selectedAgent?.name ?? "GitHub Reviewer").slice(0, 34));
              const next = new URLSearchParams(params);
              next.set("resume", created.id);
              setParams(next, { replace: true });
              queryClient.setQueryData(["github-setup", created.id], created);
            },
            !agentId || !selectedCompanyId,
          )}
        </>
      ) : !identityOnly && !existing && progress.isPending ? (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.checkingYourGitHubConnection")}
          </p>
          {footer()}
        </>
      ) : existing ? (
        <>
          <p className="text-sm text-muted-foreground">
            {reconnect
              ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.leaveTheseBlankToReuseThisAppSStored")
              : translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.useTheCredentialsFromThisAppSGitHubSettings")}
          </p>
          <Label htmlFor="github-app-id">{t("app.apps.gitHubChatSetup.appId")}</Label>
          <Input
            id="github-app-id"
            value={credentials.appId}
            onChange={(event) =>
              setCredentials({ ...credentials, appId: event.target.value })
            }
          />
          <Label htmlFor="github-private-key">{t("app.apps.gitHubChatSetup.privateKey")}</Label>
          <Textarea
            id="github-private-key"
            value={credentials.privateKey}
            onChange={(event) =>
              setCredentials({ ...credentials, privateKey: event.target.value })
            }
          />
          {!reconnect &&
            !["active", "paused", "revoked"].includes(bot.status) && (
              <>
                <Label htmlFor="github-webhook-secret">{t("app.apps.gitHubChatSetup.webhookSecret")}</Label>
                <Input
                  id="github-webhook-secret"
                  type="password"
                  value={credentials.webhookSecret}
                  onChange={(event) =>
                    setCredentials({
                      ...credentials,
                      webhookSecret: event.target.value,
                    })
                  }
                />
              </>
            )}
          {footer(
            reconnect ? t("app.apps.gitHubChatSetup.reconnectApp") : "Connect existing App",
            async () => {
              if (
                reconnect ||
                ["active", "paused", "revoked"].includes(bot.status)
              )
                await chatEndpointsApi.setup(bot.id, {
                  action: "reconnect",
                  ...(credentials.appId.trim() || credentials.privateKey.trim()
                    ? {
                        credentials: {
                          appId: credentials.appId,
                          privateKey: credentials.privateKey,
                        },
                      }
                    : {}),
                });
              else await githubChatApi.connectApp(bot.id, credentials);
              setCredentials({ appId: "", privateKey: "", webhookSecret: "" });
              setExisting(false);
              await refresh();
            },
            reconnect
              ? !!(credentials.appId.trim() || credentials.privateKey.trim()) &&
                  (!credentials.appId.trim() || !credentials.privateKey.trim())
              : !credentials.appId.trim() ||
                  !credentials.privateKey.trim() ||
                  (!["active", "paused", "revoked"].includes(bot.status) &&
                    !credentials.webhookSecret.trim()),
          )}
        </>
      ) : state?.state === "identity" || identityOnly ? (
        <>
          {identityOnly && identityLinked ? (
            <>
              <p role="status" className="text-sm"><Trans i18nKey="app.uiCopy.pagesAppsChatGitHubChatSetup.message91" components={{ part0: <strong>{legacyIdentity?.login}</strong> }} /></p>
              {footer()}
            </>
          ) : state?.identity ? (
            <>
              <p className="text-sm"><Trans i18nKey="app.uiCopy.pagesAppsChatGitHubChatSetup.message92" components={{ part0: <strong>{state.identity.login}</strong> }} /></p>
              {footer("Confirm my account", async () => {
                await githubChatApi.confirmIdentity(
                  bot.id,
                  state.identity!.githubUserId,
                );
                await refresh();
              })}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.linkYourGitHubAccountSoYourMentionsUseYour")}
              </p>
              {(accounts.data?.length ?? 0) > 0 && (
                <>
                  <Label htmlFor="github-personal-account">
                    {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.existingGitHubConnection")}
                  </Label>
                  <select
                    id="github-personal-account"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={legacyAccount}
                    onChange={(event) => {
                      setLegacyAccount(event.target.value);
                      setLegacyIdentity(null);
                      setIdentityLinked(false);
                    }}
                  >
                    <option value="">{translateUiCopy("app.finance.subscriptionCostCard.chooseAnAccount")}</option>
                    {accounts.data
                      ?.filter(
                        (account) =>
                          account.status === "active" && account.enabled,
                      )
                      .map((account) => (
                        <option
                          key={account.connectionId}
                          value={account.connectionId}
                        >
                          {account.login ?? account.name}
                        </option>
                      ))}
                  </select>
                  {legacyIdentity && (
                    <p className="text-sm"><Trans i18nKey="app.uiCopy.pagesAppsChatGitHubChatSetup.message93" components={{ part0: <strong>{legacyIdentity.login}</strong> }} /></p>
                  )}
                </>
              )}
              {existingIdentityMethod && !legacyAccount && (
                <Link
                  className="text-sm underline"
                  to="/apps/connect?source=github"
                >
                  {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.addAPersonalGitHubConnectionThenReturnToThis")}
                </Link>
              )}
              {footer(
                legacyAccount
                  ? legacyIdentity
                    ? "Confirm my account"
                    : "Check my account"
                  : "Connect my GitHub account",
                async () => {
                  if (legacyAccount) {
                    const observed = await githubChatApi.identity(
                      bot.id,
                      legacyAccount,
                      legacyIdentity?.githubUserId,
                    );
                    setLegacyIdentity(observed);
                    if (legacyIdentity) {
                      setIdentityLinked(true);
                      await refresh();
                    }
                  } else {
                    const result = await githubChatApi.startIdentity(bot.id);
                    window.location.assign(result.authorizationUrl);
                  }
                },
                existingIdentityMethod && !legacyAccount,
              )}
            </>
          )}
        </>
      ) : state?.state === "install" ? (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.waitingForGitHubInstallationOrAdministratorApproval")}
          </p>
          {state.installationUrl && (
            <a
              className="inline-flex items-center gap-1 text-sm underline"
              href={state.installationUrl}
            >
              {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.continueInstallationOnGitHub")}
              <ExternalLink className="size-3" />
            </a>
          )}
          {footer()}
        </>
      ) : state?.state === "enrollment" ? (
        <>
          <p className="text-sm">
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.paperclipCloudReceivesGitHubEventsAndSecurelyDeliversThem")}
          </p>
          {footer("Connect Paperclip Cloud", async () => {
            const result = await toolsApi.startCloudConnectorEnrollment(
              selectedCompanyId!,
              undefined,
              `/apps/chat/connect${window.location.search}`,
            );
            if (!result.verificationUrl)
              throw new Error(translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.cloudEnrollmentCouldNotBeStarted"));
            window.location.assign(result.verificationUrl);
          })}
        </>
      ) : state?.state === "recovery" ? (
        <>
          <p role="status" className="text-sm">
            {state.message}
          </p>
          <Button variant="ghost" onClick={() => setExisting(true)}>
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.useExistingAppCredentials")}
          </Button>
          {state.restartableRegistrationId && (
            <div className="flex items-center gap-2">
              <Checkbox id="github-app-not-created" checked={appNotCreated} disabled={busy}
                onCheckedChange={(checked) => setAppNotCreated(checked === true)} />
              <Label htmlFor="github-app-not-created">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.iHavenTCreatedThisAppOnGitHub")}</Label>
            </div>
          )}
          {state.restartableRegistrationId
            ? footer("Continue to GitHub", async () => {
                const result = await githubChatApi.restartRegistration(bot.id, state.restartableRegistrationId!);
                setAppNotCreated(false);
                queryClient.setQueryData(["github-wizard", bot.id], result);
                if (result.registration) setSubmitManifest(true);
              }, !appNotCreated)
            : footer(t("app.issueUi.projectRepositoryInput.tryAgain"), refresh)}
        </>
      ) : state?.state === "verify" ? (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {deliveryVerifiedWhileChecking
              ? translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.gitHubDeliveryVerifiedCheckingAppAndRepositoryAccess")
              : state.message ?? translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.checkingGitHubAccess")}
          </p>
          {state.verification?.checks
            .filter(
              (check) =>
                !check.ok &&
                !(deliveryVerifiedWhileChecking && ["webhook", "delivery"].includes(check.key)),
            )
            .map((check) => (
              <p key={check.key} className="text-sm">
                {check.detail}
              </p>
            ))}
          <Link
            className="text-sm underline"
            to={`/apps/chat/${bot.id}/settings`}
          >
            {t("app.connections.remoteMcpManagement.connectionSettings")}
          </Link>
          {footer(t("app.issueUi.projectRepositoryInput.tryAgain"), refresh)}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="github-owner-type">{t("app.apps.identitiesSection.githubAccount")}</Label>
            <select
              id="github-owner-type"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={accountChoice}
              disabled={busy || !!state?.registration}
              onChange={(event) => {
                const choice = event.target.value;
                setOwnerType(choice === "personal" ? "personal" : "organization");
                setCustomOrganization(choice === "organization");
                if (choice.startsWith("organization:")) setOwnerLogin(choice.slice("organization:".length));
                else if (choice === "organization") setOwnerLogin("");
              }}
            >
              <option value="personal">{t("app.apps.railwayAccessPanel.myAccount")}</option>
              {knownOrganizations.map((login) => (
                <option key={login.toLowerCase()} value={`organization:${login}`}>{login}</option>
              ))}
              <option value="organization">{translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.anotherOrganization")}</option>
            </select>
            {(repositories.isError || connectedBots.isError) && (
              <p role="alert" className="text-sm text-destructive">
                {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.couldNotLoadSomeConnectedGitHubAccountsChooseAnother")}
              </p>
            )}
          </div>
          {accountChoice === "organization" && (
            <div className="space-y-2">
              <Label htmlFor="github-owner-login">{t("app.skills.skillStudio.organization")}</Label>
              <Input
                id="github-owner-login"
                disabled={busy || !!state?.registration}
                value={ownerLogin}
                onChange={(event) => setOwnerLogin(event.target.value)}
                placeholder={translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.gitHubOrganizationName")}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="github-app-name">{t("app.apps.appDetail.appName")}</Label>
            <Input
              id="github-app-name"
              disabled={busy || !!state?.registration}
              maxLength={34}
              value={
                name ||
                selectedAgent?.name?.slice(0, 34) ||
                bot.assignedAgentName?.slice(0, 34) ||
                "GitHub Reviewer"
              }
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <button
            className="text-sm text-muted-foreground underline"
            onClick={() => setExisting(true)}
          >
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubChatSetup.iAlreadyHaveAnApp")}
          </button>
          {state?.registration ? (
            <GitHubAppManifestForm registration={state.registration} onSaveExit={exit}
              disabled={busy} autoSubmit={submitManifest} onSubmit={() => setSubmitManifest(false)} />
          ) : footer(
            "Continue to GitHub",
            async () => {
              const result = await githubChatApi.registration(bot.id, appInput());
              queryClient.setQueryData(["github-wizard", bot.id], result);
              if (result.registration) setSubmitManifest(true);
            },
            progress.isPending || (ownerType === "organization" && !ownerLogin.trim()),
          )}
        </>
      )}
    </div>
  );
}
