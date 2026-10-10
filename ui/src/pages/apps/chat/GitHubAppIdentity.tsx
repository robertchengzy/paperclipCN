import { Trans } from "react-i18next";
import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { ChatEndpoint } from "@/api/chatEndpoints";
import { AgentAvatarDownload } from "@/components/AgentAvatarDownload";
import { GitHubSettingsDisclosure } from "./GitHubSettingsDisclosure";
import { CopyText } from "@/components/CopyText";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";

export function gitHubBotMention(endpoint: Pick<ChatEndpoint, "botUsername">) {
  const slug = endpoint.botUsername?.replace(/^@/, "").replace(/\[bot\]$/, "");
  return slug ? `@${slug}` : null;
}

export function gitHubAppSettingsUrl(endpoint: ChatEndpoint) {
  const github = endpoint.setup?.github;
  const slug = gitHubBotMention(endpoint)?.slice(1);
  if (!slug) return "https://github.com/settings/apps";
  if (github?.appOwnerType === "organization" && github.appOwnerLogin)
    return `https://github.com/organizations/${encodeURIComponent(github.appOwnerLogin)}/settings/apps/${encodeURIComponent(slug)}`;
  if (github?.appOwnerType === "personal")
    return `https://github.com/settings/apps/${encodeURIComponent(slug)}`;
  // Legacy manual connections may not record ownership type. Never assume it.
  return "https://github.com/settings/apps";
}

export function GitHubBotMention({ endpoint }: { endpoint: ChatEndpoint }) {
  useUiCopyTranslation();
  const mention = gitHubBotMention(endpoint);
  return mention ? (
    <CopyText
      text={mention}
      ariaLabel={translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.copyGitHubMention")}
      title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.copyGitHubMention")}
      className="break-all font-mono text-xs"
    >
      {mention}
    </CopyText>
  ) : null;
}

/** Optional provider-owned branding, shared by completion and management. */
export function GitHubAppBranding({
  endpoint,
  avatarUrl,
}: {
  endpoint: ChatEndpoint;
  avatarUrl?: string;
}) {
  useUiCopyTranslation();
  return (
    <GitHubSettingsDisclosure title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.gitHubAppNameAndLogo")}>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          {translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.changeTheNameOrUploadALogoInThe")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {avatarUrl && (
            <>
              <img
                src={avatarUrl}
                alt={translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.value0SAvatarForDownload", { value0: String(endpoint.assignedAgentName) })}
                className="size-12 shrink-0 object-contain"
              />
              <AgentAvatarDownload
                avatarUrl={avatarUrl}
                name={endpoint.botLabel ?? endpoint.assignedAgentName}
              />
            </>
          )}
          <Button variant="outline" asChild>
            <a
              href={gitHubAppSettingsUrl(endpoint)}
              target="_blank"
              rel="noreferrer"
              aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.editAppNameAndLogoOnGitHub")}
            >
              {translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.editOnGitHub")} <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground"><Trans i18nKey="app.uiCopy.pagesAppsChatGitHubAppIdentity.message84" components={{ part0: <Link
            className="underline underline-offset-4"
            to={`/apps/chat/connect?provider=github&resume=${endpoint.id}&reconnect=1`}
          >
            {translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.reconnectAfterward")}
          </Link> }} /></p>
      </div>
    </GitHubSettingsDisclosure>
  );
}

/** Provider-owned branding actions live beside the App identity, not among review rules. */
export function GitHubAppIdentityActions({
  endpoint,
  avatarUrl,
}: {
  endpoint: ChatEndpoint;
  avatarUrl?: string;
}) {
  useUiCopyTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {avatarUrl && (
        <AgentAvatarDownload
          avatarUrl={avatarUrl}
          name={endpoint.botLabel ?? endpoint.assignedAgentName}
          iconOnly
        />
      )}
      <Button variant="ghost" size="sm" asChild>
        <a
          href={gitHubAppSettingsUrl(endpoint)}
          target="_blank"
          rel="noreferrer"
          aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.editAppNameAndLogoOnGitHub")}
          title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.changeTheAppNameOrUploadItsLogoOn")}
        >
          {translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.editApp")} <ExternalLink className="size-3.5" />
        </a>
      </Button>
      <Button variant="ghost" size="icon" asChild>
        <Link
          to={`/apps/chat/connect?provider=github&resume=${endpoint.id}&reconnect=1`}
          aria-label={translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.refreshGitHubAppIdentity")}
          title={translateUiCopy("app.uiCopy.pagesAppsChatGitHubAppIdentity.reconnectAfterRenamingTheAppToRefreshItsMention")}
        >
          <RefreshCw className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
