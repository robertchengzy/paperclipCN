import { CircleSlash2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { statusBadge } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function IssueListBadge({
  isPaused,
  label,
}: {
  isPaused: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  if (!isPaused && !label) return null;
  const pausedLabel = t("app.reviewIssueBadge.paused");
  return (
    <>
      {isPaused ? (
        <Badge
          variant="ghost"
          className={cn("ml-1.5 px-1.5 text-(length:--text-nano)", statusBadge.paused)}
          aria-label={pausedLabel}
          title={pausedLabel}
        >
          <CircleSlash2 className="h-3 w-3" />
          {pausedLabel}
        </Badge>
      ) : null}
      {label ? (
        <Badge variant="outline" className="ml-1.5 border-amber-500/40 bg-amber-500/10 px-1.5 text-(length:--text-nano) text-amber-700 dark:text-amber-300">
          {label}
        </Badge>
      ) : null}
    </>
  );
}
