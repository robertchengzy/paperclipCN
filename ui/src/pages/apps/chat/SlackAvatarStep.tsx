import { Trans } from "react-i18next";
import { useTranslation } from "@/i18n";
import { useId, useState } from "react";
import {
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SlackAvatarProps {
  agentName: string;
  appName: string;
  avatarUrl: string;
}

/** Manual fallback shared by Slack onboarding and its Settings page. */
export function SlackAvatarContent({
  agentName,
  appName,
  avatarUrl,
  compact = false,
}: SlackAvatarProps & { compact?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const filename = `${appName.replace(/[^a-zA-Z0-9_-]+/g, "-") || "agent"}-avatar.png`;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      const response = await fetch(avatarUrl);
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/png")
      )
        throw new Error(t("app.apps.slackAvatarStep.avatarUnavailable"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="space-y-8">
      <section
        aria-labelledby={`${id}-download`}
        className="flex flex-col items-start gap-6 sm:flex-row sm:items-center"
      >
        <img
          src={avatarUrl}
          width={512}
          height={512}
          alt={t("app.apps.slackAvatarStep.sCliptoonAvatar", { value0: agentName })}
          className="size-40 shrink-0 rounded-lg bg-muted object-contain"
        />
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 id={`${id}-download`} className="text-sm font-semibold">
              {compact
                ? t("app.apps.slackAvatarStep.downloadYourAgentSAvatar")
                : t("app.apps.slackAvatarStep.1DownloadYourAgentSAvatar")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("app.apps.slackAvatarStep.png512512ReadyForSlack")}</p>
          </div>
          <Button variant="outline" asChild>
            <a
              href={avatarUrl}
              download={filename}
              aria-disabled={downloading}
              onClick={(event) => {
                event.preventDefault();
                void download();
              }}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}{t("app.apps.slackAvatarStep.downloadAvatar")}</a>
          </Button>
          {downloadError && (
            <p role="alert" className="text-sm text-destructive">{t("app.apps.slackAvatarStep.couldnTDownloadTheAvatarTryDownloading")}</p>
          )}
        </div>
      </section>

      <details open={compact ? undefined : true} className="space-y-4">
        <summary
          className={
            compact
              ? "cursor-pointer text-sm underline underline-offset-4"
              : "hidden"
          }
        >{t("app.apps.slackAvatarStep.howToUploadInSlack")}</summary>
        <section aria-labelledby={`${id}-upload`} className="space-y-4">
          <div className="space-y-1">
            <h2 id={`${id}-upload`} className="text-sm font-semibold">
              {compact ? t("app.apps.slackAvatarStep.uploadItInSlack") : t("app.apps.slackAvatarStep.2UploadItInSlack")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("app.apps.slackAvatarStep.youLlUploadTheDownloadedImageDirectly")}</p>
          </div>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li><Trans i18nKey="app.apps.slackAvatarStep.openSettingsAndChoose" values={{ appName }} components={{ settingsLink: <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" />, icon: <ExternalLink className="inline size-3" />, strong: <strong /> }} /></li>
            <li><Trans i18nKey="app.apps.slackAvatarStep.chooseBasicInformation" components={{ strong: <strong /> }} /></li>
            <li><Trans i18nKey="app.apps.slackAvatarStep.uploadIcon" values={{ filename }} components={{ strong: <strong />, file: <span className="break-all font-mono text-xs" /> }} /></li>
            <li><Trans i18nKey="app.apps.slackAvatarStep.saveIcon" components={{ strong: <strong /> }} /></li>
          </ol>
        </section>
      </details>
    </div>
  );
}


export function SlackAvatarSettings(props: SlackAvatarProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4" aria-label={t("app.apps.slackAvatarStep.slackAvatar")}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("app.apps.slackAvatarStep.agentAvatar")}</h2>
        <p className="text-sm text-muted-foreground">{t("app.apps.slackAvatarStep.useAgentAvatar", { agentName: props.agentName })}</p>
      </div>
      <SlackAvatarContent {...props} compact />
    </section>
  );
}
