import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";

export function ModeBadge({
  deploymentMode,
  deploymentExposure,
}: {
  deploymentMode?: DeploymentMode;
  deploymentExposure?: DeploymentExposure;
}) {
  const { t } = useTranslation();
  if (!deploymentMode) return null;

  const label =
    deploymentMode === "local_trusted"
      ? t("app.settings.modeBadge.localTrusted")
      : (deploymentExposure ?? "private") === "private"
        ? t("app.settings.modeBadge.authenticatedPrivate")
        : t("app.settings.modeBadge.authenticatedPublic");

  return <Badge variant="outline">{label}</Badge>;
}
