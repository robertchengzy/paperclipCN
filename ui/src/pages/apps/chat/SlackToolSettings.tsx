import { Trans } from "react-i18next";
import { useTranslation } from "@/i18n";
import { Link } from "react-router-dom";
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  SlackSearchStatus,
  SlackToolCapabilities,
} from "@paperclipai/shared";
import { slackToolsApi } from "@/api/slackTools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SlackCapabilitiesView({
  capabilities,
  error,
}: {
  capabilities?: SlackToolCapabilities;
  error?: string;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t("app.apps.slackToolSettings.slackTools")}</h3>
      <p className="text-sm">{t("app.apps.slackToolSettings.inviteTheBotToAChannelThen")}</p>
      <p className="text-sm text-muted-foreground">{t("app.apps.slackToolSettings.theAgentCanReadChannelsSharedBy")}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!capabilities && !error && (
        <p role="status" className="text-sm text-muted-foreground">{t("app.apps.slackToolSettings.checkingSlackPermissions")}</p>
      )}
      {capabilities && (
        <>
          <ul className="space-y-2 text-sm">
            <li>{t("app.apps.slackToolSettings.readChannelsThreadsMessagesFilesAndSource")}</li>
            <li>{t("app.apps.slackToolSettings.sendMessagesAndFilesReactPinBookmark")}</li>
            <li>{t("app.apps.slackToolSettings.creatingChannelsInvitingPeopleAndDestructiveChanges")}</li>
          </ul>
          {capabilities.missingScopes.length > 0 && (
            <div className="rounded-lg border border-border bg-muted p-3 space-y-2">
              <p className="text-sm font-medium">{t("app.apps.slackToolSettings.addPermissionsToUnlockMoreTools")}</p>
              <p className="text-sm"><Trans i18nKey="app.apps.slackToolSettings.upgradePermissions" components={{ settingsLink: <a className="underline underline-offset-4" href="https://api.slack.com/apps" target="_blank" rel="noreferrer" /> }} /></p>
              <p className="text-xs font-mono break-words">
                {capabilities.missingScopes.join(", ")}
              </p>
            </div>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">{t("app.apps.slackToolSettings.toolPermissionsAndAvailability")}</summary>
            <ul className="mt-3 divide-y divide-border">
              {capabilities.tools.map((tool) => (
                <li
                  key={tool.name}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span>
                    {tool.name.replace(/^slack_/, "").replaceAll("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tool.available === false
                      ? t("app.apps.slackToolSettings.needsPermissions")
                      : tool.available === null
                        ? t("app.apps.slackToolSettings.notVerified")
                        : tool.risk === "approval"
                          ? t("app.apps.slackToolSettings.askFirst")
                          : t("app.apps.slackToolSettings.available")}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <p className="text-xs text-muted-foreground">{t("app.apps.slackToolSettings.slackPlanMembershipAndPerActionPermissions")}</p>
        </>
      )}
    </section>
  );
}

export function SlackSearchView({
  status,
  onConnect,
  onDisconnect,
  onConfigure,
}: {
  status: SlackSearchStatus;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onConfigure: (input: {
    clientId: string;
    clientSecret: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [clientId, setClientId] = useState(status.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const perform = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("app.apps.slackToolSettings.unableToUpdateSlackSearch"),
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t("app.apps.slackToolSettings.yourSlackSearchAccess")}</h3>
      <p className="text-sm text-muted-foreground">{t("app.apps.slackToolSettings.optionalPersonalAuthorizationEnablesPrivateSearchOn")}</p>
      {!status.nativeSearchAvailable && (
        <p role="status" className="text-sm text-muted-foreground">
          {status.limitation}
        </p>
      )}
      {status.connected ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{t("app.apps.slackToolSettings.slackSearchConnected")}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void perform(onDisconnect)}
          >{t("app.apps.slackToolSettings.disconnectSearch")}</Button>
        </div>
      ) : (
        <Button
          variant="outline"
          disabled={pending || !status.configured}
          onClick={() => void perform(onConnect)}
        >{t("app.apps.slackToolSettings.connectSlackSearch")}</Button>
      )}
      {!status.configured && (
        <p className="text-sm text-muted-foreground">{t("app.apps.slackToolSettings.aConnectionManagerNeedsToConfigureYour")}</p>
      )}
      {status.canConfigure && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("app.apps.slackToolSettings.oauthAppConfigurationForConnectionManagers")}</summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                await onConfigure({ clientId, clientSecret });
                setClientSecret("");
              });
            }}
          >
            <p className="text-sm"><Trans i18nKey="app.apps.slackToolSettings.configureOauth" components={{ code: <code /> }} />
            </p>
            <p className="text-xs font-mono break-all">
              {status.redirectUri ?? t("app.apps.slackToolSettings.configureAPublicHttpsUrlFirst")}
            </p>
            <div className="space-y-2">
              <label htmlFor={`${id}-client`}>{t("app.apps.slackToolSettings.clientId")}</label>
              <Input
                id={`${id}-client`}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-secret`}>{t("app.apps.slackToolSettings.clientSecret")}</label>
              <Input
                id={`${id}-secret`}
                type="password"
                autoComplete="new-password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                type="submit"
                size="sm"
                disabled={pending || !clientId || !clientSecret}
              >{t("app.apps.slackToolSettings.saveOauthConfiguration")}</Button>
            </div>
          </form>
        </details>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
export function SlackToolsSettings({
  companyId,
  endpointId,
  connectionId,
}: {
  companyId: string;
  endpointId: string;
  connectionId?: string | null;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["slack-capabilities", companyId, endpointId],
    queryFn: () => slackToolsApi.capabilities(companyId, endpointId),
    staleTime: 60_000,
  });
  return (
    <div className="space-y-3">
      <SlackCapabilitiesView
        capabilities={query.data}
        error={query.error?.message}
      />
      {connectionId && (
        <Link
          className="text-sm underline underline-offset-4"
          to={`/apps/${connectionId}/permissions`}
        >{t("app.apps.slackToolSettings.manageActionPermissions")}</Link>
      )}
    </div>
  );
}
export function SlackSearchAccess({
  companyId,
  endpointId,
}: {
  companyId: string;
  endpointId: string;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["slack-search", companyId, endpointId],
    queryFn: () => slackToolsApi.search(companyId, endpointId),
  });
  if (query.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {query.error.message}
      </p>
    );
  if (!query.data)
    return (
      <p role="status" className="text-sm text-muted-foreground">{t("app.apps.slackToolSettings.loadingSearchAccess")}</p>
    );
  return (
    <SlackSearchView
      status={query.data}
      onConnect={async () => {
        const result = await slackToolsApi.connect(companyId, endpointId);
        window.location.assign(result.url);
      }}
      onDisconnect={async () => {
        await slackToolsApi.disconnect(companyId, endpointId);
        await query.refetch();
      }}
      onConfigure={async (input) => {
        await slackToolsApi.configure(companyId, endpointId, input);
        await query.refetch();
      }}
    />
  );
}
