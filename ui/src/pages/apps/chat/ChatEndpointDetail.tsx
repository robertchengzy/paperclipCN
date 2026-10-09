import { AgentAvatar } from "@/components/AgentAvatar";
import { Identity } from "@/components/Identity";
import { SlackSetupAdvanced } from "./SlackAppDetails";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SlackToolsSettings, SlackSearchAccess } from "./SlackToolSettings";
import { defaultSlackAppName } from "./slack-app-name";
import { ChatCommunicationInstructions } from "./ChatCommunicationInstructions";
import { SlackAvatarSettings } from "./SlackAvatarStep";
import { agentsApi } from "@/api/agents";
import { agentAvatarUrl } from "@/lib/agent-avatar-url";
import { resolveAgentAppearance } from "@paperclipai/shared";
import { GitHubBotManagement, GitHubReviews } from "./GitHubBotManagement";
import { EmailEndpointSettings } from "./EmailEndpointSetup";
import { EmailConnectionAccess } from "@/components/EmailConnectionAccess";
import { emailApi } from "@/api/email";
import { toolsApi } from "@/api/tools";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Check,
  Activity as ActivityIcon,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Unlink,
} from "lucide-react";
import {
  chatEndpointsApi,
  type ChatActivityItem,
  type ChatEndpoint,
  type ChatEndpointResource,
  type ChatProvider,
} from "@/api/chatEndpoints";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { AppLogo } from "../AppLogo";
import { StatusBadge } from "@/components/StatusBadge";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { formatDateTime } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Link, Navigate, useNavigate, useParams } from "@/lib/router";
import { t as translate, useTranslation } from "@/i18n";
import { Trans } from "react-i18next";

const tabs = ["settings", "access", "reviews", "conversations", "activity"] as const;
type ChatTab = (typeof tabs)[number];
function chatTabLabel(value: ChatTab): string {
  switch (value) {
    case "settings":
      return translate("app.common.nouns.settings");
    case "access":
      return translate("app.common.nouns.access");
    case "reviews":
      return translate("app.apps.chatEndpointDetail.tabs.reviews");
    case "conversations":
      return translate("app.apps.chatEndpointDetail.tabs.conversations");
    case "activity":
      return translate("app.common.nouns.activity");
  }
}
const providerNames: Record<ChatProvider, string> = {
  agentmail: "AgentMail",
  slack: "Slack",
  github: "GitHub",
  discord: "Discord",
  "microsoft-teams": "Microsoft Teams",
  telegram: "Telegram",
  "imessage-photon": "iMessage Photon",
};

function providerLifecycleGuidance(provider: ChatProvider): {
  reconnect: string;
  remove: string;
} {
  switch (provider) {
    case "agentmail":
      return {
        reconnect: translate("app.apps.chatEndpointDetail.lifecycle.agentmail.reconnect"),
        remove: translate("app.apps.chatEndpointDetail.lifecycle.agentmail.remove"),
      };
    case "slack":
      return {
        reconnect: translate("app.apps.chatEndpointDetail.lifecycle.slack.reconnect"),
        remove: translate("app.apps.chatEndpointDetail.lifecycle.slack.remove"),
      };
    case "github":
      return {
        reconnect: translate("app.apps.chatEndpointDetail.lifecycle.github.reconnect"),
        remove: translate("app.apps.chatEndpointDetail.lifecycle.github.remove"),
      };
    case "discord":
      return {
        reconnect: translate("app.apps.chatEndpointDetail.lifecycle.discord.reconnect"),
        remove: translate("app.apps.chatEndpointDetail.lifecycle.discord.remove"),
      };
    case "microsoft-teams":
      return {
        reconnect: translate("app.apps.chatEndpointDetail.lifecycle.teams.reconnect"),
        remove: translate("app.apps.chatEndpointDetail.lifecycle.teams.remove"),
      };
    case "imessage-photon":
      return {
        reconnect: translate("app.apps.chatEndpointDetail.lifecycle.photon.reconnect"),
        remove: translate("app.apps.chatEndpointDetail.lifecycle.photon.remove"),
      };
    case "telegram":
      return {
        reconnect: translate("app.apps.chatEndpointDetail.lifecycle.telegram.reconnect"),
        remove: translate("app.apps.chatEndpointDetail.lifecycle.telegram.remove"),
      };
  }
}

function activityKindLabel(kind: ChatActivityItem["kind"]): string {
  switch (kind) {
    case "delivery":
      return translate("app.apps.chatEndpointDetail.kind.delivery");
    case "publication":
      return translate("app.apps.chatEndpointDetail.kind.publication");
    case "action":
      return translate("app.apps.chatEndpointDetail.kind.action");
    case "health":
      return translate("app.apps.chatEndpointDetail.kind.health");
    case "repair":
      return translate("app.apps.chatEndpointDetail.kind.repair");
  }
}

const replayableFailureStates = new Set(["failed"]);
// Provider callbacks do not necessarily emit a Board activity event. Refresh
// only mounted operational views, and stop polling when the browser is hidden.
const liveChatQueryOptions = {
  staleTime: 0,
  refetchInterval: 5_000,
  refetchIntervalInBackground: false,
} as const;

export function isReplayEligible(item: ChatActivityItem): boolean {
  if (
    item.fileTransfer ||
    !item.replayable ||
    !replayableFailureStates.has(item.status)
  ) {
    return false;
  }
  if (item.kind === "delivery") return item.status === "failed";
  return item.kind === "publication";
}

export function activityResolutionActions(item: ChatActivityItem) {
  const offered = item.resolutionActions ?? [];
  if (!item.fileTransfer) return offered;
  if (
    item.kind !== "publication" ||
    !Number.isSafeInteger(item.fileTransfer.version) ||
    item.fileTransfer.version < 1
  )
    return [];
  if (
    ![
      "consent_unknown",
      "upload_unknown",
      "file_info_unknown",
      "conflict",
    ].includes(item.fileTransfer.phase)
  )
    return [];
  // Only the file-info stage can use ordinary visible-delivery resolution.
  // Earlier consent/upload evidence must not be fabricated by these buttons.
  return item.fileTransfer.phase === "file_info_unknown"
    ? offered
    : offered.filter((action) => action === "cancel");
}

export function activityResolutionDescription(item: ChatActivityItem): string {
  const phase = item.fileTransfer?.phase;
  if (phase === "file_info_unknown")
    return translate("app.apps.chatEndpointDetail.resolution.fileInfoUnknown");
  if (phase === "consent_unknown")
    return translate("app.apps.chatEndpointDetail.resolution.consentUnknown");
  if (phase)
    return translate("app.apps.chatEndpointDetail.resolution.uploadUnknown");
  return translate("app.apps.chatEndpointDetail.resolution.sendUnknown");
}

export function isResolutionEligible(item: ChatActivityItem): boolean {
  return (
    (item.kind === "publication" || item.kind === "action") &&
    item.status === "delivery_unknown" &&
    activityResolutionActions(item).length > 0
  );
}

export function isIndividuallyToggleableResource(
  provider: ChatProvider,
  resourceType: string,
): boolean {
  return !(
    provider === "microsoft-teams" &&
    (resourceType === "direct_message" || resourceType === "group_chat")
  );
}

function activityDetailLabel(item: ChatActivityItem): string {
  return replayableFailureStates.has(item.status)
    ? translate("app.common.labels.reason")
    : translate("app.common.labels.details");
}

export function connectionHealthPresentation(
  endpoint: Pick<ChatEndpoint, "status" | "healthMessage" | "lastError">,
) {
  // Health events outlive pause/removal. They are history, not lifecycle state.
  const lifecycleMessages = {
    draft: translate("app.apps.chatEndpointDetail.lifecycleMessage.draft"),
    verifying: translate("app.apps.chatEndpointDetail.lifecycleMessage.verifying"),
    paused: translate("app.apps.chatEndpointDetail.lifecycleMessage.paused"),
    attention: translate("app.apps.chatEndpointDetail.lifecycleMessage.attention"),
    revoked: translate("app.apps.chatEndpointDetail.lifecycleMessage.revoked"),
    archived: translate("app.apps.chatEndpointDetail.lifecycleMessage.archived"),
  };
  const lifecycleMessage =
    endpoint.status === "active" ? null : lifecycleMessages[endpoint.status];
  return {
    message: lifecycleMessage ?? endpoint.healthMessage ?? null,
    previousHealth: lifecycleMessage ? (endpoint.healthMessage ?? null) : null,
    error: endpoint.lastError ?? null,
    errorLabel: ["active", "attention", "revoked"].includes(endpoint.status)
      ? translate("app.common.labels.reason")
      : translate("app.apps.chatEndpointDetail.lastReportedError"),
  };
}

export function ChatEndpointDetail() {
  const { t } = useTranslation();
  const { endpointId = "", tab = "settings" } = useParams<{
    endpointId: string;
    tab?: string;
  }>();
  const activeTab = tabs.includes(tab as ChatTab) ? (tab as ChatTab) : null;
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumbs();
  const endpointQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.detail(endpointId),
    queryFn: () => chatEndpointsApi.get(endpointId),
    enabled: Boolean(endpointId && activeTab),
    ...liveChatQueryOptions,
    refetchInterval:
      activeTab === "activity" || activeTab === "conversations"
        ? liveChatQueryOptions.refetchInterval
        : false,
  });
  const endpoint = endpointQuery.data;
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const agentQuery = useQuery({
    queryKey: queryKeys.agents.detail(endpoint?.assignedAgentId ?? ""),
    queryFn: () => agentsApi.get(endpoint!.assignedAgentId, endpoint!.companyId),
    enabled: Boolean(endpoint?.assignedAgentId),
  });

  useEffect(() => {
    if (!endpoint || !activeTab) return;
    setBreadcrumbs([
      { label: t("app.common.nouns.connectors"), href: "/apps" },
      {
        label: `${endpoint.assignedAgentName} · ${providerNames[endpoint.provider]}`,
        href: `/apps/chat/${endpoint.id}/settings`,
      },
      {
        label: chatTabLabel(activeTab),
      },
    ]);
    return () => setBreadcrumbs([]);
  }, [activeTab, endpoint, setBreadcrumbs, t]);

  if (!activeTab)
    return <Navigate replace to={`/apps/chat/${endpointId}/settings`} />;
  if (endpointQuery.isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("app.apps.chatEndpointDetail.loadingConnection")}
      </div>
    );
  if (endpointQuery.isError || !endpoint)
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {t("app.apps.chatEndpointDetail.loadFailed")}
        </p>
        <Button variant="outline" onClick={() => endpointQuery.refetch()}>
          {t("app.common.actions.tryAgain")}
        </Button>
      </div>
    );
  if (endpoint.provider === "agentmail" && activeTab === "settings")
    return <EmailEndpointSettings key={endpoint.id} endpointId={endpoint.id} companyId={endpoint.companyId} assignedAgentName={endpoint.assignedAgentName} />;
  const setupIncomplete =
    endpoint.setup?.step !== "complete" &&
    !(endpoint.provider === "slack" && endpoint.setup?.step === "test") &&
    ["draft", "verifying", "attention", "revoked"].includes(endpoint.status);
  const slackUrl = endpoint.provider === "slack" && endpoint.providerAccountId && endpoint.botExternalId
    ? `https://app.slack.com/client/${encodeURIComponent(endpoint.providerAccountId)}/user/${encodeURIComponent(endpoint.botExternalId)}`
    : null;

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <AgentAvatar agent={agentQuery.data ?? { id: endpoint.assignedAgentId, name: endpoint.assignedAgentName }} size={48} />
          <div>
          <h1 className="text-xl font-bold">
            {endpoint.assignedAgentName}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <AppLogo name={providerNames[endpoint.provider]} brandKey={endpoint.provider} size={16} compact />
            {endpoint.providerAccountLabel ?? (endpoint.provider === "agentmail" ? endpoint.botExternalId ?? t("app.apps.chatEndpointDetail.emailConnection") : t("app.apps.chatEndpointDetail.chatConnection"))}
          </p>
          {endpoint.provider === "imessage-photon" && endpoint.botExternalId && endpoint.photonAllocation !== "shared" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>{endpoint.botExternalId}</span>
              <Button variant="ghost" size="sm" aria-label={t("app.apps.chatEndpointDetail.copyDedicatedNumber")} onClick={async () => {
                try { await copyTextToClipboard(endpoint.botExternalId!); setCopyStatus(t("app.apps.chatEndpointDetail.numberCopied")); }
                catch { setCopyStatus(t("app.apps.chatEndpointDetail.numberCopyFailed")); }
              }}><Copy className="size-4" />{t("app.apps.chatEndpointDetail.copyNumber")}</Button>
              <span role="status" className="text-muted-foreground">{copyStatus}</span>
            </div>
          )}
        </div>
        </div>
        <div className="flex items-center gap-2">
          {slackUrl && <Button asChild variant="outline"><a href={slackUrl} target="_blank" rel="noopener noreferrer">Open Slack <ExternalLink className="size-4" /></a></Button>}
          {setupIncomplete ? (
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  `/apps/chat/connect?provider=${endpoint.provider}&purpose=chat&resume=${endpoint.id}`,
                )
              }
            >
              {t("app.apps.chatEndpointDetail.continueSetup")}
            </Button>
          ) : null}
          {["paused", "attention", "revoked"].includes(endpoint.status) && <StatusBadge status={endpoint.status} />}
        </div>
      </header>
      {activeTab === "settings" && (
        <>
{endpoint.provider === "github" && <GitHubBotManagement endpoint={endpoint} view="settings" />}
{endpoint.provider !== "github" && <Settings endpointId={endpoint.id} endpoint={endpoint} />}
</>
      )}
      {activeTab === "reviews" && endpoint.provider === "github" && <GitHubReviews endpointId={endpoint.id} />}
{activeTab === "access" && endpoint.provider === "github" && <GitHubBotManagement endpoint={endpoint} view="access" />}
{activeTab === "access" && endpoint.provider === "agentmail" && <EmailAccess endpoint={endpoint} />}
{activeTab === "access" && endpoint.provider !== "github" && endpoint.provider !== "agentmail" && (
        <Access
          endpointId={endpoint.id}
          allowUnlinked={endpoint.allowUnlinkedPeople}
          endpoint={endpoint}
        />
      )}
      {activeTab === "conversations" && (
        <Conversations endpointId={endpoint.id} provider={endpoint.provider} />
      )}
      {activeTab === "activity" && (
        <Activity endpointId={endpoint.id} endpoint={endpoint} />
      )}
    </div>
  );
}

function EmailAccess({ endpoint }: { endpoint: ChatEndpoint }) {
  const connection = useQuery({
    queryKey: queryKeys.tools.connection(endpoint.connectionId ?? ""),
    queryFn: () => toolsApi.getConnection(endpoint.connectionId!),
    enabled: Boolean(endpoint.connectionId),
  });
  const agents = useQuery({
    queryKey: queryKeys.agents.list(endpoint.companyId),
    queryFn: () => agentsApi.list(endpoint.companyId),
  });
  if (!endpoint.connectionId || agents.isError || connection.isError) return (
    <div className="space-y-3">
      <p role="alert" className="text-sm text-destructive">Connection access could not be loaded.</p>
      <Button variant="outline" onClick={() => { void agents.refetch(); void connection.refetch(); }}>Try again</Button>
    </div>
  );
  if (agents.isPending || connection.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading access…</p>;
  const sourceId = connection.data.config?.credentialConnectionId;
  const credentialId = typeof sourceId === "string" ? sourceId : endpoint.connectionId;
  return <section className="max-w-3xl space-y-4">
    <h2 className="text-lg font-semibold">Access</h2>
    {credentialId !== endpoint.connectionId && <p className="text-sm text-muted-foreground">These settings apply to the saved AgentMail account and all inboxes using it.</p>}
    <EmailConnectionAccess key={credentialId} companyId={endpoint.companyId} connectionId={credentialId} agents={agents.data} />
  </section>;
}

function Settings({
  endpointId,
  endpoint,
}: {
  endpointId: string;
  endpoint: Awaited<ReturnType<typeof chatEndpointsApi.get>>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [messageCopied, setMessageCopied] = useState(false);
  const avatarAgent = useQuery({
    queryKey: queryKeys.agents.detail(endpoint.assignedAgentId),
    queryFn: () => agentsApi.get(endpoint.assignedAgentId, endpoint.companyId),
    enabled: endpoint.provider === "slack",
  });
  const mentionMessage = `@${(endpoint.botUsername ?? endpoint.botLabel ?? endpoint.assignedAgentName).replace(/^@/, "")} you there?`;
  const resourcesQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.resources(endpointId),
    queryFn: () => chatEndpointsApi.listResources(endpointId),
    ...(endpoint.provider === "slack" ? liveChatQueryOptions : {}),
  });
  const saveResources = useMutation({
    mutationFn: (resource: Pick<ChatEndpointResource, "id" | "enabled">) =>
      chatEndpointsApi.updateResources(endpointId, [resource]),
    onSuccess: (resources) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.resources(endpointId),
        resources,
      ),
    onError: (error) =>
      pushToast({
        title: t("app.apps.chatEndpointDetail.updateDestinationFailed"),
        body: error instanceof Error ? error.message : t("app.common.messages.tryAgain"),
        tone: "error",
      }),
  });
  const updateEndpoint = useMutation({
    mutationFn: chatEndpointsApi.update.bind(null, endpointId),
    onSuccess: (next) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.detail(endpointId),
        next,
      ),
    onError: (error) =>
      pushToast({
        title: t("app.apps.chatEndpointDetail.updateSettingsFailed"),
        body: error instanceof Error ? error.message : t("app.common.messages.tryAgain"),
        tone: "error",
      }),
  });
  const resources = resourcesQuery.data ?? [];
  const destinationResources = resources.filter((resource) =>
    isIndividuallyToggleableResource(endpoint.provider, resource.type),
  );
  const toggleResource = (resource: ChatEndpointResource, enabled: boolean) =>
    // A cached inventory must not overwrite another operator's unrelated edits.
    saveResources.mutate({ id: resource.id, enabled });
  return (
    <section className="max-w-3xl space-y-7">
      {endpoint.provider === "imessage-photon" && <p className="text-sm text-muted-foreground">{endpoint.photonAllocation === "shared" ? t("app.apps.chatEndpointDetail.photonShared") : t("app.apps.chatEndpointDetail.photonGroups")}</p>}
      {endpoint.provider === "telegram" && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("app.apps.chatEndpointDetail.telegramGroupCommand")}</h2>
          <div className="rounded-lg border border-border p-3 text-sm">
            <code>
              /task@
              {endpoint.botUsername?.replace(/^@/, "") ?? "bot_username"}{" "}
              &lt;request&gt;
            </code>
            <p className="mt-2 text-muted-foreground">
              {t("app.apps.chatEndpointDetail.telegramPrivacyHelp")}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{endpoint.provider === "slack" ? t("app.apps.chatEndpointDetail.allowedChannels") : t("app.apps.chatEndpointDetail.destinations")}</h3>
        {resourcesQuery.isError ? <p role="alert" className="text-sm text-destructive">Couldn't load channels. <button className="underline" onClick={() => void resourcesQuery.refetch()}>Try again</button></p> : resourcesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("app.apps.chatEndpointDetail.loadingDestinations")}</p>
        ) : destinationResources.length === 0 && endpoint.provider !== "slack" ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No destinations yet.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {destinationResources.map((resource) => (
              <div key={resource.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {resource.label}
                  </p>
                  {(resource.availability !== "available" || resource.detail) && <p className="text-xs text-muted-foreground">
                    {resource.availability === "available"
                      ? resource.detail
                      : t("app.apps.chatEndpointDetail.unavailableAtProvider")}
                  </p>}
                  {resource.participants?.length ? <p className="mt-1 break-words text-xs text-muted-foreground">{t("app.apps.chatEndpointDetail.participants", { participants: resource.participants.join(", ") })}</p> : null}
                </div>
                <ToggleSwitch
                  aria-label={t("app.apps.chatEndpointDetail.enableResource", { label: resource.label })}
                  checked={resource.enabled}
                  disabled={
                    endpoint.photonAllocation === "shared" ||
                    resource.availability !== "available" ||
                    saveResources.isPending
                  }
                  onCheckedChange={(enabled) =>
                    toggleResource(resource, enabled)
                  }
                />
              </div>
            ))}
            {endpoint.provider === "slack" && (
              <p className="py-3 text-sm text-muted-foreground">
                Invite {endpoint.assignedAgentName} to a channel to add it
              </p>
            )}
          </div>
        )}
      </div>
      {endpoint.provider !== "github" && (
        <div className="space-y-3">
          <SettingToggle
            label={t("app.apps.chatEndpointDetail.allowDirectMessages")}
            detail={
              endpoint.provider === "discord"
                ? t("app.apps.chatEndpointDetail.discordDmHelp")
                : undefined
            }
            checked={endpoint.allowDirectMessages ?? false}
            pending={updateEndpoint.isPending}
            onChange={(allowDirectMessages) =>
              updateEndpoint.mutate({ allowDirectMessages })
            }
          />
          {endpoint.provider === "microsoft-teams" && (
            <SettingToggle
              label={t("app.apps.chatEndpointDetail.allowGroupChats")}
              detail={t("app.apps.chatEndpointDetail.groupChatsHelp")}
              checked={endpoint.allowGroupChats ?? false}
              pending={updateEndpoint.isPending}
              onChange={(allowGroupChats) =>
                updateEndpoint.mutate({ allowGroupChats })
              }
            />
          )}
        </div>
      )}
      {endpoint.provider === "slack" && <ChatCommunicationInstructions
        key={endpoint.id}
        value={endpoint.communicationInstructions ?? ""}
        onSave={async (communicationInstructions) => {
          const next = await chatEndpointsApi.update(endpointId, { communicationInstructions });
          queryClient.setQueryData(queryKeys.chatEndpoints.detail(endpointId), next);
        }}
      />}
      {endpoint.provider === "slack" && (
        <SlackSetupAdvanced label="Message in a channel"><div className="space-y-2 text-sm">
          <p>Invite the bot to a channel, then mention it to start a conversation.</p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <code>{mentionMessage}</code>
            <Button size="icon" variant="ghost" aria-label={messageCopied ? "Message copied" : "Copy message"} onClick={() => {
              void copyTextToClipboard(mentionMessage).then(() => setMessageCopied(true), () => pushToast({ title: "Couldn’t copy the message", body: "Select and copy it manually.", tone: "error" }));
            }}>{messageCopied ? <Check className="size-4" /> : <Copy className="size-4" />}</Button>
          </div>
        </div></SlackSetupAdvanced>
      )}
      {endpoint.provider === "slack" && <SlackSetupAdvanced label="Agent avatar">
        {avatarAgent.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading agent avatar…</p>
          : avatarAgent.isError ? <p role="alert" className="text-sm text-destructive">Couldn’t load the agent’s avatar. <button className="underline" onClick={() => void avatarAgent.refetch()}>Try again</button></p>
          : <SlackAvatarSettings
              agentName={avatarAgent.data?.name ?? endpoint.assignedAgentName}
              appName={endpoint.setup?.slackApp?.appName ?? defaultSlackAppName(avatarAgent.data?.name ?? endpoint.assignedAgentName)}
              avatarUrl={agentAvatarUrl(resolveAgentAppearance(avatarAgent.data?.appearance, endpoint.assignedAgentId), 512, 1, "rest", false, "paperclip-dark")}
            />}
      </SlackSetupAdvanced>}
      {endpoint.provider === "slack" && <SlackSetupAdvanced label="Slack tools"><SlackToolsSettings companyId={endpoint.companyId} endpointId={endpointId} connectionId={endpoint.connectionId} /></SlackSetupAdvanced>}
    </section>
  );
}

function SettingToggle({
  label,
  detail,
  checked,
  pending,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  pending: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-y border-border py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <ToggleSwitch
        aria-label={label}
        checked={checked}
        disabled={pending}
        onCheckedChange={onChange}
      />
    </div>
  );
}

function Access({
  endpointId,
  allowUnlinked,
  endpoint,
}: {
  endpointId: string;
  allowUnlinked: boolean;
  endpoint: ChatEndpoint;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);
  const [joinCommandCopied, setJoinCommandCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [confirmationFor, setConfirmationFor] = useState<string | null>(null);
  const joinCommand = `${endpoint.setup?.slackApp?.command ?? endpoint.setup?.command ?? "/paperclip"} connect`;
  const linksQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.principals(endpointId),
    queryFn: () => chatEndpointsApi.listPrincipals(endpointId),
    refetchInterval: 5000,
  });
  const updatePolicy = useMutation({
    mutationFn: (value: boolean) =>
      chatEndpointsApi.update(endpointId, { allowUnlinkedPeople: value }),
    onSuccess: (next) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.detail(endpointId),
        next,
      ),
    onError: (error) => pushToast({ title: t("app.apps.chatEndpointDetail.updateAccessFailed"), body: error instanceof Error ? error.message : t("app.common.messages.tryAgain"), tone: "error" }),
  });
  const createIntent = useMutation({
    mutationFn: (principalId: string) =>
      chatEndpointsApi.createLinkIntent(endpointId, principalId),
    onSuccess: ({ confirmationUrl }) => {
      setConfirmationUrl(
        new URL(confirmationUrl, window.location.origin).toString(),
      );

    },
    onError: (error) =>
      pushToast({
        title: t("app.apps.chatEndpointDetail.identityLinkFailed"),
        body: error instanceof Error ? error.message : t("app.common.messages.tryAgain"),
        tone: "error",
      }),
  });
  const revoke = useMutation({
    mutationFn: (principalId: string) =>
      chatEndpointsApi.revokeLink(endpointId, principalId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chatEndpoints.principals(endpointId) }),
    onError: (error) => pushToast({ title: "Couldn't disconnect account", body: error instanceof Error ? error.message : "Try again.", tone: "error" }),
  });
  const links = linksQuery.data ?? [];
  return (
    <section className="max-w-3xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">People</h2>
        {endpoint.provider === "slack" && <Dialog>
          <DialogTrigger asChild><Button>Invite people</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite people to talk to {endpoint.assignedAgentName}</DialogTitle>
              <DialogDescription>Share these instructions with someone in your Slack workspace.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <ol className="list-decimal space-y-3 pl-5">
                <li>Send <code className="font-mono">{joinCommand}</code> in Slack.</li>
                <li>Open the bot’s private link and sign in to Paperclip to confirm your Slack account.</li>
                <li>If you’re new to this organization, request access and wait for an admin to approve.</li>
              </ol>
              <p className="text-muted-foreground">The confirmation link is personal and expires after 15 minutes.</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => {
                  void copyTextToClipboard(joinCommand).then(() => setJoinCommandCopied(true), () => pushToast({ title: t("app.apps.chatEndpointDetail.copyCommandFailed"), tone: "error" }));
                }}>{joinCommandCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{joinCommandCopied ? t("app.common.actions.copied") : t("app.apps.chatEndpointDetail.copyCommand")}</Button>
                <Button onClick={() => {
                  const workspace = endpoint.providerAccountId ? `https://app.slack.com/client/${encodeURIComponent(endpoint.providerAccountId)}` : "https://app.slack.com/";
                  void copyTextToClipboard(`Talk to ${endpoint.assignedAgentName} in Slack: ${workspace}\nSend ${joinCommand}, then open the bot’s private link and sign in to Paperclip to confirm your account. If you’re new to the organization, request access for an admin to approve.`).then(() => setInviteCopied(true), () => pushToast({ title: "Couldn't copy invitation", tone: "error" }));
                }}>{inviteCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{inviteCopied ? "Invitation copied" : "Copy invitation"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>}
      </div>
      <p className="text-sm text-muted-foreground">People with linked accounts use their own Paperclip permissions. <Link className="underline underline-offset-4" to="/company/settings/members">Manage members</Link></p>
      {confirmationUrl && (
        <div className="space-y-2 border-y border-border py-3">
          <p className="text-sm font-medium">Confirm {confirmationFor ?? "this account"}</p>
          <p className="text-xs text-muted-foreground">Share only with this person. They must sign in and confirm their own account.</p>
          <p className="break-all text-xs text-muted-foreground">
            {confirmationUrl}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void copyTextToClipboard(confirmationUrl).then(
                () =>
                  pushToast({
                    title: t("app.apps.chatEndpointDetail.confirmationLinkCopied"),
                    tone: "success",
                  }),
                () =>
                  pushToast({
                    title: t("app.apps.chatEndpointDetail.copyLinkFailed"),
                    body: t("app.apps.chatEndpointDetail.copyManually"),
                    tone: "error",
                  }),
              );
            }}
          >
            <Copy />
            {t("app.common.actions.copyLink")}
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {linksQuery.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading people…</p> : linksQuery.isError ? <p role="alert" className="text-sm text-destructive">Couldn't load people. <button className="underline" onClick={() => void linksQuery.refetch()}>Try again</button></p> : links.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No linked accounts yet. Invite someone to connect.
          </p>
        ) : (
          <div role="list" aria-label="People" className="divide-y divide-border border-y border-border">
            {links.map((link) => (
              <div
                key={link.id}
                role="listitem"
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Identity name={link.paperclipUserLabel ?? link.externalLabel} size="default" className="gap-2" />
                  {(link.status !== "linked" || link.externalLabel !== link.paperclipUserLabel) && <p className="pl-10 text-xs text-muted-foreground">
                    {link.status === "revoked" ? "Disconnected" : link.status === "linked"
                      ? link.externalLabel
                      : "Waiting for account confirmation"}
                  </p>}
                </div>
                {link.status === "linked" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(link.principalId)}
                  >
                    <Unlink />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={createIntent.isPending}
                    onClick={() => { setConfirmationUrl(null); setConfirmationFor(link.externalLabel); createIntent.mutate(link.principalId); }}
                  >
                    Create confirmation link
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <SlackSetupAdvanced label="Guest access">
        <SettingToggle label="Allow unlinked people"
          detail="People without linked accounts can start isolated tasks. They cannot approve actions, spend, or manage access. Requests are refused when isolation is unavailable."
          checked={allowUnlinked} pending={updatePolicy.isPending} onChange={value => updatePolicy.mutate(value)} />
      </SlackSetupAdvanced>
      {endpoint.provider === "slack" && <SlackSetupAdvanced label="Personal Slack search"><SlackSearchAccess companyId={endpoint.companyId} endpointId={endpointId} /></SlackSetupAdvanced>}
    </section>
  );
}

function Conversations({
  endpointId,
  provider,
}: {
  endpointId: string;
  provider: ChatProvider;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: queryKeys.chatEndpoints.conversations(endpointId),
    queryFn: () => chatEndpointsApi.listConversations(endpointId),
    ...liveChatQueryOptions,
  });
  const rows = query.data ?? [];
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("app.apps.chatEndpointDetail.tabs.conversations")}</h2>
      </div>
      {query.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading conversations…</p> : query.isError ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">Conversations could not be loaded.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {provider === "agentmail"
            ? t("app.apps.chatEndpointDetail.noEmailConversations")
            : "No conversations yet. Message the agent to start one."}
        </p>
      ) : (
        <ul aria-label={t("app.apps.chatEndpointDetail.tabs.conversations")} className="divide-y divide-border overflow-x-auto border-y border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-2 py-3 text-sm transition-colors hover:bg-accent/50">
              <AppLogo name={providerNames[provider]} brandKey={provider} compact className="size-5! rounded-sm bg-transparent" />
              <div className="flex min-w-0 max-w-56 items-center gap-2">
                {row.externalUrl ? <a href={row.externalUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium hover:underline"><span className="truncate">{row.externalLabel}</span><ExternalLink className="size-3 shrink-0" /></a> : <span className="truncate font-medium">{row.externalLabel}</span>}
              </div>
              <span aria-hidden="true" className="hidden text-muted-foreground sm:inline">·</span>
              <div className="order-last flex min-w-0 basis-full items-center gap-2 pl-8 sm:order-none sm:flex-1 sm:basis-0 sm:pl-0">
                {row.issueId ? <Link to={`/issues/${row.issueId}`} className="line-clamp-2 hover:underline sm:truncate" title={row.issueTitle ?? undefined}>{row.issueTitle ?? row.issueIdentifier ?? "View task"}</Link> : <span className="truncate text-muted-foreground">{t("app.apps.chatEndpointDetail.waitingForTask")}</span>}
              </div>
              <span className="hidden shrink-0 text-xs text-muted-foreground xl:inline">{row.issueIdentifier}</span>
              {row.state !== "active" && <StatusBadge status={row.state} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Activity({
  endpointId,
  endpoint,
}: {
  endpointId: string;
  endpoint: Awaited<ReturnType<typeof chatEndpointsApi.get>>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [resolutionItem, setResolutionItem] = useState<ChatActivityItem | null>(
    null,
  );
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[cursors.length - 1];
  useEffect(() => setCursors([undefined]), [endpointId]);
  const query = useQuery({
    queryKey: [...queryKeys.chatEndpoints.activity(endpointId), cursor ?? null],
    queryFn: () => chatEndpointsApi.listActivityPage(endpointId, cursor),
    ...liveChatQueryOptions,
    refetchInterval: cursor ? false : liveChatQueryOptions.refetchInterval,
  });
  const replay = useMutation({
    mutationFn: (item: ChatActivityItem) =>
      item.kind === "publication"
        ? chatEndpointsApi.replayPublication(endpointId, item.id)
        : chatEndpointsApi.replayDelivery(endpointId, item.id),
    onSuccess: async (_result, item) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.activity(endpointId),
      });
      pushToast({
        title:
          item.kind === "publication"
            ? t("app.apps.chatEndpointDetail.toast.publicationReplayQueued")
            : t("app.apps.chatEndpointDetail.toast.deliveryReplayQueued"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("app.apps.chatEndpointDetail.toast.replayFailed"),
        body: error instanceof Error ? error.message : t("app.common.messages.tryAgain"),
        tone: "error",
      }),
  });
  const resolveActivity = useMutation({
    mutationFn: (input: {
      item: ChatActivityItem;
      action: "mark_delivered" | "retry_anyway" | "cancel";
    }) => {
      if (input.item.kind === "publication") {
        return chatEndpointsApi.resolvePublication(
          endpointId,
          input.item.id,
          input.action,
          input.item.fileTransfer
            ? {
                phase: input.item.fileTransfer.phase,
                version: input.item.fileTransfer.version,
              }
            : undefined,
        );
      }
      return chatEndpointsApi.resolveAction(
        endpointId,
        input.item.id,
        input.action,
      );
    },
    onSuccess: async (_result, input) => {
      setResolutionItem(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.activity(endpointId),
      });
      pushToast({
        title:
          input.item.actionType === "slash_task_start" &&
          input.action === "retry_anyway"
            ? t("app.apps.chatEndpointDetail.toast.taskStartRetried")
            : input.item.actionType === "slash_task_start"
              ? t("app.apps.chatEndpointDetail.toast.taskStartCancelled")
              : input.item.actionType === "provider_effect" &&
                  input.action === "mark_delivered"
                ? t("app.apps.chatEndpointDetail.toast.providerReplyMarkedDelivered")
                : input.item.actionType === "provider_effect" &&
                    input.action === "retry_anyway"
                  ? t("app.apps.chatEndpointDetail.toast.providerReplyRetried")
                  : input.item.actionType === "provider_effect"
                    ? t("app.apps.chatEndpointDetail.toast.providerReplyCancelled")
                    : input.action === "mark_delivered"
                      ? t("app.apps.chatEndpointDetail.toast.publicationMarkedDelivered")
                      : input.action === "retry_anyway"
                        ? t("app.apps.chatEndpointDetail.toast.publicationRetryQueued")
                        : t("app.apps.chatEndpointDetail.toast.publicationCancelled"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("app.apps.chatEndpointDetail.toast.resolveFailed"),
        body: error instanceof Error ? error.message : t("app.common.messages.tryAgain"),
        tone: "error",
      }),
  });
  const lifecycle = useMutation({
    mutationFn: async (action: "pause" | "resume" | "remove") =>
      endpoint.provider === "agentmail"
        ? emailApi.control(endpointId, action)
        : chatEndpointsApi.setup(endpointId, { action }),
    onSuccess: async (next, action) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.list(next.companyId),
      });
      if (endpoint.provider === "agentmail") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["email-inboxes", next.companyId] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.chatEndpoints.detail(endpointId) }),
        ]);
      }
      if (action === "remove") {
        navigate("/apps");
        return;
      }
      if (endpoint.provider !== "agentmail") queryClient.setQueryData(queryKeys.chatEndpoints.detail(endpointId), next);
      pushToast({
        title: action === "pause" ? t("app.apps.chatEndpointDetail.toast.connectionPaused") : t("app.apps.chatEndpointDetail.toast.connectionResumed"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("app.apps.chatEndpointDetail.toast.updateConnectionFailed"),
        body: error instanceof Error ? error.message : t("app.common.messages.tryAgain"),
        tone: "error",
      }),
  });
  const rows = query.data?.items ?? [];
  const { status } = endpoint;
  const health = connectionHealthPresentation(endpoint);
  const lifecycleAction = lifecycle.variables;
  const callbackSurfaceRows = endpoint.setup?.callbackSurfaces
    ? ([
        ["Events API", endpoint.setup.callbackSurfaces.events],
        ["Interactivity", endpoint.setup.callbackSurfaces.interactivity],
        ["Slash command", endpoint.setup.callbackSurfaces.slashCommands],
      ] as const)
    : [];
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-semibold">{t("app.apps.chatEndpointDetail.connectionActivity")}</h2>
      {((status !== "active" && health.message) || health.error) && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${status === "attention" || status === "revoked" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/30 text-foreground"}`}
        >
          {(status === "attention" || status === "revoked") && (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            {health.message && <p>{health.message}</p>}
            {health.previousHealth && (
              <p className="mt-1 text-xs opacity-80">
                <span className="font-medium">{t("app.apps.chatEndpointDetail.lastReportedHealth")}</span>{" "}
                {health.previousHealth}
              </p>
            )}
            {health.error && (
              <p className="mt-1 text-xs opacity-80">
                <span className="font-medium">{health.errorLabel}:</span>{" "}
                {health.error}
              </p>
            )}
          </div>
        </div>
      )}
      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium chat-connection-health-summary">
          <span>{t("app.apps.chatEndpointDetail.healthAndControls")}</span>
          <span className="flex items-center gap-2">
            {endpoint.setup?.callbacksNeedUpdate && <span className="text-xs text-(--status-task-blocked)">{t("app.apps.chatEndpointDetail.callbacksNeedAttention")}</span>}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="space-y-5 border-t border-border p-4">
      {endpoint.provider === "slack" && callbackSurfaceRows.length > 0 && (
        <div
          className="space-y-3 text-sm"
        >
          <p className="font-medium">{t("app.apps.chatEndpointDetail.slackCallbackHealth")}</p>
          <p className="text-xs text-muted-foreground">
            {endpoint.setup?.callbacksNeedUpdate
              ? t("app.apps.chatEndpointDetail.slackCallbacksNeedUpdate")
              : t("app.apps.chatEndpointDetail.slackCallbacksHelp")}
          </p>
          <div className="divide-y divide-border border-y border-border">
            {callbackSurfaceRows.map(([label, surface]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <p className="text-xs font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {surface.status === "current"
                    ? t("app.common.labels.current")
                    : surface.status === "stale"
                      ? t("app.apps.chatEndpointDetail.staleUrl")
                      : t("app.apps.chatEndpointDetail.notObserved")}
                </p>
                {surface.observedAt && (
                  <p className="text-xs text-muted-foreground">
                    {t("app.apps.chatEndpointDetail.lastObserved")}{" "}
                    <time
                      dateTime={surface.observedAt}
                      title={surface.observedAt}
                      className="font-mono"
                    >
                      {formatDateTime(surface.observedAt, {
                        includeSeconds: true,
                      })}
                    </time>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {status !== "archived" && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {status === "active" && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate("pause")}
              >
                {lifecycle.isPending && lifecycleAction === "pause" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Pause />
                )}
                {t("app.common.actions.pause")}
              </Button>
            )}
            {status === "paused" && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate("resume")}
              >
                {lifecycle.isPending && lifecycleAction === "resume" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play />
                )}
                {t("app.common.actions.resume")}
              </Button>
            )}
            {[
              "active",
              "paused",
              "attention",
              "revoked",
              "draft",
              "verifying",
            ].includes(status) && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() =>
                  navigate(
                    endpoint.provider === "agentmail" && status !== "draft" && status !== "verifying"
                      ? `/apps/chat/${endpoint.id}/settings`
                      : `/apps/chat/connect?provider=${endpoint.provider}&purpose=chat&resume=${endpoint.id}${status === "draft" || status === "verifying" ? "" : "&reconnect=1"}`,
                  )
                }
              >
                <RefreshCw />
                {status === "draft" || status === "verifying"
                  ? t("app.apps.chatEndpointDetail.finishSetup")
                  : t("app.common.actions.reconnect")}
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={lifecycle.isPending}
              onClick={() => setRemoveOpen(true)}
            >
              <Trash2 />
              {t("app.apps.chatEndpointDetail.removeConnection")}
            </Button>
          </div>
          {status !== "draft" && status !== "verifying" && (
            <p className="text-xs text-muted-foreground">
              {providerLifecycleGuidance(endpoint.provider).reconnect}
            </p>
          )}
        </div>
      )}
        </div>
      </details>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          {t("app.apps.chatEndpointDetail.recentActivity")}
        </h3>
        {endpoint.provider === "agentmail" && rows.some((item) => item.kind === "publication" && item.status === "delivery_unknown") && (
          <p className="text-sm text-muted-foreground">
            Review unconfirmed email delivery in the{" "}
            <Link to={`/apps/chat/${endpointId}/conversations`} className="underline underline-offset-4">conversation’s task</Link>.
          </p>
        )}
        <div className="divide-y divide-border border-y border-border">
          {query.isLoading && (
            <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("app.apps.chatEndpointDetail.loadingActivity")}
            </div>
          )}
          {query.isError && (
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <p className="text-sm text-destructive" role="alert">
                {t("app.apps.chatEndpointDetail.activityLoadFailed")}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => query.refetch()}
              >
                {t("app.common.actions.tryAgain")}
              </Button>
            </div>
          )}
          {!query.isLoading &&
            !query.isError &&
            rows.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-2 py-3 transition-colors hover:bg-accent/50"
              >
                <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
                  {item.kind === "delivery" ? <ArrowDownLeft className="size-4" /> : item.kind === "publication" ? <ArrowUpRight className="size-4" /> : <ActivityIcon className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 text-sm font-medium">{item.summary}</p>
                    <StatusBadge status={item.status} />
                    <time dateTime={item.createdAt} title={item.createdAt} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(item.createdAt, { includeSeconds: true })}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{activityKindLabel(item.kind)}</p>
                  {item.fileTransfer && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.fileTransfer.filename} —{" "}
                      {item.fileTransfer.phase.replaceAll("_", " ")}
                    </p>
                  )}
                  {item.detail && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {activityDetailLabel(item)}:
                      </span>{" "}
                      {item.detail}
                    </p>
                  )}
                </div>
                {endpoint.provider !== "agentmail" && isReplayEligible(item) && (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={t("app.apps.chatEndpointDetail.replayFailedKind", { kind: item.kind })}
                    disabled={replay.isPending}
                    onClick={() => replay.mutate(item)}
                  >
                    {replay.isPending && replay.variables?.id === item.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw />
                    )}
                    {t("app.apps.chatEndpointDetail.replay")}
                  </Button>
                )}
                {endpoint.provider !== "agentmail" && isResolutionEligible(item) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResolutionItem(item)}
                  >
                    {t("app.apps.chatEndpointDetail.resolve")}
                  </Button>
                )}
              </div>
            ))}
          {!query.isLoading && !query.isError && rows.length === 0 && (
            <p className="py-5 text-sm text-muted-foreground">
              {t("app.apps.chatEndpointDetail.noActivity")}
            </p>
          )}
        </div>
      </div>
      <nav aria-label={t("app.apps.chatEndpointDetail.pagination")} className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{t("app.apps.chatEndpointDetail.page", { page: cursors.length })}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={cursors.length === 1 || query.isFetching} onClick={() => setCursors((pages) => pages.slice(0, -1))}>{t("app.apps.chatEndpointDetail.previous")}</Button>
          <Button size="sm" variant="outline" disabled={!query.data?.nextCursor || query.isFetching || query.isError} onClick={() => { if (query.data?.nextCursor) setCursors((pages) => [...pages, query.data.nextCursor!]); }}>{t("app.apps.chatEndpointDetail.next")}</Button>
        </div>
      </nav>
      <AlertDialog
        open={resolutionItem !== null}
        onOpenChange={(open) => !open && setResolutionItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resolutionItem?.actionType === "slash_task_start"
                ? t("app.apps.chatEndpointDetail.resolveTaskStartTitle")
                : resolutionItem?.actionType === "provider_effect"
                  ? t("app.apps.chatEndpointDetail.resolveProviderReplyTitle")
                  : t("app.apps.chatEndpointDetail.resolveDeliveryTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resolutionItem?.actionType === "slash_task_start"
                ? t("app.apps.chatEndpointDetail.resolveTaskStartBody")
                : resolutionItem?.actionType === "provider_effect"
                  ? t("app.apps.chatEndpointDetail.resolveProviderReplyBody")
                  : resolutionItem
                    ? activityResolutionDescription(resolutionItem)
                    : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel disabled={resolveActivity.isPending}>
              {t("app.apps.chatEndpointDetail.keepUnresolved")}
            </AlertDialogCancel>
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes("cancel") && (
                <Button
                  variant="outline"
                  disabled={resolveActivity.isPending}
                  onClick={() =>
                    resolutionItem &&
                    resolveActivity.mutate({
                      item: resolutionItem,
                      action: "cancel",
                    })
                  }
                >
                  {resolutionItem.actionType === "slash_task_start"
                    ? t("app.apps.chatEndpointDetail.cancelTaskStart")
                    : resolutionItem.actionType === "provider_effect"
                      ? t("app.apps.chatEndpointDetail.cancelProviderReply")
                      : resolutionItem.fileTransfer
                        ? t("app.apps.chatEndpointDetail.cancelFileTransfer")
                        : t("app.apps.chatEndpointDetail.cancelPublication")}
                </Button>
              )}
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes(
                "retry_anyway",
              ) && (
                <Button
                  variant="outline"
                  disabled={resolveActivity.isPending}
                  onClick={() =>
                    resolutionItem &&
                    resolveActivity.mutate({
                      item: resolutionItem,
                      action: "retry_anyway",
                    })
                  }
                >
                  {resolutionItem.fileTransfer
                    ? t("app.apps.chatEndpointDetail.retryFileNotification")
                    : t("app.apps.chatEndpointDetail.retryAnyway")}
                </Button>
              )}
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes(
                "mark_delivered",
              ) && (
                <AlertDialogAction
                  disabled={resolveActivity.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (resolutionItem) {
                      resolveActivity.mutate({
                        item: resolutionItem,
                        action: "mark_delivered",
                      });
                    }
                  }}
                >
                  {t("app.apps.chatEndpointDetail.markDelivered")}
                </AlertDialogAction>
              )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("app.apps.chatEndpointDetail.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("app.apps.chatEndpointDetail.removeBody", {
                agent: endpoint.assignedAgentName,
                provider: providerNames[endpoint.provider],
              })}{" "}
              {providerLifecycleGuidance(endpoint.provider).remove}
              {endpoint.provider === "slack" && (
                <> <a
                  href={endpoint.setup?.slackRegistration?.managementUrl ?? "https://api.slack.com/apps"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >Open Slack app settings</a> to manage or delete the Slack app.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("app.common.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={lifecycle.isPending}
              onClick={() => lifecycle.mutate("remove")}
            >
              {lifecycle.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t("app.apps.chatEndpointDetail.removeConnection")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
